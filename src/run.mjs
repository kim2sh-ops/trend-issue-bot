import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collect } from "./sources.mjs";
import { writeDraft } from "./write.mjs";
import { renderAll, buildCaption } from "./render.mjs";
import { sendDraft, sendPhotos, sendDocs, sendVideo, sendText } from "./telegram.mjs";

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

const a = await renderAll(draft);
await writeFile(join(a.dir, "draft.json"), JSON.stringify(draft, null, 2));
console.log(`렌더: 카드 ${a.cardsJpg.length}장 + 스토리 + 릴스 → ${a.dir}`);

// 복붙용 캡션 (한 메시지로 깔끔하게)
await sendText("── 캡션 (복사해서 붙여넣기) ──\n\n" + buildCaption(draft));

// 미리보기 앨범 (압축됨) + 원본 파일 (인스타 업로드용)
await sendPhotos(a.cardsPng, `${a.date} 카드뉴스 미리보기`);
await sendDocs([...a.cardsJpg, a.storyJpg], "원본 파일 — 저장해서 인스타에 올리세요 (마지막 장은 스토리용)");
await sendVideo(a.reel, `${a.date} 릴스 — 저장 후 인스타에 올릴 때 트렌딩 사운드 추가`);

await sendText("📲 인스타 앱에서: 피드 캐러셀 6장 + 릴스 + 스토리로 올리기. 캡션은 위에서 복사.");
console.log("완료");
