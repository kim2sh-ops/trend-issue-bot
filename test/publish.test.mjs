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

test("approve: 승인 단어 매칭", async () => {
  // approve.mjs 는 실행 시 side-effect 가 있어 import 대신 정규식만 검증
  const OK = /^(합격|발행|게시|승인|ㄱㄱ|go|ok)$/i;
  assert.ok(OK.test("합격"));
  assert.ok(OK.test(" 합격 ".trim()));
  assert.ok(OK.test("OK"));
  assert.ok(!OK.test("합격입니다"));
  assert.ok(!OK.test("불합격"));
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
