// state/pending.json 이 있고, 텔레그램에 "합격" 답장이 오면 인스타에 발행한다.
// GitHub Actions 에서 10분마다 실행. 발행하면 published=true 를 출력 → 워크플로가 pending.json 삭제.

import { readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { sendText } from "./telegram.mjs";
import { publishCarousel, publishReel, publishStory } from "./instagram.mjs";

const OK_WORDS = /^(합격|발행|게시|승인|ㄱㄱ|go|ok)$/i;

function out(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFile(process.env.GITHUB_OUTPUT, `${k}=${v}\n`).catch(() => {});
  console.log(`${k}=${v}`);
}

async function findApproval(sinceUnix) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = String(process.env.TELEGRAM_CHAT_ID);
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100&timeout=0`, {
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`getUpdates: ${j.description}`);
  return j.result.some((u) => {
    const m = u.message;
    return (
      m &&
      String(m.chat?.id) === chatId &&
      m.date > sinceUnix &&
      typeof m.text === "string" &&
      OK_WORDS.test(m.text.trim())
    );
  });
}

if (!existsSync("state/pending.json")) {
  out("published", "false");
  console.log("대기 중인 발행 없음");
  process.exit(0);
}

const p = JSON.parse(await readFile("state/pending.json", "utf8"));

if (!(await findApproval(p.created_at))) {
  out("published", "false");
  console.log(`"합격" 대기 중 (${p.date})`);
  process.exit(0);
}

console.log(`"합격" 확인됨 — ${p.date} 발행 시작`);
const done = [];
const failed = [];

for (const [label, fn] of [
  ["피드 캐러셀", () => publishCarousel(p.carousel, p.caption)],
  ["스토리", () => publishStory(p.story)],
  ["릴스", () => publishReel(p.reel, p.caption)],
]) {
  try {
    const id = await fn();
    done.push(`${label} (${id})`);
  } catch (e) {
    failed.push(`${label}: ${e.message}`);
  }
}

const lines = [`${p.date} 인스타 발행 결과`];
if (done.length) lines.push("", "✅ " + done.join("\n✅ "));
if (failed.length) lines.push("", "❌ " + failed.join("\n❌ "));
await sendText(lines.join("\n"));

// 하나라도 성공하면 pending 제거 (재시도로 중복 게시 방지). 전부 실패면 유지.
if (done.length) {
  out("published", "true");
  out("date", p.date);
} else {
  out("published", "false");
  process.exitCode = 1;
}
