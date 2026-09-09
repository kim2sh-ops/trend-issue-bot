# trend-issue-bot

매일 저녁, 오늘의 **트렌드·소비 이슈 5개**를 수집·정리하고 **카드뉴스 6장 + 스토리 + 릴스**를 만들어
**텔레그램으로** 보내주는 봇. 인스타 카드뉴스/릴스 계정용.

```
수집(RSS) → Claude 이슈 5개 선정·정리 → Pexels 이미지 → 카드·스토리·릴스 렌더
→ 텔레그램으로 (초안 + 캡션 + 미리보기 앨범 + 원본 파일 + 릴스 영상)
→ 폰에서 저장해 인스타에 직접 업로드
```

인스타 자동 발행은 **안 함** — Meta API 심사·인증 벽이 크고 자동 포스팅 봇은 차단 위험이 있어서
반자동(텔레그램에서 저장 → 앱에서 업로드)으로 운영. 대신 릴스에 트렌딩 사운드를 직접 붙일 수 있음.

## 흐름

| 파일 | 역할 |
|---|---|
| `src/sources.mjs` | 구글 트렌드 KR + 연합뉴스(경제·산업·문화·연예·생활·세계) + 이티뉴스 RSS 수집 |
| `src/write.mjs` | Claude(Sonnet 5) 1콜: 이슈 7개 생성 → 필터 후 상위 5개 → JSON |
| `src/images.mjs` | Pexels 이슈별 세로 이미지 |
| `src/cards.mjs` | 초안 → SVG → PNG 6장 (이슈 5 + 팔로우 아웃트로), `@resvg/resvg-js` |
| `src/reelcards.mjs` | 릴스 프레임 + 스토리 티저 |
| `src/reel.mjs` | 프레임 → 세로 슬라이드쇼 mp4, `assets/audio/` 에 mp3 넣으면 배경음 |
| `src/render.mjs` | 렌더 오케스트레이션 (`node src/render.mjs <draft.json>` 로 재렌더) |
| `src/telegram.mjs` | 텍스트·앨범·문서·영상 전송 |
| `src/run.mjs` | 전체 오케스트레이션 |
| `.github/workflows/daily.yml` | 매일 19:00 KST 자동 실행 |
| `assets/fonts/` | Black Han Sans, Gothic A1 (렌더용, 커밋됨) |

## 1. 로컬 세팅

```bash
cd ~/Desktop/trend-issue-bot
npm install
cp .env.example .env      # ANTHROPIC_API_KEY, TELEGRAM_*, PEXELS_API_KEY, IG_HANDLE
```

## 2. 실행

```bash
npm run collect   # 수집 결과만 확인 (Claude·렌더·텔레그램 안 함, 키 불필요)
npm run draft     # 전체: 수집 → 생성 → 렌더 → 텔레그램 전송
npm test          # 단위 테스트 (파싱 + 실제 PNG/MP4 렌더)

node src/run.mjs --no-render                  # 텍스트 초안만 (렌더 생략)
node src/render.mjs out/2026-09-09/draft.json # 저장된 초안으로 렌더만 다시
```

렌더 결과물은 `out/<날짜>/` 에 저장 (git 제외).

## 3. GitHub Actions 자동화

레포 **Settings > Secrets and variables > Actions** 에 시크릿 5개:
`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PEXELS_API_KEY`, `IG_HANDLE`

이후 매일 19:00 KST 자동 실행 → 폰으로 도착. 수동 실행은 Actions 탭 → `daily-draft` → Run workflow.

## 매일 하는 일 (사람)

1. 텔레그램에서 초안·미리보기 확인
2. **원본 파일 앨범**에서 카드 6장 + 스토리 저장
3. **릴스 영상** 저장
4. 인스타 앱: 캐러셀 6장 + 릴스(+트렌딩 사운드) + 스토리 업로드, 캡션 복붙

## 비용

Claude Sonnet 5 하루 1콜 ≈ 월 $2.5. GitHub Actions(공개 레포)·텔레그램·Pexels·RSS 는 무료.

## 커스터마이징

- **피드**: `src/sources.mjs` 상단 `FEEDS` 배열
- **부적합 필터**: `src/write.mjs` 의 `BANNED` 정규식 + SYSTEM 프롬프트
- **디자인 색·폰트**: `src/theme.mjs` 의 `T`
- **릴스 배경음**: `assets/audio/` 에 mp3 파일 하나
