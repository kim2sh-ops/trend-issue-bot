import { writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { collect } from "./sources.mjs";
import { writeDraft } from "./write.mjs";
import { renderAll, buildCaption } from "./render.mjs";
import { sendDraft, sendPhotos, sendVideo, sendText } from "./telegram.mjs";

// --dry        : 수집 결과만 출력 (Claude / 렌더 / 텔레그램 호출 안 함)
// --no-render  : 초안 텍스트만 생성·전송 (카드·릴스 렌더 생략)
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry");
const noRender = args.has("--no-render");
const PAGES_BASE = process.env.PAGES_BASE; // 설정되면 발행 대기 상태를 기록

const material = await collect();
console.log(`수집: 트렌드 ${material.trends.length}건 · 뉴스 ${material.news.length}건`);
if (dry) {
  console.log(JSON.stringify(material, null, 2));
  process.exit(0);
}

const { draft, usage, model } = await writeDraft(material);
console.log(`생성: 이슈 ${draft.issues.length}개 · ${model} · ${usage?.input_tokens ?? "?"}/${usage?.output_tokens ?? "?"} 토큰`);

await sendDraft(draft, { usage, model, failed: material.failed });

if (noRender) {
  console.log("텍스트 초안 전송 완료 (렌더 생략)");
  process.exit(0);
}

const a = await renderAll(draft);
await writeFile(join(a.dir, "draft.json"), JSON.stringify(draft, null, 2));
console.log(`렌더: 카드 ${a.cards.length}장 + 스토리 + 릴스 → ${a.dir}`);

await sendPhotos(a.cardsPng, `${a.date} 카드뉴스 미리보기 (밀어서 보기)`);
await sendVideo(a.reel, `${a.date} 릴스`);

if (PAGES_BASE) {
  const url = (p) => `${PAGES_BASE.replace(/\/$/, "")}/${a.date}/${basename(p)}`;
  const pending = {
    date: a.date,
    created_at: Math.floor(Date.now() / 1000),
    caption: buildCaption(draft),
    carousel: a.cards.map(url),
    reel: url(a.reel),
    story: url(a.story),
  };
  await mkdir("state", { recursive: true });
  await writeFile("state/pending.json", JSON.stringify(pending, null, 2));
  await sendText('위 내용으로 발행하려면 "합격" 이라고 답해주세요. (피드 캐러셀 + 스토리 + 릴스)');
  console.log("발행 대기 기록: state/pending.json");
}

console.log("완료");
