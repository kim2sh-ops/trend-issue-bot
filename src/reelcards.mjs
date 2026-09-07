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

async function issueFrame(issue, rank, draft) {
  const uri = issue.image ? await dataUri(issue.image) : null;
  const head = wrap(displaySafe(issue.headline), 13, 3, "");
  const punch = wrap(issue.reel_line || issue.why_trend || "", 18, 2);
  const src = (issue.sources ?? []).join(", ");

  // 1번 프레임엔 어그로 후킹 문구 (스크롤 멈추게), 번호는 생략
  const hookLines = rank === 1 && draft?.hook ? wrap(displaySafe(draft.hook), 12, 2, "") : [];
  const marker = hookLines.length
    ? `<rect x="${M}" y="210" width="90" height="12" fill="${T.accent}"/>
       <text x="${M}" y="340" font-family="${T.displayStack}" font-size="82" fill="${T.accent}">${tspans(hookLines, M, 100)}</text>`
    : `<text x="${M}" y="360" font-family="${T.displayStack}" font-size="170" fill="${T.accent}">${String(rank).padStart(2, "0")}</text>`;

  const headY = hookLines.length ? 340 + 100 * hookLines.length + 130 : 560;
  let y = headY;
  let inner = `<text x="${M}" y="${y}" font-family="${T.displayStack}" font-size="82" fill="${T.ink}">${tspans(head, M, 100)}</text>`;
  y += 100 * (head.length - 1) + 60;

  inner += `<rect x="${M}" y="${y}" width="120" height="10" fill="${T.accent}"/>`;
  y += 100;
  inner += `<text x="${M}" y="${y}" font-family="${T.body}" font-weight="800" font-size="44" letter-spacing="-0.5" fill="${T.ink}">${tspans(punch, M, 58)}</text>`;
  y += 58 * punch.length + 70;

  for (const s of (issue.summary ?? []).slice(0, 3)) {
    const w = wrap(s, 22, 2);
    if (y + 52 * w.length > 1700) break;
    inner += `<text x="${M}" y="${y}" font-family="${T.body}" font-weight="600" font-size="36" letter-spacing="-0.5" fill="${T.sub}">${tspans(w, M, 52)}</text>`;
    y += 52 * w.length + 26;
  }

  return shell(
    `${marker}
${inner}
<text x="${M}" y="1830" font-family="${T.body}" font-weight="700" font-size="30" fill="${T.sub}">출처 · ${esc(src)}</text>`,
    uri
  );
}

function outroFrame() {
  return shell(
    `<text x="${M}" y="720" font-family="${T.body}" font-weight="800" font-size="34" letter-spacing="8" fill="${T.accent}">FOLLOW</text>
<text x="${M}" y="880" font-family="${T.displayStack}" font-size="108" fill="${T.ink}">팔로우하고</text>
<text x="${M}" y="1010" font-family="${T.displayStack}" font-size="108" fill="${T.ink}">매일 다양한 이슈</text>
<text x="${M}" y="1140" font-family="${T.displayStack}" font-size="108" fill="${T.accent}">확인하세요</text>
<text x="${M}" y="1280" font-family="${T.body}" font-weight="800" font-size="40" fill="${T.ink}">${esc(IG_HANDLE)}</text>
<text x="${M}" y="1336" font-family="${T.body}" font-weight="600" font-size="28" fill="${T.sub}">매일 저녁 7시 · 소비·트렌드 이슈 5</text>`,
    null
  );
}

// 스토리용 티저 이미지 1장 (피드 카드뉴스로 유도)
async function storyFrame(draft) {
  const uri = draft.coverImage ? await dataUri(draft.coverImage) : null;
  const teaser = wrap(displaySafe(draft.issues?.[0]?.headline), 16, 2, "");
  return shell(
    `<text x="${M}" y="720" font-family="${T.body}" font-weight="800" font-size="32" letter-spacing="8" fill="${T.accent}">NEW · ${esc(draft.date ?? "")}</text>
<text x="${M}" y="870" font-family="${T.displayStack}" font-size="118" fill="${T.ink}">오늘의</text>
<text x="${M}" y="1000" font-family="${T.displayStack}" font-size="118" fill="${T.ink}">소비 트렌드</text>
<text x="${M}" y="1160" font-family="${T.displayStack}" font-size="168" fill="${T.accent}">이슈 5</text>
<text x="${M}" y="1290" font-family="${T.body}" font-weight="700" font-size="36" fill="${T.ink}">${tspans(teaser, M, 50)}</text>
<text x="${M}" y="1470" font-family="${T.body}" font-weight="800" font-size="34" fill="${T.sub}">새 카드뉴스 → 피드에서 전체 보기</text>`,
    uri
  );
}

export async function renderStory(draft, outDir) {
  await mkdir(outDir, { recursive: true });
  const png = new Resvg(await storyFrame(draft), {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: T.body },
    fitTo: { mode: "width", value: REEL.w },
  })
    .render()
    .asPng();
  const p = join(outDir, "story.png");
  await writeFile(p, png);
  return p;
}

export async function renderReelFrames(draft, outDir) {
  await mkdir(outDir, { recursive: true });
  const issues = (draft.issues ?? []).slice(0, 5);
  const svgs = [];
  for (let i = 0; i < issues.length; i++) svgs.push(await issueFrame(issues[i], i + 1, draft));
  svgs.push(outroFrame());

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
