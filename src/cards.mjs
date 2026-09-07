import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { T, FONT_FILES, CARD, IG_HANDLE } from "./theme.mjs";
import { dataUri } from "./images.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// Black Han Sans(제목용)에 없는 기호는 whole-run 폴백을 유발하므로 미리 치환한다.
const displaySafe = (s) =>
  String(s ?? "")
    .replace(/[·・]/g, ", ")
    .replace(/[–—]/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, "")
    .replace(/\s+/g, " ")
    .trim();

// 글자수 기준 줄바꿈. 공백 우선, 없으면 강제 절단. ell="" 이면 넘침 표시 생략(제목용).
export function wrap(text, maxChars, maxLines = 99, ell = "…") {
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
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars - ell.length).trim() + ell;
  }
  return lines;
}

const tspans = (lines, x, lh) =>
  lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(ln)}</tspan>`).join("");

const M = 92;

function shell(bodyInner, imgUri) {
  const bg = imgUri
    ? `<image href="${imgUri}" x="0" y="0" width="${CARD.w}" height="${CARD.h}" preserveAspectRatio="xMidYMid slice"/>
       <rect width="${CARD.w}" height="${CARD.h}" fill="url(#scrim)"/>`
    : `<rect width="${CARD.w}" height="${CARD.h}" fill="${T.bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">
<defs>
  <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${T.bg}" stop-opacity="0.42"/>
    <stop offset="0.38" stop-color="${T.bg}" stop-opacity="0.48"/>
    <stop offset="0.58" stop-color="${T.bg}" stop-opacity="0.94"/>
    <stop offset="1" stop-color="${T.bg}" stop-opacity="1"/>
  </linearGradient>
</defs>
<rect width="${CARD.w}" height="${CARD.h}" fill="${T.bg}"/>
${bg}
${bodyInner}
</svg>`;
}

async function issueSvg(issue, rank, draft) {
  const uri = issue.image ? await dataUri(issue.image) : null;
  const head = wrap(displaySafe(issue.headline), 17, 3, "");

  const headTop = 560;
  const headLH = 70;
  const ruleY = headTop + headLH * (head.length - 1) + 38;

  // 우선순위: 헤드라인 → why_trend(훅) → 요약. 아래 여백 예산 안에서만 채운다.
  let y = ruleY + 58;
  let body = "";

  if (issue.why_trend) {
    const wt = wrap(issue.why_trend, 21, 2);
    body += `<rect x="${M}" y="${y - 33}" width="8" height="${42 * wt.length}" fill="${T.accent}"/>`;
    body += `<text x="${M + 30}" y="${y}" font-family="${T.body}" font-weight="800" font-size="30" letter-spacing="-0.5" fill="${T.ink}">${tspans(wt, M + 30, 42)}</text>`;
    y += 42 * wt.length + 36;
  }

  const BUDGET = 1195;
  for (const s of (issue.summary ?? []).slice(0, 3)) {
    const w = wrap(s, 26, 2);
    const need = 42 * w.length + 22;
    if (y + need > BUDGET) break;
    body += `<text x="${M}" y="${y}" font-family="${T.body}" font-weight="600" font-size="28" letter-spacing="-0.5" fill="${T.sub}">${tspans(w, M, 42)}</text>`;
    y += need;
  }

  const src = (issue.sources ?? []).join(", ") || "출처 미상";
  const srcY = Math.min(Math.max(y + 30, 1150), 1198);
  const handle = `<text x="${CARD.w - M}" y="1262" text-anchor="end" font-family="${T.body}" font-weight="800" font-size="25" fill="${T.sub}">${esc(IG_HANDLE)}</text>`;
  const footer =
    rank === 1
      ? `<text x="${M}" y="1262" font-family="${T.body}" font-weight="800" font-size="28" fill="${T.accent}">→ 5개 다 넘겨보기</text>${handle}`
      : handle;

  // 1번 카드에만 어그로 후킹 문구
  const hookLines = rank === 1 && draft.hook ? wrap(displaySafe(draft.hook), 15, 2, "") : [];
  const hook = hookLines.length
    ? `<rect x="${M}" y="330" width="90" height="10" fill="${T.accent}"/>
       <text x="${M}" y="430" font-family="${T.displayStack}" font-size="64" fill="${T.accent}">${tspans(hookLines, M, 76)}</text>`
    : "";

  return shell(
    `
<text x="${M}" y="250" font-family="${T.displayStack}" font-size="140" fill="${T.accent}">${String(rank).padStart(2, "0")}</text>
<text x="${CARD.w - M}" y="150" text-anchor="end" font-family="${T.body}" font-weight="700" font-size="25" fill="${T.sub}">오늘의 소비 트렌드 · ${esc(draft.date ?? "")}</text>
${hook}
<text x="${M}" y="${headTop}" font-family="${T.displayStack}" font-size="53" fill="${T.ink}">${tspans(head, M, headLH)}</text>
<rect x="${M}" y="${ruleY}" width="${CARD.w - 2 * M}" height="3" fill="${T.line}"/>
${body}
<text x="${M}" y="${srcY}" font-family="${T.body}" font-weight="800" font-size="26" fill="${T.accent}">출처 · ${esc(src)}</text>
${footer}
`,
    uri
  );
}

function outroSvg() {
  return shell(
    `
<text x="${M}" y="160" font-family="${T.body}" font-weight="800" font-size="30" letter-spacing="8" fill="${T.accent}">FOLLOW</text>

<text x="${M}" y="560" font-family="${T.displayStack}" font-size="98" fill="${T.ink}">팔로우하고</text>
<text x="${M}" y="685" font-family="${T.displayStack}" font-size="98" fill="${T.ink}">매일 다양한 이슈</text>
<text x="${M}" y="810" font-family="${T.displayStack}" font-size="98" fill="${T.accent}">확인하세요</text>

<rect x="${M}" y="900" width="150" height="14" fill="${T.accent}"/>

<text x="${M}" y="1200" font-family="${T.body}" font-weight="800" font-size="46" fill="${T.ink}">${esc(IG_HANDLE)}</text>
<text x="${M}" y="1258" font-family="${T.body}" font-weight="600" font-size="28" fill="${T.sub}">매일 저녁 7시 · 소비·트렌드 이슈 5</text>
`,
    null
  );
}

export async function buildCardSvgs(draft) {
  const issues = (draft.issues ?? []).slice(0, 5);
  const out = [];
  for (let i = 0; i < issues.length; i++) {
    out.push(await issueSvg(issues[i], i + 1, draft));
  }
  out.push(outroSvg());
  return out;
}

export async function renderCards(draft, outDir) {
  await mkdir(outDir, { recursive: true });
  const svgs = await buildCardSvgs(draft);
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
