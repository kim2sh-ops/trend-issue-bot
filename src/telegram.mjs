// 텔레그램 전송은 특수문자 문제를 피하려고 parse_mode 없이 평문으로 보낸다.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const LIMIT = 3800; // 텔레그램 메시지 4096자 제한보다 여유 있게

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 (.env 확인)");
  return { token, chatId };
}

async function call(method, body, isForm = false) {
  const { token } = creds();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    ...(isForm ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`텔레그램 ${method} 실패: HTTP ${res.status} — ${await res.text()}`);
  return res.json();
}

async function fileBlob(path, type) {
  return new Blob([await readFile(path)], { type });
}

function render(draft, meta) {
  const L = [];
  L.push(`오늘의 트렌드·소비 이슈 초안 — ${draft.date ?? ""}`);
  if (meta) L.push(`(${meta.model} · in ${meta.usage?.input_tokens ?? "?"} / out ${meta.usage?.output_tokens ?? "?"} 토큰)`);
  if (meta?.failed?.length) L.push(`※ 수집 실패 피드: ${meta.failed.join(", ")}`);
  L.push("");

  for (const it of draft.issues ?? []) {
    L.push(`${it.rank}. ${it.headline}  [${it.confidence ?? "?"}]`);
    for (const s of it.summary ?? []) L.push(`  · ${s}`);
    if (it.why_trend) L.push(`  ↳ ${it.why_trend}`);
    if (it.reel_line) L.push(`  🎬 ${it.reel_line}`);
    L.push(`  출처: ${(it.sources ?? []).join(", ") || "미상"}`);
    L.push("");
  }

  L.push("── 캡션 ──");
  L.push(draft.caption ?? "");
  L.push("");
  L.push((draft.hashtags ?? []).join(" "));
  if (draft._credits?.length) {
    L.push("");
    L.push(`이미지: ${draft._credits.join(", ")} / Pexels`);
  }
  return L.join("\n");
}

function chunk(str, n) {
  const out = [];
  let cur = "";
  for (const line of str.split("\n")) {
    if (cur && (cur + "\n" + line).length > n) {
      out.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export async function sendDraft(draft, meta) {
  const { chatId } = creds();
  for (const part of chunk(render(draft, meta), LIMIT)) {
    await call("sendMessage", { chat_id: chatId, text: part, disable_web_page_preview: true });
  }
}

export async function sendText(text) {
  const { chatId } = creds();
  for (const part of chunk(text, LIMIT)) {
    await call("sendMessage", { chat_id: chatId, text: part, disable_web_page_preview: true });
  }
}

// 카드 PNG 여러 장을 한 앨범으로 (최대 10장)
export async function sendPhotos(paths, caption) {
  const { chatId } = creds();
  const fd = new FormData();
  fd.set("chat_id", chatId);
  fd.set(
    "media",
    JSON.stringify(
      paths.slice(0, 10).map((_, i) => ({
        type: "photo",
        media: `attach://p${i}`,
        ...(i === 0 && caption ? { caption } : {}),
      }))
    )
  );
  for (let i = 0; i < Math.min(paths.length, 10); i++) {
    fd.set(`p${i}`, await fileBlob(paths[i], "image/png"), basename(paths[i]));
  }
  await call("sendMediaGroup", fd, true);
}

export async function sendVideo(path, caption) {
  const { chatId } = creds();
  const fd = new FormData();
  fd.set("chat_id", chatId);
  if (caption) fd.set("caption", caption);
  fd.set("supports_streaming", "true");
  fd.set("video", await fileBlob(path, "video/mp4"), basename(path));
  await call("sendVideo", fd, true);
}

export const __test = { render, chunk };
