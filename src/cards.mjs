import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { T, FONT_FILES, CARD, IG_HANDLE } from "./theme.mjs";
import { dataUri } from "./images.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// 글자수 기준 줄바꿈. 공백 우선, 없으면 강제 절단.
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
    <stop offset="0" stop-color="${T.bg}" stop-opacity="0.30"/>
    <stop offset="0.40" stop-color="${T.bg}" stop-opacity="0.40"/>
    <stop offset="0.60" stop-color="${T.bg}" stop-opacity="0.92"/>
    <stop offset="1" stop-color="${T.bg}" stop-opacity="1"/>
  </linearGradient>
</defs>
<rect width="${CARD.w}" height="${CARD.h}" fill="${T.bg}"/>
${bg}
${bodyInner}
</svg>`;
}

async function coverSvg(draft) {
  const uri = draft.coverImage ? await dataUri(draft.coverImage) : null;
  const teaser = wrap(draft.issues?.[0]?.headline ?? "", 18, 2);
  return shell(
    `
<text x="${M}" y="150" font-family="${T.body}" font-weight="800" font-size="30" letter-spacing="6" fill="${T.accent}">TREND · CONSUMER</text>
<text x="${CARD.w - M}" y="150" text-anchor="end" font-family="${T.body}" font-weight="700" font-size="30" fill="${T.sub}">${esc(draft.date ?? "")}</text>

<text x="${M}" y="890" font-family="${T.display}" font-size="112" fill="${T.ink}">오늘의</text>
<text x="${M}" y="1010" font-family="${T.display}" font-size="112" fill="${T.ink}">소비 트렌드</text>
<text x="${M}" y="1148" font-family="${T.display}" font-size="146" fill="${T.accent}">이슈 5</text>

<text x="${M}" y="1250" font-family="${T.body}" font-weight="700" font-size="27" fill="${T.sub}">밀어서 5개 모두 보기 →</text>
<text x="${CARD.w - M}" y="1250" text-anchor="end" font-family="${T.body}" font-weight="800" font-size="27" fill="${T.ink}">${esc(IG_HANDLE)}</text>
`,
    uri
  );
}

async function issueSvg(issue, rank, draft, isLast) {
  const uri = issue.image ? await dataUri(issue.image) : null;
  const head = wrap(issue.headline ?? "", 17, 3);

  const headTop = 610;
  const headLH = 72;
  const ruleY = headTop + headLH * (head.length - 1) + 40;

  // 우선순위: 헤드라인 → why_trend(훅) → 요약. 아래 여백 예산 안에서만 채운다.
  let y = ruleY + 62;
  let body = "";

  if (issue.why_trend) {
    const wt = wrap(issue.why_trend, 21, 2);
    body += `<rect x="${M}" y="${y - 34}" width="8" height="${43 * wt.length}" fill="${T.accent}"/>`;
    body += `<text x="${M + 30}" y="${y}" font-family="${T.body}" font-weight="800" font-size="31" letter-spacing="-0.5" fill="${T.ink}">${tspans(wt, M + 30, 43)}</text>`;
    y += 43 * wt.length + 40;
  }

  const BUDGET = 1150;
  for (const s of issue.summary ?? []) {
    const w = wrap(s, 25, 2);
    const need = 43 * w.length + 24;
    if (y + need > BUDGET) break;
    body += `<text x="${M}" y="${y}" font-family="${T.body}" font-weight="600" font-size="29" letter-spacing="-0.5" fill="${T.sub}">${tspans(w, M, 43)}</text>`;
    y += need;
  }

  const src = (issue.sources ?? []).join(", ") || "출처 미상";
  const srcY = Math.min(Math.max(y + 34, 1150), 1192);
  const footer = isLast
    ? `<text x="${M}" y="1262" font-family="${T.body}" font-weight="800" font-size="28" fill="${T.ink}">저장하고 팔로우 <tspan fill="${T.accent}">${esc(IG_HANDLE)}</tspan></text>`
    : `<text x="${CARD.w - M}" y="1262" text-anchor="end" font-family="${T.body}" font-weight="800" font-size="25" fill="${T.sub}">${esc(IG_HANDLE)}</text>`;

  return shell(
    `
<text x="${M}" y="250" font-family="${T.display}" font-size="140" fill="${T.accent}">${String(rank).padStart(2, "0")}</text>
<text x="${CARD.w - M}" y="150" text-anchor="end" font-family="${T.body}" font-weight="700" font-size="25" fill="${T.sub}">오늘의 소비 트렌드 · ${esc(draft.date ?? "")}</text>

<text x="${M}" y="${headTop}" font-family="${T.display}" font-size="53" fill="${T.ink}">${tspans(head, M, headLH)}</text>
<rect x="${M}" y="${ruleY}" width="${CARD.w - 2 * M}" height="3" fill="${T.line}"/>
${body}
<text x="${M}" y="${srcY}" font-family="${T.body}" font-weight="800" font-size="26" fill="${T.accent}">출처 · ${esc(src)}</text>
${footer}
`,
    uri
  );
}

export async function buildCardSvgs(draft) {
  const issues = (draft.issues ?? []).slice(0, 5);
  const out = [await coverSvg(draft)];
  for (let i = 0; i < issues.length; i++) {
    out.push(await issueSvg(issues[i], i + 1, draft, i === issues.length - 1));
  }
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
