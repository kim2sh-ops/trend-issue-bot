import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { OUT_DIR } from "./theme.mjs";
import { attachImages } from "./images.mjs";
import { renderCards } from "./cards.mjs";
import { renderReelFrames, renderStory } from "./reelcards.mjs";
import { renderReel, toJpeg } from "./reel.mjs";

const todayKST = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export function buildCaption(draft) {
  const parts = [draft.caption ?? ""];
  parts.push("");
  parts.push(...(draft.issues ?? []).map((it) => `${it.rank}. ${it.headline}`));
  parts.push("");
  parts.push((draft.hashtags ?? []).join(" "));
  if (draft._credits?.length) parts.push("", `📷 ${draft._credits.join(", ")} / Pexels`);
  return parts.join("\n").trim();
}

export async function renderAll(draft) {
  const date = draft.date || todayKST();
  const dir = join(OUT_DIR, date);

  await attachImages(draft, dir); // Pexels 이미지 (키 없거나 실패하면 이미지 없이 진행)

  const cardsPng = await renderCards(draft, dir);
  const storyPng = await renderStory(draft, dir);
  const reelFrames = await renderReelFrames(draft, dir);
  const reel = await renderReel(reelFrames, dir);

  // 인스타 업로드용 JPEG
  const cards = [];
  for (const p of cardsPng) cards.push(await toJpeg(p));
  const story = await toJpeg(storyPng);

  return { dir, date, cards, cardsPng, story, reel, credits: draft._credits ?? [] };
}

// 저장된 초안 JSON 으로 렌더만 다시:  node src/render.mjs out/2026-09-08/draft.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("사용법: node src/render.mjs <draft.json 경로>");
    process.exit(1);
  }
  const r = await renderAll(JSON.parse(await readFile(file, "utf8")));
  console.log(`카드 ${r.cards.length}장 + 스토리 + 릴스 → ${r.dir}`);
}
