import { XMLParser } from "fast-xml-parser";

// 편집 지점: 피드 추가/제거는 여기만 고치면 됨.
export const FEEDS = [
  { name: "구글 트렌드 KR", url: "https://trends.google.com/trending/rss?geo=KR", type: "trends" },
  { name: "연합뉴스 경제", url: "https://www.yna.co.kr/rss/economy.xml", type: "rss" },
  { name: "연합뉴스 산업", url: "https://www.yna.co.kr/rss/industry.xml", type: "rss" },
  { name: "연합뉴스 문화", url: "https://www.yna.co.kr/rss/culture.xml", type: "rss" },
];

const RSS_PER_FEED = 30; // 피드당 최근 몇 건까지 재료로 쓸지

const parser = new XMLParser({ ignoreAttributes: true, cdataPropName: "__cdata" });

function text(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.__cdata ?? v["#text"] ?? "";
  return String(v);
}
function asArray(v) {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}
function items(xml) {
  const doc = parser.parse(xml);
  return asArray(doc?.rss?.channel?.item);
}

export function parseTrends(xml, name = "구글 트렌드 KR") {
  return items(xml).map((it) => {
    const news = asArray(it["ht:news_item"]);
    return {
      source: name,
      term: text(it.title).trim(),
      traffic: text(it["ht:approx_traffic"]).trim(),
      headlines: news.map((n) => text(n["ht:news_item_title"]).trim()).filter(Boolean),
      outlets: [...new Set(news.map((n) => text(n["ht:news_item_source"]).trim()).filter(Boolean))],
    };
  }).filter((t) => t.term);
}

export function parseRss(xml, name) {
  return items(xml).slice(0, RSS_PER_FEED).map((it) => ({
    source: name,
    title: text(it.title).trim(),
    snippet: text(it.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
    pubDate: text(it.pubDate).trim(),
  })).filter((n) => n.title);
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; trend-issue-bot/0.1)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return feed.type === "trends" ? parseTrends(xml, feed.name) : parseRss(xml, feed.name);
}

// 모든 피드를 병렬로 긁고, 실패한 피드는 건너뛴다 (하나 죽어도 전체는 계속).
export async function collect() {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const trends = [];
  const news = [];
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (FEEDS[i].type === "trends") trends.push(...r.value);
      else news.push(...r.value);
    } else {
      failed.push(`${FEEDS[i].name} (${r.reason?.message ?? r.reason})`);
    }
  });
  if (failed.length) console.warn("[수집 실패]", failed.join(", "));
  if (!trends.length && !news.length) throw new Error("모든 피드 수집 실패");
  return { trends, news, failed, collectedAt: new Date().toISOString() };
}
