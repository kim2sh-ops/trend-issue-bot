import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { OUT_DIR } from "./theme.mjs";
import { renderCards } from "./cards.mjs";
import { renderReel } from "./reel.mjs";

function todayKST() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export async function renderAll(draft) {
  const date = draft.date || todayKST();
  const dir = join(OUT_DIR, date);
  const cards = await renderCards(draft, dir);
  const reel = await renderReel(cards, dir);
  return { dir, cards, reel, date };
}

// 저장된 초안 JSON 으로 렌더만 다시 하기:  node src/render.mjs out/2026-09-08/draft.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("사용법: node src/render.mjs <draft.json 경로>");
    process.exit(1);
  }
  const draft = JSON.parse(await readFile(file, "utf8"));
  const r = await renderAll(draft);
  console.log(`카드 ${r.cards.length}장 + 릴스 → ${r.dir}`);
}
