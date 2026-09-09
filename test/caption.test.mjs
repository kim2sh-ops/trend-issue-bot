import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildCaption } from "../src/render.mjs";
import { renderStory } from "../src/reelcards.mjs";

const draft = JSON.parse(await readFile(new URL("./fixtures/draft.json", import.meta.url)));

test("buildCaption: 캡션 + 이슈 목록 + 해시태그 + 크레딧", () => {
  const c = buildCaption({ ...draft, _credits: ["Jane"] });
  assert.match(c, /지갑이 어디로/); // draft.caption
  assert.match(c, /1\. 제로 슈거 소주/); // 이슈 목록
  assert.match(c, /#소비트렌드/);
  assert.match(c, /📷 Jane \/ Pexels/);
});

test("renderStory: 세로 PNG 산출", async () => {
  const dir = join(process.cwd(), "out", "__test_story");
  await rm(dir, { recursive: true, force: true });
  const p = await renderStory(draft, dir);
  const s = await stat(p);
  assert.ok(s.size > 5000);
  const buf = await readFile(p);
  assert.ok(buf[0] === 0x89 && buf[1] === 0x50);
  await rm(dir, { recursive: true, force: true });
});
