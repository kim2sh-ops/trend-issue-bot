// 인스타 장기 액세스 토큰을 갱신하고 GitHub 시크릿(IG_ACCESS_TOKEN)을 업데이트한다.
// GitHub Actions 에서 매월 실행. 로컬 실행 불가 (gh CLI + GH_PAT 필요).

import { execFileSync } from "node:child_process";
import { sendText } from "./telegram.mjs";

const token = process.env.IG_ACCESS_TOKEN;
if (!token) {
  console.error("IG_ACCESS_TOKEN 없음");
  process.exit(1);
}

const r = await fetch(
  `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
  { signal: AbortSignal.timeout(20000) }
);
const j = await r.json().catch(() => ({}));

if (!r.ok || !j.access_token) {
  const msg = j.error?.message || `HTTP ${r.status}`;
  console.error("갱신 실패:", msg);
  // "24시간 미만" 은 갱신 대상이 아직 아님 — 알림 안 보냄
  if (!/24 hours|too new/i.test(msg)) {
    await sendText(`⚠️ 인스타 토큰 자동 갱신 실패: ${msg}\n토큰이 만료됐을 수 있습니다. Meta 앱에서 수동 재발급 후 GitHub 시크릿 IG_ACCESS_TOKEN 을 교체하세요.`);
  }
  process.exit(1);
}

const days = Math.round((j.expires_in || 0) / 86400);

if (!process.env.GH_PAT) {
  console.error("GH_PAT 없음 — 시크릿 업데이트 불가");
  process.exit(1);
}
execFileSync("gh", ["secret", "set", "IG_ACCESS_TOKEN"], {
  input: j.access_token,
  env: { ...process.env, GH_TOKEN: process.env.GH_PAT },
  stdio: ["pipe", "inherit", "inherit"],
});

await sendText(`인스타 토큰 자동 갱신 완료 (${days}일 유효)`);
console.log(`갱신 성공, ${days}일 유효`);
