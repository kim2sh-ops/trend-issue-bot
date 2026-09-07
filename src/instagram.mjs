// Instagram Content Publishing (Instagram Login API, graph.instagram.com)
// 공개 URL 로 된 이미지(JPEG)·영상(MP4)만 받는다. 파일 직접 업로드 불가.

const BASE = "https://graph.instagram.com/v21.0";

function creds() {
  const id = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!id || !token) throw new Error("IG_USER_ID / IG_ACCESS_TOKEN 미설정");
  return { id, token };
}

async function post(path, params) {
  const { token } = creds();
  const r = await fetch(`${BASE}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: token }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`IG POST ${path}: ${j.error?.message || r.status}`);
  return j;
}

async function get(path) {
  const { token } = creds();
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${BASE}/${path}${sep}access_token=${token}`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`IG GET ${path}: ${j.error?.message || r.status}`);
  return j;
}

// 컨테이너가 처리 완료될 때까지 대기 (영상은 트랜스코딩 시간 필요)
async function waitReady(containerId, { tries = 30, delayMs = 4000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const s = await get(`${containerId}?fields=status_code,status`);
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`컨테이너 ${containerId} ${s.status_code}: ${s.status || ""}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`컨테이너 ${containerId} 처리 시간 초과`);
}

async function publishContainer(creationId) {
  const { id } = creds();
  return (await post(`${id}/media_publish`, { creation_id: creationId })).id;
}

export async function publishCarousel(imageUrls, caption) {
  const { id } = creds();
  const children = [];
  for (const url of imageUrls.slice(0, 10)) {
    const c = await post(`${id}/media`, { image_url: url, is_carousel_item: "true" });
    children.push(c.id);
  }
  const container = await post(`${id}/media`, {
    media_type: "CAROUSEL",
    caption: caption ?? "",
    children: children.join(","),
  });
  await waitReady(container.id);
  return publishContainer(container.id);
}

export async function publishReel(videoUrl, caption) {
  const { id } = creds();
  const c = await post(`${id}/media`, { media_type: "REELS", video_url: videoUrl, caption: caption ?? "" });
  await waitReady(c.id, { tries: 40, delayMs: 5000 });
  return publishContainer(c.id);
}

export async function publishStory(mediaUrl, { video = false } = {}) {
  const { id } = creds();
  const c = await post(`${id}/media`, {
    media_type: "STORIES",
    ...(video ? { video_url: mediaUrl } : { image_url: mediaUrl }),
  });
  await waitReady(c.id, { tries: 40, delayMs: 5000 });
  return publishContainer(c.id);
}

export async function checkAuth() {
  const me = await get("me?fields=user_id,username,account_type");
  const limit = await get(`${creds().id}/content_publishing_limit?fields=quota_usage,config`);
  return { ...me, quota: limit.data?.[0] };
}
