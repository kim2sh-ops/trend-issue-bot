import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5";

const SYSTEM = `너는 한국 2030 세대를 겨냥한 '트렌드·소비' 인스타그램 카드뉴스 계정의 에디터다.
주어진 오늘의 검색 트렌드와 뉴스 헤드라인만 근거로, 소비·라이프스타일·유통·브랜드·문화·재테크 관점에서
오늘 가장 이야기할 만한 이슈를 최대 5개 고른다.

엄격한 규칙:
- 제공된 자료에 없는 사실·수치·발언은 절대 만들지 마라. 근거가 약하면 confidence를 낮춰라.
- 정치인 인사·사건사고·부고·젠더 갈등 등 광고 부적합 주제는 제외한다. 소비·트렌드 각도가 없으면 버려라.
- 좋은 재료가 5개가 안 되면 있는 만큼만 반환하라. 억지로 개수를 채우지 마라.
- 단정 금지: "~로 밝혀졌다" 대신 "~라고 보도됐다".
- 모든 문장은 한국어. 낚시성 과장 금지.`;

const FORMAT = `아래 JSON 객체 하나만 출력한다. 코드펜스도 다른 설명도 붙이지 마라.
{
  "date": "오늘 날짜 YYYY-MM-DD",
  "cover_image_query": "표지 배경 사진 검색어. 영어 2~4단어. 이 날 주제를 아우르는 일반적 장면",
  "issues": [
    {
      "rank": 1,
      "headline": "카드뉴스용 제목, 한국어 22자 이하 (넘기지 말 것)",
      "summary": ["요약 문장 1 (35자 이하)", "요약 문장 2 (35자 이하)"],
      "why_trend": "왜 2030이 지금 관심 갖는지 한 문장 (30자 이하)",
      "reel_line": "릴스에 띄울 핵심 한 줄. 15자 이하. 임팩트 있게",
      "image_query": "이 이슈 배경 사진 검색어. 영어 2~4단어. 사람 얼굴/특정 브랜드 로고 없는 일반적 장면 (예: soju bottles store, stock market chart, running shoes)",
      "sources": ["언론사명"],
      "confidence": "high|medium|low"
    }
  ],
  "caption": "인스타 캡션 2~3문장 + 저장 유도 한 마디",
  "hashtags": ["#해시태그", "12~15개"]
}`;

function buildMaterial({ trends, news }, today) {
  const lines = [`오늘 날짜: ${today}`, "", "## 검색 트렌드 (구글, 급상승어)"];
  for (const t of trends) {
    lines.push(
      `- ${t.term} (${t.traffic || "?"}) — ${t.headlines.slice(0, 3).join(" / ") || "관련 기사 없음"}` +
        (t.outlets.length ? ` [${t.outlets.join(", ")}]` : "")
    );
  }
  lines.push("", "## 뉴스 헤드라인");
  for (const n of news) {
    lines.push(`- [${n.source}] ${n.title}${n.snippet ? ` — ${n.snippet}` : ""}`);
  }
  return lines.join("\n");
}

// 모델 응답에서 JSON 객체를 관대하게 추출한다.
export function parseJson(raw) {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : raw;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  if (s === -1 || e <= s) {
    throw new Error("모델 응답에서 JSON을 찾지 못함:\n" + raw.slice(0, 600));
  }
  return JSON.parse(body.slice(s, e + 1));
}

export async function writeDraft(material) {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 는 환경변수에서
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: `${buildMaterial(material, today)}\n\n---\n${FORMAT}` }],
  });

  const responseText = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const draft = parseJson(responseText);
  if (!Array.isArray(draft.issues) || draft.issues.length === 0) {
    throw new Error("초안에 issues 가 비어 있음:\n" + responseText.slice(0, 600));
  }
  return { draft, usage: msg.usage, model: msg.model };
}
