import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { wrap, buildCardSvgs, renderCards } from "../src/cards.mjs";
import { renderReelFrames } from "../src/reelcards.mjs";
import { renderReel } from "../src/reel.mjs";

const draft = JSON.parse(await readFile(new URL("./fixtures/draft.json", import.meta.url)));

test("wrap: 최대 글자수/줄수 지키고 초과분은 …", () => {
  assert.deepEqual(wrap("제로 슈거 소주 판매 급증", 6), ["제로 슈거", "소주 판매", "급증"]);
  const two = wrap("가나다라마바사아자차카타파하", 4, 2);
  assert.equal(two.length, 2);
  assert.ok(two[1].endsWith("…"));
});

test("buildCardSvgs: 커버 1 + 이슈 5 = 6장, 헤드라인 텍스트 포함", async () => {
  const svgs = await buildCardSvgs(draft);
  assert.equal(svgs.length, 6);
  assert.ok(svgs[0].includes("이슈 5"));
  assert.ok(svgs[1].includes("제로 슈거 소주"));
  assert.ok(svgs.every((s) => s.startsWith("<svg") && s.includes("</svg>")));
});

test("buildCardSvgs: 이슈 4개면 5장", async () => {
  const d = { ...draft, issues: draft.issues.slice(0, 4) };
  assert.equal((await buildCardSvgs(d)).length, 5);
});

test("renderCards + renderReelFrames + renderReel: 실제 PNG/MP4 산출 (느림)", async () => {
  const dir = join(process.cwd(), "out", "__test");
  await rm(dir, { recursive: true, force: true });

  const cards = await renderCards(draft, dir);
  assert.equal(cards.length, 6);
  for (const p of cards) {
    const buf = await readFile(p);
    assert.ok(buf.length > 5000, `${p} 가 너무 작음`);
    assert.ok(buf[0] === 0x89 && buf[1] === 0x50, "PNG 매직바이트 아님"); // \x89PNG
  }

  const frames = await renderReelFrames(draft, dir);
  assert.equal(frames.length, 6);

  const reel = await renderReel(frames, dir);
  const s = await stat(reel);
  assert.ok(s.size > 20000, "릴스 mp4 가 너무 작음");

  await rm(dir, { recursive: true, force: true });
});
