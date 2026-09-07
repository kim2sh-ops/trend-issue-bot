import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";
import { REEL, T } from "./theme.mjs";

// ffmpeg-static 바이너리가 없으면(CI 등) 시스템 ffmpeg 사용
const ffmpegPath = ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg";

const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "audio");
const PER = 5.4; // 슬라이드당 노출 시간(초) — 설명 글 읽을 시간
const XF = 0.5; // 크로스페이드(초)
const MUSIC_VOL = 0.16; // 배경음 볼륨

// assets/audio/ 에서 첫 저작권프리 음원을 찾는다. 없으면 null → 무음 릴스.
function findMusic() {
  try {
    const f = readdirSync(AUDIO_DIR).find((x) => /\.(mp3|m4a|aac|wav|ogg)$/i.test(x));
    return f ? join(AUDIO_DIR, f) : null;
  } catch {
    return null;
  }
}

// 카드 PNG들을 1080x1920 세로 슬라이드쇼 mp4로 이어붙인다 (크로스페이드, 배경음).
export async function renderReel(cardPaths, outDir) {
  const out = join(outDir, "reel.mp4");
  const n = cardPaths.length;
  const bg = "0x" + T.bg.replace("#", "");
  const dur = n * PER - (n - 1) * XF; // 총 길이(초)
  const music = findMusic();

  const inputs = [];
  for (const p of cardPaths) inputs.push("-loop", "1", "-t", String(PER), "-i", p);
  if (music) inputs.push("-stream_loop", "-1", "-i", music);

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
  if (music) {
    const fadeOut = Math.max(0, dur - 1.8);
    parts.push(
      `[${n}:a]volume=${MUSIC_VOL},afade=t=in:d=1,afade=t=out:st=${fadeOut.toFixed(2)}:d=1.8,` +
        `atrim=0:${dur.toFixed(2)},asetpts=PTS-STARTPTS[aout]`
    );
  }

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    parts.join(";"),
    "-map",
    n > 1 ? "[vout]" : "[v0]",
    ...(music ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "128k", "-shortest"] : []),
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

// PNG → JPEG (인스타 이미지 업로드는 JPEG 만 받음)
export async function toJpeg(pngPath) {
  const out = pngPath.replace(/\.png$/i, ".jpg");
  await run(ffmpegPath, ["-y", "-i", pngPath, "-qscale:v", "3", out]);
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
