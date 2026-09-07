import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { collect } from "./sources.mjs";
import { writeDraft } from "./write.mjs";
import { renderAll } from "./render.mjs";
import { sendDraft, sendPhotos, sendVideo } from "./telegram.mjs";

// --dry        : 수집 결과만 출력 (Claude / 렌더 / 텔레그램 호출 안 함)
// --no-render  : 초안 텍스트만 생성·전송 (카드·릴스 렌더 생략)
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry");
const noRender = args.has("--no-render");

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

const assets = await renderAll(draft);
await writeFile(join(assets.dir, "draft.json"), JSON.stringify(draft, null, 2));
console.log(`렌더: 카드 ${assets.cards.length}장 + 릴스 → ${assets.dir}`);

await sendPhotos(assets.cards, `${draft.date} 카드뉴스 미리보기 (밀어서 보기)`);
await sendVideo(assets.reel, `${draft.date} 릴스 샘플 · 무음 · 카드 슬라이드쇼`);
console.log("텔레그램 전송 완료");
