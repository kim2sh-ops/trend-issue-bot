# trend-issue-bot

매일 저녁, 오늘의 **트렌드·소비 이슈 5개**를 수집·정리하고 **카드뉴스 6장 + 릴스 영상**을 만들어
**텔레그램으로** 보내주는 봇. 인스타 카드뉴스/릴스 계정용. **인스타 자동 발행은 아직 없음**(3주차 예정).

```
수집(RSS) → Claude 이슈 5개 선정·정리 → 카드 PNG 6장 + 릴스 mp4 렌더 → 텔레그램으로 초안+이미지+영상
```

## 흐름

| 파일 | 역할 |
|---|---|
| `src/sources.mjs` | 구글 트렌드 KR + 연합뉴스(경제·산업·문화) RSS 수집 |
| `src/write.mjs` | Claude API 1콜: 소비·트렌드 이슈 5개 선정 → JSON |
| `src/cards.mjs` | 초안 → SVG → PNG 6장 (커버 + 이슈 5), `@resvg/resvg-js` |
| `src/reel.mjs` | 카드 6장 → 세로 슬라이드쇼 mp4 (무음), `ffmpeg-static` |
| `src/render.mjs` | 렌더 오케스트레이션 (`node src/render.mjs <draft.json>` 로 재렌더) |
| `src/telegram.mjs` | 텍스트·앨범·영상 전송 (평문) |
| `src/run.mjs` | 전체 오케스트레이션 |
| `.github/workflows/daily.yml` | 매일 19:00 KST 자동 실행 |
| `assets/fonts/` | Black Han Sans, Gothic A1 (렌더용, 커밋됨) |

## 1. 로컬 세팅

```bash
cd ~/Desktop/trend-issue-bot
npm install
cp .env.example .env      # 값 채우기 (아래)
```

### .env 채우기

- **ANTHROPIC_API_KEY** — console.anthropic.com > API Keys
- **TELEGRAM_BOT_TOKEN** — 텔레그램에서 `@BotFather` 검색 → `/newbot` → 이름·아이디 정하면 토큰 발급
- **TELEGRAM_CHAT_ID** — 방금 만든 봇에게 아무 메시지나 한 번 보낸 뒤:
  ```bash
  curl "https://api.telegram.org/bot<봇토큰>/getUpdates"
  ```
  응답 JSON의 `message.chat.id` 값 (본인 DM이면 양수)

## 2. 실행

```bash
npm run collect   # 수집 결과만 확인 (Claude·렌더·텔레그램 안 함, 키 불필요)
npm run draft     # 전체: 수집 → 생성 → 카드·릴스 렌더 → 텔레그램 전송
npm test          # 단위 테스트 (파싱 + 실제 PNG/MP4 렌더)

node src/run.mjs --no-render                 # 텍스트 초안만 (렌더 생략)
node src/render.mjs out/2026-09-08/draft.json # 저장된 초안으로 렌더만 다시
```

렌더 결과물은 `out/<날짜>/` 에 저장됩니다 (git 에는 안 올라감).

## 3. GitHub Actions 자동화

1. 이 폴더를 GitHub 레포로 push
2. 레포 **Settings > Secrets and variables > Actions** 에 추가:
   `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
3. **Actions** 탭에서 워크플로 활성화. `daily-draft` → `Run workflow` 로 즉시 테스트
4. 이후 매일 19:00 KST 자동 실행 → 폰으로 초안 도착

## 비용

Claude Haiku 4.5 하루 1콜 (입력 ~5k / 출력 ~2k 토큰) ≈ 월 1달러 미만.
GitHub Actions·텔레그램·RSS 는 무료.

## 다음 단계 (아직 안 만듦)

- 3주차: 에셋 공개 호스팅 + 텔레그램에 "합격" 이라고 답하면 → Instagram Graph API 자동 발행
  - 필요: 인스타 프로페셔널 계정 + Meta 앱 + 장기 액세스 토큰
- 릴스 배경음(저작권프리), 자막 애니메이션 (선택)

## 피드 바꾸기

`src/sources.mjs` 상단 `FEEDS` 배열만 수정. `type: "trends"` 는 구글 트렌드 형식, `type: "rss"` 는 표준 RSS.
