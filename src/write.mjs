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
소비·라이프스타일·유통·브랜드·트렌드·재테크·테크 관점에서 오늘 가장 이야기할 만한 이슈를 강한 순서로 7개 고른다 (상위 5개가 실제 사용됨).

엄격한 규칙:
- 제공된 자료에 없는 사실·수치·발언은 절대 만들지 마라. 근거가 약하면 confidence를 낮춰라.
- 다음은 무조건 제외 (광고 부적합): 정치인·정당·선거, 사건사고·범죄·재판·수사, 사망·부고·자살,
  해킹·정보유출·보이스피싱 피해, 재난·사고, 젠더·이념 갈등, 전쟁·분쟁, 연예인 스캔들·열애·결별·논란.
- 남기는 건 "돈 쓰는 이야기": 신제품·가격·할인·유통 변화, 소비 습관 변화, 새 서비스·앱·기기,
  재테크·투자 흐름, 유행하는 취미·문화 소비, 브랜드·플랫폼 동향.
- 7개 채워라. 제외 규칙을 지키면서 강한 소비·트렌드 이슈만.
- 상위 5개가 서로 다른 분야로 골고루 되도록 순서를 정해라 (증시·투자 / 유통·이커머스 / IT·기기 / 먹거리·외식 / 뷰티 / 여행·레저 / 콘텐츠·문화 등).
  같은 분야는 상위 5개 안에서 최대 2개까지.
- 단정 금지: "~로 밝혀졌다" 대신 "~라고 보도됐다".
- 모든 문장은 순 한글. 한자(韓·美 등)·일본어 표기 금지, 한글로 풀어써라. 낚시성 과장 금지.`;

const FORMAT = `아래 JSON 객체 하나만 출력한다. 코드펜스도 다른 설명도 붙이지 마라.
{
  "date": "오늘 날짜 YYYY-MM-DD",
  "cover_image_query": "1번 이슈 배경 사진 검색어. 영어 2~4단어. 구체적인 사물·장면",
  "hook": "1번 카드/릴스 첫 화면 상단 어그로성 후킹 문구. 12자 내외. 답을 말하지 말고 궁금하게만 만들 것(헤드라인 반복 금지). 손해회피·소외감·반전 자극. 예: '이거 모르면 대화 못 낌', '요즘 다들 갈아탐', '아직도 이거 안 해?', '나만 몰랐던 거임?'",
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

issues 배열은 7개 (강한 순).`;

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
  const slice = body
    .slice(s, e + 1)
    .replace(/,(\s*[}\]])/g, "$1"); // 후행 콤마 제거
  return JSON.parse(slice);
}

async function callModel(client, prompt) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    thinking: { type: "disabled" }, // JSON 추출 작업 — 추론 불필요, 토큰 예산 확보
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, usage: msg.usage, model: msg.model };
}

export async function writeDraft(material) {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 는 환경변수에서
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const prompt = `${buildMaterial(material, today)}\n\n---\n${FORMAT}`;

  let draft, res;
  try {
    res = await callModel(client, prompt);
    draft = parseJson(res.text);
  } catch (e) {
    console.warn(`[재시도] 첫 응답 파싱 실패: ${e.message.slice(0, 120)}`);
    res = await callModel(client, prompt + "\n\n반드시 유효한 JSON 하나만. 문자열 안에 줄바꿈 금지.");
    draft = parseJson(res.text);
  }

  if (!Array.isArray(draft.issues) || draft.issues.length === 0) {
    throw new Error("초안에 issues 가 비어 있음");
  }

  const kept = dropUnsafe(draft.issues);
  const dropped = draft.issues.length - kept.length;
  if (dropped) console.warn(`[필터] 광고 부적합 이슈 ${dropped}건 제외`);
  // 7개 후보 중 필터 통과분 상위 5개 사용
  draft.issues = kept.slice(0, 5).map((it, i) => ({ ...it, rank: i + 1 }));
  if (draft.issues.length === 0) throw new Error("필터 후 남은 이슈 없음");

  return { draft, usage: res.usage, model: res.model, dropped };
}
