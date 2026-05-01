# Shorts 자동화 서비스

뉴스 수집 → AI 스크립트 → TTS + 이미지 → 영상 합성 → 유튜브 업로드 자동화 서비스.
자세한 기획: [plan.md](plan.md) / 에이전트 설계: [agent.md](agent.md)

---

## 현재 단계: Phase 1 (로컬 PC)

PC에서 전체 파이프라인을 먼저 완성한 뒤 클라우드로 전환.

| 역할 | 로컬 스택 | 클라우드 전환 시 |
|------|---------|--------------|
| DB | SQLite (`data/db.sqlite`) | Supabase |
| 스케줄러 | APScheduler (Python 백그라운드) | GitHub Actions |
| 영상 합성 | ffmpeg + Python | Remotion + Lambda |
| 파일 저장 | `data/` 폴더 | Cloudflare R2 |
| 대시보드 | Next.js localhost:3000 | Vercel |
| 업로드 | Python 스크립트 직접 실행 | GitHub Actions |

---

## 디렉토리 구조

```
shorts/
├── CLAUDE.md
├── plan.md
├── agent.md
├── .env                  ← API 키 (gitignore됨)
├── .env.example          ← 키 목록 (커밋됨)
│
├── crawler/              ← Python 크롤러 + 스케줄러
│   ├── main.py           ← 진입점 (python crawler/main.py로 실행)
│   ├── sources/
│   │   ├── naver.py      ← 네이버 뉴스 API
│   │   └── rss.py        ← RSS 파싱 (국방일보 등)
│   ├── metrics.py        ← 반응 속도 계산
│   ├── alert.py          ← 텔레그램 알람
│   ├── scheduler.py      ← APScheduler 설정
│   └── requirements.txt
│
├── dashboard/            ← Next.js 대시보드
│   ├── app/
│   │   ├── page.tsx      ← Kanban 보드 메인
│   │   ├── articles/[id]/
│   │   ├── settings/
│   │   └── api/
│   ├── components/
│   └── lib/
│       ├── db.ts         ← SQLite 접근 (better-sqlite3)
│       └── ai/           ← AI 프로바이더 추상화
│
├── video/                ← 영상 합성 (ffmpeg)
│   ├── compose.py        ← 영상 합성 진입점
│   └── templates/        ← 영상 레이아웃 템플릿
│
└── data/                 ← 로컬 데이터 (gitignore됨)
    ├── db.sqlite
    ├── images/
    ├── audio/
    └── videos/
```

---

## 개발 원칙

1. **API 키는 `.env`에서만** — 코드에 하드코딩 금지. DB의 `api_keys` 테이블에서 순환 사용.
2. **카테고리·채널·AI 프로바이더는 DB에서 동적 조회** — 코드 수정 없이 추가 가능.
3. **영상 메타데이터에 사용 AI 서비스·모델명 기록** — 성과 분석 시 어떤 AI가 더 잘됐는지 비교.
4. **외부 API 실패 시 다음 키로 자동 전환** — `api_keys` 테이블의 `error_count` 활용.
5. **이탈률 52% 개선이 최우선** — 첫 3초 훅, 자막 60px+, 9:16 세로형 최적화.
6. **SQLite WAL 모드 사용** — 크롤러(쓰기)와 대시보드(읽기) 동시 접근 충돌 방지.

---

## 주요 명령어

```bash
# 크롤러 실행 (1회)
cd crawler && python main.py --once

# 크롤러 스케줄러 실행 (백그라운드, 1시간마다)
cd crawler && python main.py

# 대시보드 실행
cd dashboard && npm run dev   # localhost:3000

# 영상 합성 (article_id 지정)
python video/compose.py --id <article_id>
```

---

## DB 스키마 변경 시

`crawler/migrations/` 폴더에 SQL 파일 추가:
```
migrations/
  001_init.sql
  002_add_ab_tests.sql   ← 변경 사항마다 새 파일
```

---

## 타겟 전략

- **핵심 시청자**: 40~60대 한국 남성
- **카테고리**: 방산/국방 (1단계) → 국제/정치, 반도체/AI, 주식/금융, 개그 순 확장
- **숏츠 = 채널 성장 도구** (RPM $0.02~0.15, 수익보다 구독자 확보 목적)
- **글로벌 확장**: K-Defense는 영어권 고CPM 부적합 → AI/기술/지정학으로 피벗

---

## 환경변수 (.env)

전체 목록은 `.env.example` 참고.
핵심 키:
```
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```
