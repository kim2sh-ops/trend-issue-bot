import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrends, parseRss } from "../src/sources.mjs";
import { parseJson } from "../src/write.mjs";
import { __test as tg } from "../src/telegram.mjs";

const TRENDS_XML = `<?xml version="1.0"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
<item>
  <title>제로 슈거 소주</title>
  <ht:approx_traffic>2000+</ht:approx_traffic>
  <ht:news_item>
    <ht:news_item_title>제로 슈거 소주 판매량 급증</ht:news_item_title>
    <ht:news_item_source>연합뉴스</ht:news_item_source>
  </ht:news_item>
  <ht:news_item>
    <ht:news_item_title>주류업계 저칼로리 경쟁</ht:news_item_title>
    <ht:news_item_source>한국경제</ht:news_item_source>
  </ht:news_item>
</item>
<item>
  <title>가을 신상 원피스</title>
  <ht:approx_traffic>500+</ht:approx_traffic>
</item>
</channel></rss>`;

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title><![CDATA[올리브영 3분기 매출 사상 최대]]></title>
  <description><![CDATA[<p>H&B 스토어 올리브영이 &hellip;</p>]]></description>
  <pubDate>Mon, 07 Sep 2026 09:00:00 +0900</pubDate></item>
<item><title>편의점 도시락 물가</title><description>가격 인상</description><pubDate></pubDate></item>
</channel></rss>`;

test("parseTrends: 검색어 + 관련 헤드라인 + 언론사 추출", () => {
  const t = parseTrends(TRENDS_XML);
  assert.equal(t.length, 2);
  assert.equal(t[0].term, "제로 슈거 소주");
  assert.equal(t[0].traffic, "2000+");
  assert.deepEqual(t[0].headlines, ["제로 슈거 소주 판매량 급증", "주류업계 저칼로리 경쟁"]);
  assert.deepEqual(t[0].outlets, ["연합뉴스", "한국경제"]);
  assert.deepEqual(t[1].headlines, []); // news_item 없는 항목도 죽지 않음
});

test("parseRss: CDATA 제목 + HTML 태그 제거된 스니펫", () => {
  const n = parseRss(RSS_XML, "연합뉴스 산업");
  assert.equal(n.length, 2);
  assert.equal(n[0].title, "올리브영 3분기 매출 사상 최대");
  assert.equal(n[0].source, "연합뉴스 산업");
  assert.ok(!n[0].snippet.includes("<p>"), "HTML 태그가 남아있으면 안 됨");
});

test("parseJson: 코드펜스/잡텍스트에 싸인 JSON도 파싱", () => {
  const raw = '여기 결과입니다:\n```json\n{"issues":[{"rank":1}],"caption":"x"}\n```\n끝';
  const d = parseJson(raw);
  assert.equal(d.issues[0].rank, 1);
});

test("parseJson: JSON 없으면 에러", () => {
  assert.throws(() => parseJson("죄송합니다 만들 수 없습니다"), /JSON을 찾지 못함/);
});

test("telegram.chunk: 길이 제한으로 분할하되 줄은 안 쪼갬", () => {
  const body = Array.from({ length: 50 }, (_, i) => `line ${i} ${"x".repeat(100)}`).join("\n");
  const parts = tg.chunk(body, 500);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 500 || !p.includes("\n")));
  assert.equal(parts.join("\n"), body);
});

test("telegram.render: 이슈/캡션/해시태그/릴스라인/이미지크레딧 포함", () => {
  const out = tg.render(
    {
      date: "2026-09-07",
      issues: [
        { rank: 1, headline: "올리브영 최대 매출", summary: ["a", "b"], why_trend: "c", reel_line: "뷰티는 H&B로", sources: ["연합뉴스"], confidence: "high" },
      ],
      caption: "캡션 내용",
      hashtags: ["#트렌드", "#소비"],
      _credits: ["Jane Doe"],
    },
    { model: "claude-haiku-4-5", usage: { input_tokens: 100, output_tokens: 200 } }
  );
  assert.match(out, /1\. 올리브영 최대 매출/);
  assert.match(out, /캡션 내용/);
  assert.match(out, /#트렌드 #소비/);
  assert.match(out, /🎬 뷰티는 H&B로/);
  assert.match(out, /이미지: Jane Doe \/ Pexels/);
});
