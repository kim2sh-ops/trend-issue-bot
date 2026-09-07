import { spawn } from "node:child_process";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "node:fs";
import { REEL, T } from "./theme.mjs";

// ffmpeg-static 바이너리가 없으면(CI 등) 시스템 ffmpeg 사용
const ffmpegPath = ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg";

const PER = 4.6; // 슬라이드당 노출 시간(초)
const XF = 0.5; // 크로스페이드(초)

// 카드 PNG들을 1080x1920 세로 슬라이드쇼 mp4로 이어붙인다 (무음, 크로스페이드).
export async function renderReel(cardPaths, outDir) {
  const out = join(outDir, "reel.mp4");
  const n = cardPaths.length;
  const bg = "0x" + T.bg.replace("#", "");

  const inputs = [];
  for (const p of cardPaths) inputs.push("-loop", "1", "-t", String(PER), "-i", p);

  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(
      `[${i}:v]scale=${REEL.w}:${REEL.h}:force_original_aspect_ratio=decrease,` +
        `pad=${REEL.w}:${REEL.h}:(ow-iw)/2:(oh-ih)/2:color=${bg},` +
        `setsar=1,fps=25,format=yuv420p[v${i}]`
    );
  }

  let last = "v0";
  let offset = PER - XF;
  for (let i = 1; i < n; i++) {
    const tag = i === n - 1 ? "vout" : `x${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}[${tag}]`);
    last = tag;
    offset += PER - XF;
  }

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    parts.join(";"),
    "-map",
    n > 1 ? "[vout]" : "[v0]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-r",
    "25",
    out,
  ];

  await run(ffmpegPath, args);
  return out;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg 종료코드 ${code}\n${err.slice(-1800)}`))
    );
  });
}
