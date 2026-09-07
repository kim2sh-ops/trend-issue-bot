import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { OUT_DIR } from "./theme.mjs";
import { attachImages } from "./images.mjs";
import { renderCards } from "./cards.mjs";
import { renderReelFrames } from "./reelcards.mjs";
import { renderReel } from "./reel.mjs";

const todayKST = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export async function renderAll(draft) {
  const date = draft.date || todayKST();
  const dir = join(OUT_DIR, date);

  await attachImages(draft, dir); // Pexels 이미지 확보 (키 없거나 실패하면 이미지 없이 진행)
  const cards = await renderCards(draft, dir);
  const reelFrames = await renderReelFrames(draft, dir);
  const reel = await renderReel(reelFrames, dir);

  return { dir, cards, reel, date, credits: draft._credits ?? [] };
}

// 저장된 초안 JSON 으로 렌더만 다시:  node src/render.mjs out/2026-09-08/draft.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("사용법: node src/render.mjs <draft.json 경로>");
    process.exit(1);
  }
  const r = await renderAll(JSON.parse(await readFile(file, "utf8")));
  console.log(`카드 ${r.cards.length}장 + 릴스 → ${r.dir}`);
  if (r.credits.length) console.log(`이미지 제공: ${r.credits.join(", ")} (Pexels)`);
}
