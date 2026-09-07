import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// 프롬프트가 놓친 광고 부적합 이슈를 코드에서 한 번 더 거른다 (안전망).
const BANNED =
  /유출|해킹|피싱|스캠|사망|숨진|숨져|숨졌|부고|빈소|자살|극단적 선택|구속|기소|송치|압수수색|선고|피의자|성범죄|성폭행|성추행|마약|음주운전|열애|결별|불륜|이혼|폭행|참사|국정감사|탄핵|대통령|장관|의원/;

export function dropUnsafe(issues) {
  return (issues ?? []).filter((it) => {
    const blob = [it.headline, it.why_trend, ...(it.summary ?? [])].join(" ");
    return !BANNED.test(blob);
  });
}

const SYSTEM = `너는 한국 2030 세대를 겨냥한 '트렌드·소비' 인스타그램 카드뉴스 계정의 에디터다.
주어진 오늘의 검색 트렌드와 뉴스 헤드라인(경제·산업·문화·연예·생활·세계·IT·과학)만 근거로,
소비·라이프스타일·유통·브랜드·트렌드·재테크·테크 관점에서 오늘 가장 이야기할 만한 이슈를 정확히 5개 고른다.

엄격한 규칙:
- 제공된 자료에 없는 사실·수치·발언은 절대 만들지 마라. 근거가 약하면 confidence를 낮춰라.
- 다음은 무조건 제외 (광고 부적합): 정치인·정당·선거, 사건사고·범죄·재판·수사, 사망·부고·자살,
  해킹·정보유출·보이스피싱 피해, 재난·사고, 젠더·이념 갈등, 전쟁·분쟁, 연예인 스캔들·열애·결별·논란.
- 남기는 건 "돈 쓰는 이야기": 신제품·가격·할인·유통 변화, 소비 습관 변화, 새 서비스·앱·기기,
  재테크·투자 흐름, 유행하는 취미·문화 소비, 브랜드·플랫폼 동향.
- 반드시 5개. 제외 규칙을 지키면서 가장 강한 소비·트렌드 이슈 5개를 채워라.
- 5개는 서로 다른 분야로 골고루 (증시·투자 / 유통·이커머스 / IT·기기 / 먹거리·외식 / 뷰티 / 여행·레저 / 콘텐츠·문화 등).
  같은 분야는 최대 2개까지만. 3개 이상이면 하나를 다른 분야 이슈로 교체해라.
- 단정 금지: "~로 밝혀졌다" 대신 "~라고 보도됐다".
- 모든 문장은 순 한글. 한자(韓·美 등)·일본어 표기 금지, 한글로 풀어써라. 낚시성 과장 금지.`;

const FORMAT = `아래 JSON 객체 하나만 출력한다. 코드펜스도 다른 설명도 붙이지 마라.
{
  "date": "오늘 날짜 YYYY-MM-DD",
  "cover_image_query": "표지 배경 사진 검색어. 영어 2~4단어. 이 날 주제를 아우르는 일반적 장면",
  "issues": [
    {
      "rank": 1,
      "headline": "카드뉴스용 제목, 한국어 22자 이하 (넘기지 말 것)",
      "summary": ["요약 문장 1 (32자 이하)", "요약 문장 2 (32자 이하)", "요약 문장 3 (32자 이하)"],
      "why_trend": "왜 2030이 지금 관심 갖는지 한 문장 (30자 이하)",
      "reel_line": "릴스에 띄울 핵심 한 줄. 15자 이하. 임팩트 있게",
      "image_query": "이 이슈를 대표하는 사진 검색어. 영어. 한 가지 구체적인 사물·장면만 (추상 개념·사람 얼굴·브랜드 로고 금지). 사진만 봐도 무슨 주제인지 바로 알 수 있어야 함. 예: 'green soju bottles', 'stock ticker board', 'running shoes on track', 'cosmetics store shelf', 'korean won banknotes'",
      "sources": ["언론사명"],
      "confidence": "high|medium|low"
    }
  ],
  "caption": "인스타 캡션 2~3문장 + 저장 유도 한 마디",
  "hashtags": ["#해시태그", "12~15개"]
}

issues 배열은 정확히 5개.`;

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

  const kept = dropUnsafe(draft.issues);
  const dropped = draft.issues.length - kept.length;
  if (dropped) console.warn(`[필터] 광고 부적합 이슈 ${dropped}건 제외`);
  draft.issues = kept.map((it, i) => ({ ...it, rank: i + 1 }));
  if (draft.issues.length === 0) throw new Error("필터 후 남은 이슈 없음");

  return { draft, usage: msg.usage, model: msg.model, dropped };
}
