import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const KEY = process.env.PEXELS_API_KEY;

// Pexels 에서 세로 이미지 1장을 받아 로컬에 저장. 키 없거나 실패하면 null (카드가 이미지 없이 렌더됨).
export async function fetchImage(query, dir, tag, w = 1080, h = 1350) {
  if (!KEY || !query) return null;
  await mkdir(dir, { recursive: true });
  const out = join(dir, `img-${tag}.jpg`);
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait&size=medium`,
      { headers: { Authorization: KEY }, signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) return null;
    const photo = (await r.json()).photos?.[0];
    if (!photo) return null;

    const base = photo.src.large2x.split("?")[0];
    const url = `${base}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;
    const img = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!img.ok) return null;

    await writeFile(out, Buffer.from(await img.arrayBuffer()));
    return { path: out, credit: photo.photographer, source: photo.url };
  } catch {
    return null;
  }
}

export async function dataUri(path) {
  return `data:image/jpeg;base64,${(await readFile(path)).toString("base64")}`;
}

// 초안의 커버 + 이슈별 이미지를 병렬로 확보. 각 이슈 객체에 image / imageCredit 를 채워 넣는다.
export async function attachImages(draft, dir) {
  const jobs = [
    fetchImage(draft.cover_image_query || draft.issues?.[0]?.image_query, dir, "cover").then((r) => {
      draft.coverImage = r?.path ?? null;
      if (r) creditPush(draft, r.credit);
    }),
    ...(draft.issues ?? []).map((it, i) =>
      fetchImage(it.image_query, dir, `${i + 1}`).then((r) => {
        it.image = r?.path ?? null;
        if (r) creditPush(draft, r.credit);
      })
    ),
  ];
  await Promise.allSettled(jobs);
  return draft;
}

function creditPush(draft, name) {
  if (!name) return;
  draft._credits = draft._credits || [];
  if (!draft._credits.includes(name)) draft._credits.push(name);
}
