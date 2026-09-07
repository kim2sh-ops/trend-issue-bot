import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { T, FONT_FILES, CARD, IG_HANDLE } from "./theme.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// 글자수 기준 줄바꿈. 한글 헤드라인은 대체로 공백이 있어 공백 우선, 없으면 강제 절단.
export function wrap(text, maxChars, maxLines = 99) {
  let rest = String(text ?? "").trim();
  const lines = [];
  while (rest.length && lines.length < maxLines) {
    if (rest.length <= maxChars) {
      lines.push(rest);
      rest = "";
      break;
    }
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.55) cut = maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars - 1).trim() + "…";
  }
  return lines;
}

function tspans(lines, x, lineHeight) {
  return lines
    .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${esc(ln)}</tspan>`)
    .join("");
}

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">
<rect width="${CARD.w}" height="${CARD.h}" fill="${T.bg}"/>
${inner}
</svg>`;
}

const M = 92; // 여백

function coverSvg(draft) {
  const teaser = wrap(draft.issues?.[0]?.headline ?? "", 20, 2);
  return frame(`
<text x="${M}" y="150" font-family="${T.body}" font-weight="800" font-size="30" letter-spacing="6" fill="${T.accent}">TREND · CONSUMER</text>
<text x="${CARD.w - M}" y="150" text-anchor="end" font-family="${T.body}" font-weight="700" font-size="30" fill="${T.sub}">${esc(draft.date ?? "")}</text>

<text x="${M}" y="470" font-family="${T.display}" font-size="116" fill="${T.ink}">오늘의</text>
<text x="${M}" y="596" font-family="${T.display}" font-size="116" fill="${T.ink}">소비 트렌드</text>
<text x="${M}" y="740" font-family="${T.display}" font-size="150" fill="${T.accent}">이슈 5</text>

<rect x="${M}" y="820" width="150" height="14" fill="${T.ink}"/>

<text x="${M}" y="1120" font-family="${T.body}" font-weight="800" font-size="34" fill="${T.ink}">${tspans(teaser, M, 46)}</text>
<text x="${M}" y="1258" font-family="${T.body}" font-weight="700" font-size="28" fill="${T.sub}">밀어서 5개 모두 보기  →</text>
<text x="${CARD.w - M}" y="1258" text-anchor="end" font-family="${T.body}" font-weight="800" font-size="28" fill="${T.accent}">${esc(IG_HANDLE)}</text>
`);
}

function issueSvg(issue, rank, draft, isLast) {
  const head = wrap(issue.headline ?? "", 17, 3);
  const src = (issue.sources ?? []).join(", ") || "출처 미상";

  const headTop = 350;
  const headLH = 70;
  const ruleY = headTop + headLH * (head.length - 1) + 52;

  // 아래 블록은 위에서부터 흐르게 쌓고, 예산(약 1080px)을 넘으면 요약을 생략한다.
  const BUDGET = 1085;
  let y = ruleY + 72;
  let body = "";

  for (const s of issue.summary ?? []) {
    const w = wrap(s, 24, 2);
    const need = 44 * w.length + 30;
    if (y + need > BUDGET) break;
    body += `<text x="${M}" y="${y}" font-family="${T.body}" font-weight="600" font-size="30" letter-spacing="-0.5" fill="${T.sub}">${tspans(w, M, 44)}</text>`;
    y += need;
  }

  if (issue.why_trend) {
    const wt = wrap(issue.why_trend, 21, 2);
    const need = 46 * wt.length + 24;
    if (y + need <= BUDGET + 40) {
      y += 22;
      body += `<rect x="${M}" y="${y - 38}" width="9" height="${46 * wt.length}" fill="${T.accent}"/>`;
      body += `<text x="${M + 32}" y="${y}" font-family="${T.body}" font-weight="800" font-size="32" letter-spacing="-0.5" fill="${T.ink}">${tspans(wt, M + 32, 46)}</text>`;
      y += 46 * wt.length + 10;
    }
  }

  const srcY = Math.min(Math.max(y + 46, 1120), 1188);
  const footer = isLast
    ? `<text x="${M}" y="1258" font-family="${T.body}" font-weight="800" font-size="29" fill="${T.ink}">저장하고 팔로우 <tspan fill="${T.accent}">${esc(IG_HANDLE)}</tspan></text>`
    : `<text x="${CARD.w - M}" y="1258" text-anchor="end" font-family="${T.body}" font-weight="800" font-size="26" fill="${T.sub}">${esc(IG_HANDLE)}</text>`;

  return frame(`
<text x="${M}" y="250" font-family="${T.display}" font-size="150" fill="${T.accent}">${String(rank).padStart(2, "0")}</text>
<text x="${CARD.w - M}" y="150" text-anchor="end" font-family="${T.body}" font-weight="700" font-size="26" fill="${T.sub}">오늘의 소비 트렌드 · ${esc(draft.date ?? "")}</text>

<text x="${M}" y="${headTop}" font-family="${T.display}" font-size="53" fill="${T.ink}">${tspans(head, M, headLH)}</text>

<rect x="${M}" y="${ruleY}" width="${CARD.w - 2 * M}" height="3" fill="${T.line}"/>

${body}

<text x="${M}" y="${srcY}" font-family="${T.body}" font-weight="800" font-size="27" fill="${T.accent}">출처 · ${esc(src)}</text>
${footer}
`);
}

export function buildCardSvgs(draft) {
  const issues = (draft.issues ?? []).slice(0, 5);
  const svgs = [coverSvg(draft)];
  issues.forEach((it, i) => svgs.push(issueSvg(it, i + 1, draft, i === issues.length - 1)));
  return svgs;
}

export async function renderCards(draft, outDir) {
  await mkdir(outDir, { recursive: true });
  const svgs = buildCardSvgs(draft);
  const paths = [];
  for (let i = 0; i < svgs.length; i++) {
    const png = new Resvg(svgs[i], {
      font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: T.body },
      fitTo: { mode: "width", value: CARD.w },
    })
      .render()
      .asPng();
    const p = join(outDir, `card-${String(i + 1).padStart(2, "0")}.png`);
    await writeFile(p, png);
    paths.push(p);
  }
  return paths;
}
