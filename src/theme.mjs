import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const FONT_DIR = join(ROOT, "assets", "fonts");
export const OUT_DIR = join(ROOT, "out");

export const FONT_FILES = [
  join(FONT_DIR, "BlackHanSans-Regular.ttf"),
  join(FONT_DIR, "GothicA1-Regular.ttf"),
  join(FONT_DIR, "GothicA1-Bold.ttf"),
  join(FONT_DIR, "GothicA1-Black.ttf"),
];

// 트렌드·소비 계정 비주얼 아이덴티티 (다크). 색/폰트는 여기만 고치면 전체 반영.
export const T = {
  bg: "#0E1220", // 딥 네이비차콜
  panel: "#141A2E", // 텍스트가 앉는 하단 패널
  ink: "#F5F6FB",
  sub: "#AAB0C6",
  accent: "#5B8CFF", // 다크 배경에서 잘 보이는 밝은 블루
  onAccent: "#0E1220",
  line: "#2B3450",
  display: "Black Han Sans",
  body: "Gothic A1",
};

export const CARD = { w: 1080, h: 1350 };
export const REEL = { w: 1080, h: 1920 };

export const IG_HANDLE = process.env.IG_HANDLE || "@my_trend_account";
