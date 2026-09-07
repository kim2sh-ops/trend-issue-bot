import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { T, FONT_FILES, REEL, IG_HANDLE } from "./theme.mjs";
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

function wrap(text, maxChars, maxLines, ell = "…") {
  let rest = String(text ?? "").trim();
  const lines = [];
  while (rest.length && lines.length < maxLines) {
    if (rest.length <= maxChars) return (lines.push(rest), lines);
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.55) cut = maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars - ell.length) + ell;
  return lines;
}
const tspans = (lines, x, lh) =>
  lines.map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(ln)}</tspan>`).join("");

function shell(inner, uri) {
  const bg = uri
    ? `<image href="${uri}" x="0" y="0" width="${REEL.w}" height="${REEL.h}" preserveAspectRatio="xMidYMid slice"/>
       <rect width="${REEL.w}" height="${REEL.h}" fill="${T.bg}" fill-opacity="0.84"/>`
    : `<rect width="${REEL.w}" height="${REEL.h}" fill="${T.bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${REEL.w}" height="${REEL.h}" viewBox="0 0 ${REEL.w} ${REEL.h}">
<rect width="${REEL.w}" height="${REEL.h}" fill="${T.bg}"/>
${bg}
${inner}
</svg>`;
}

const M = 110;

async function coverFrame(draft) {
  const uri = draft.coverImage ? await dataUri(draft.coverImage) : null;
  return shell(
    `<text x="${M}" y="760" font-family="${T.body}" font-weight="800" font-size="34" letter-spacing="7" fill="${T.accent}">${esc(draft.date ?? "")}</text>
<text x="${M}" y="900" font-family="${T.displayStack}" font-size="120" fill="${T.ink}">오늘의</text>
<text x="${M}" y="1030" font-family="${T.displayStack}" font-size="120" fill="${T.ink}">소비 트렌드</text>
<text x="${M}" y="1190" font-family="${T.displayStack}" font-size="170" fill="${T.accent}">이슈 5</text>
<text x="${M}" y="1320" font-family="${T.body}" font-weight="800" font-size="30" fill="${T.sub}">${esc(IG_HANDLE)}</text>`,
    uri
  );
}

async function issueFrame(issue, rank) {
  const uri = issue.image ? await dataUri(issue.image) : null;
  const head = wrap(displaySafe(issue.headline), 13, 3, "");
  const line = wrap(issue.reel_line || issue.why_trend || "", 20, 2);
  const src = (issue.sources ?? []).join(", ");
  const headY = 660;
  const afterHead = headY + 108 * (head.length - 1);

  return shell(
    `<text x="${M}" y="430" font-family="${T.displayStack}" font-size="220" fill="${T.accent}">${String(rank).padStart(2, "0")}</text>
<text x="${M}" y="${headY}" font-family="${T.displayStack}" font-size="88" fill="${T.ink}">${tspans(head, M, 108)}</text>
<rect x="${M}" y="${afterHead + 66}" width="120" height="10" fill="${T.accent}"/>
<text x="${M}" y="${afterHead + 200}" font-family="${T.body}" font-weight="800" font-size="46" letter-spacing="-0.5" fill="${T.ink}">${tspans(line, M, 62)}</text>
<text x="${M}" y="1790" font-family="${T.body}" font-weight="700" font-size="30" fill="${T.sub}">출처 · ${esc(src)}</text>`,
    uri
  );
}

export async function renderReelFrames(draft, outDir) {
  await mkdir(outDir, { recursive: true });
  const issues = (draft.issues ?? []).slice(0, 5);
  const svgs = [await coverFrame(draft)];
  for (let i = 0; i < issues.length; i++) svgs.push(await issueFrame(issues[i], i + 1));

  const paths = [];
  for (let i = 0; i < svgs.length; i++) {
    const png = new Resvg(svgs[i], {
      font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: T.body },
      fitTo: { mode: "width", value: REEL.w },
    })
      .render()
      .asPng();
    const p = join(outDir, `reel-${String(i + 1).padStart(2, "0")}.png`);
    await writeFile(p, png);
    paths.push(p);
  }
  return paths;
}
