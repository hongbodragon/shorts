# 뉴스 기반 유튜브 숏츠 자동화 서비스 플랜

> 뉴스를 자동으로 수집·분석해 유튜브 숏츠를 만들고 포스팅하는 서비스
> 현재: 방산/국방 채널. 이후 카테고리·채널·국가 확장 구조 설계

---

## 0. 전략 방향

### 핵심 타겟
- **40~60대 한국 남성** (방산/군사 채널 구독자의 약 70%가 45~54세 남성)
- AI 생성 콘텐츠 감별력이 낮고, 뉴스/시사 관심도가 높으며, 댓글 참여도가 활발한 계층

### 숏츠 포지셔닝
- 숏츠 RPM: $0.02~0.15 (일반 영상의 1/10~1/20) → **채널 성장 도구**
- 수익은 나중에 롱폼 또는 유료 구독으로 확보
- 피드 발견이 97%+ → 첫 3초 훅과 이탈률 개선이 핵심

### 실제 영상 데이터 (첫 번째 방산 숏츠)
```
조회수: 1,400 / 유효조회수: 579 / 좋아요: 38 / 신규 구독: 6
디바이스: 모바일 86.6% / 컴퓨터 6.9% / 태블릿 6% / TV 0.5%
계속 시청: 47.6% / 이탈: 52.4%
유입: Shorts 피드 97.9%
```
→ 이탈률 52% 개선 = 가장 중요한 초기 과제

### 글로벌 확장 전략
- K-Defense는 영어권 고CPM 국가(미국/호주/캐나다/영국) 공략에 부적합 (자국 방산에 관심)
- K-Defense 실제 관심국: 폴란드/루마니아/핀란드 (CPM 낮음, 수익성 불리)
- **영어 확장 시**: AI/기술 뉴스, 글로벌 지정학으로 카테고리 피벗 필요

| 단계 | 채널 | 언어 | 타겟 | 카테고리 |
|------|------|------|------|---------|
| 1 (현재) | 한국 채널 | 한국어 | 40~60대 남성 | 방산·시사·국제·주식 |
| 2 (추후) | 영어 채널 | 영어 | 30~50대 글로벌 | AI/기술, 글로벌 지정학 |

---

## 1. 전체 파이프라인

```
뉴스 수집 → 반응 모니터링 → [텔레그램 알람] → 사용자 선택
→ AI 스크립트 생성 → [사용자 검토] → TTS 음성 → 이미지/영상 생성
→ [사용자 검토] → 자막 생성 → [사용자 조정] → 미리보기 → [최종 승인]
→ 유튜브 업로드 → 1h/6h/24h 성과 모니터링 → 결과 분석
```

---

## 2. 단계별 구현 계획

### 2-1. 카테고리 시스템

카테고리를 Supabase DB에서 동적으로 관리. 대시보드 상단 탭으로 분리.

| 1단계 카테고리 | 대표 키워드 | 크롤링 소스 |
|-------------|-----------|-----------|
| 방산/국방 | K방산, KF-21, 방산수출, 한화에어로스페이스 | 네이버 뉴스 API, 국방일보 RSS |
| 국제/정치 | 트럼프, 미중관계, 우크라이나 | 네이버 뉴스 API |
| 반도체/AI | HBM, 엔비디아, 삼성파운드리, 클로드 | 네이버 뉴스 API |
| 주식/금융 | 코스피, 코스닥, 실적발표, 금리 | 네이버 뉴스 API, 증권사 RSS |
| 개그/시사 | 시사 풍자, 밈 | 커뮤니티 크롤링 |

2단계 추가 후보: **건강/의학상식**, **교양/다큐** (50~70대 최선호 카테고리)

---

### 2-2. 뉴스 수집

- HTTP 요청만으로 충분 (방산 뉴스는 대부분 정적 HTML)
- 네이버 뉴스 검색 API 한도: 25,000건/일 (카테고리 5개 × 키워드 10개 × 24회 = 1,200회/일 → 한도 5% 미만)
- **수집 키워드 저장**: 기사 저장 시 `search_keyword` 컬럼에 검색 키워드 기록 → DataLab 조회 및 필터링에 활용
- **제목 필터**: 검색 키워드가 제목에 포함된 기사만 저장 (관련 없는 기사 필터링)

### 2-2-1. 커뮤니티 모니터링 (루리웹 밀리터리)

**목적**: 네이버 뉴스 API로는 알 수 없는 "실제 반응(댓글·추천)"을 커뮤니티에서 파악

**흐름**:
```
루리웹 밀리터리 게시판 크롤링 (1시간마다)
→ 게시글 제목 + 댓글수 + 추천수 수집
→ 임계값 초과 게시글 탐지 (댓글 > N개, 추천 > N개)
→ 해당 제목으로 네이버 뉴스 검색 → 원문 기사 가져오기
→ 루리웹 상위 댓글 수집 (여론/반응 데이터)
→ 기사 + 댓글 반응을 함께 저장
→ AI 스크립트 생성 시 반응 댓글을 "시청자 반응 예측 자료"로 활용
```

**스크립트 활용 예시**:
```
[기사 내용으로 스크립트 작성]
...
"온라인 커뮤니티에서는 '드디어 실전 배치', '이제 수출만 남았다'는
 반응이 쏟아지고 있습니다."
```

**루리웹 크롤링 대상**:
- URL: `https://bbs.ruliweb.com/best/board/300052` (밀리터리 베스트)
- 수집 항목: 제목, URL, 추천수, 댓글수, 작성시각
- 댓글 상위 10개 수집 (BeautifulSoup HTML 파싱)

**DB 테이블**: `community_posts` (제목, URL, 추천수, 댓글수, 수집시각, 연결된 article_id)

---

### 2-3. 반응 모니터링 + 기사 선택 기준 데이터화

- 수집 1시간 후 같은 기사를 재조회 → 반응 변화량을 `article_metrics` 테이블에 시계열 저장
- 대시보드에 기사별 반응 속도 그래프 표시 → 사용자가 임계값 직접 설정
- 초기 기준값 (조정 가능):
  - 댓글 증가 > 10건/시간
  - 좋아요 증가 > 50건/시간
- 누적 데이터로 "실제 성과 좋았던 기사" 패턴 자동 추천

---

### 2-4. 텔레그램 알람 봇

기준 충족 시 사용자에게 즉시 알림:

```
[기사 선정 알람] 방산/국방
제목: "KF-21 폴란드 수출 계약 임박"
댓글 증가: +47건/시간 (기준: 10건)
→ 대시보드: https://your-dashboard.vercel.app
```

- 구현: `python-telegram-bot`
- 환경변수: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- 트리거: GitHub Actions cron
- 비용: 무료

---

### 2-5. Kanban 대시보드 (Human-in-the-loop)

**상단 탭**: 카테고리별 분리 (방산 | 반도체/AI | 국제/정치 | 주식 | 개그 | ...)

**컬럼 구성** (기사 카드가 단계별로 이동):
```
기사 확인 → 반응 좋음 → 스크립트 생성 → 이미지/영상 생성
→ 자막 생성 → 미리보기 → 업로드 완료 → 1시간 후 반응 → 결과 정리 → 🗑️ 휴지통
```

각 단계별 사용자 검토·승인 흐름:
1. AI 제목/태그/스크립트 초안 → 수정 or 승인
2. 이미지 프롬프트 목록 → 수정 or 승인 → 이미지 생성
3. 생성된 이미지 미리보기 → 재생성 or 승인
4. 자막 타이밍·위치·크기 → 수정 or 승인
5. Remotion 미리보기 → 최종 승인 + 채널 선택
6. 유튜브 업로드 실행

---

### 2-6. AI 서비스 프로바이더 선택

채널별·카테고리별로 어떤 AI를 쓸지 설정, 언제든 변경 가능. 영상 메타데이터에 사용 서비스/모델 기록.

#### 스크립트 생성
| 서비스 | 모델 예시 |
|--------|---------|
| Claude (Anthropic) | claude-sonnet-4-6, claude-opus-4-7 |
| GPT (OpenAI) | gpt-4o, gpt-4o-mini |
| Gemini (Google) | gemini-2.0-flash, gemini-1.5-pro |

#### 이미지 생성
| 서비스 | 방식 |
|--------|------|
| DALL-E (OpenAI) | API 생성 |
| Gemini Imagen (Google) | API 생성 |
| Pexels / Unsplash / Pixabay | 저작권 무료 사진 검색 (비용 $0) |

#### TTS

월 사용량 추정: 영상 1개당 ~1,000자 × 30개 = **3만 자/월**

| 단계 | 서비스 | 한도 | 비용 |
|------|-------|------|------|
| 0~12개월 | **AWS Polly Neural** | 100만 자/월 | $0 (3만 자 = 한도의 3%) |
| 12개월 이후 | **Google TTS Wavenet** | 100만 자/월 영구 | $0 |
| 채널 성장 후 | ElevenLabs Starter | 무제한 | $5/월 |

⚠️ ElevenLabs 무료 플랜은 상업적 사용 약관 위반 → 유튜브 수익화 콘텐츠에 사용 불가

**Supabase `ai_settings` 테이블**:
```
channel_id (FK, NULL = 전체 기본값)
script_provider, script_model
image_provider
tts_provider
```

---

### 2-7. TTS 음성 생성

- 기본: AWS Polly Neural → Google TTS Wavenet 순으로 사용
- `TTS_PROVIDER` 환경변수로 서비스 전환

---

### 2-8. 이미지 생성 (4~5컷)

- 스크립트 단락별 이미지 1컷씩
- 선택한 provider(DALL-E / Gemini / Pexels 등)로 생성 또는 검색
- **로컬**: 생성된 이미지를 PC 로컬 폴더(`/data/images/`)에 저장
- **클라우드 전환 시**: Cloudflare R2로 이전

---

### 2-9. 영상 합성 + 자막

- **로컬**: ffmpeg + Python으로 PC에서 직접 렌더링 (설치 필요, 무료)
- **클라우드 전환 시**: Remotion + AWS Lambda로 이전
- 자막: Whisper API로 SRT 생성 후 삽입
- 모바일 86%+ → 세로형 9:16 최적화, 큰 자막, 첫 3초 훅 강조
- 렌더링된 영상은 `/data/videos/`에 저장

---

### 2-10. 다중 유튜브 채널 관리

**Supabase `channels` 테이블**:
```
id, name, description
category_id (FK)         -- 담당 카테고리
country_code             -- KR / US / PL 등
language                 -- ko / en
youtube_channel_id       -- UCxxxxxxxx
oauth_token (encrypted)  -- 채널별 OAuth 토큰
is_active
```

- 하나의 카테고리에 여러 채널 가능 (A/B 테스트용, 톤 분리, 실험 등)
- 영상 제작 시 "어느 채널에 업로드할지" 선택 UI
- 채널별 성과 비교 대시보드

---

### 2-11. 유튜브 업로드

- YouTube Data API v3 / OAuth 인증 (채널별로 별도 토큰)
- **로컬**: 대시보드에서 승인하면 PC에서 직접 업로드 스크립트 실행
- **클라우드 전환 시**: GitHub Actions로 이전
- 국가별 설정: `defaultAudioLanguage`, `regionRestriction`

---

### 2-12. 업로드 후 성과 모니터링

- 1h / 6h / 24h 시점에 YouTube Data API 자동 수집
- 수집 항목: 조회수, 유효조회수, 좋아요, 싫어요, 댓글, 신규 구독
- `video_metrics` 테이블에 time_offset 컬럼으로 저장
- Kanban "1시간 후 반응" 컬럼에 결과 카드 표시
- **로컬**: Windows 작업 스케줄러 또는 Python APScheduler로 PC에서 주기 실행
- **클라우드 전환 시**: GitHub Actions cron으로 이전

#### 시청자 연령대 분석 연동
- YouTube Studio > Analytics > Audience 탭 (수동 확인)
- YouTube Analytics API `ageGroup` 차원 (일 100건 이상 필요)
- 대시보드에 "내 채널 연령대 분포" 위젯 추가

---

### 2-13. A/B 테스트 프레임워크

동일 주제로 두 버전의 영상을 동시 업로드하여 성과 비교.

#### 테스트 가능 변수 (기본 제공 + 언제든 자유 추가)

| 변수 | A 버전 | B 버전 |
|------|-------|-------|
| 제목 스타일 | 복잡하고 긴 제목 | 짧고 간결한 제목 |
| 주제 선정 | 유명한 주제 | 신선한/틈새 주제 |
| 성우 성별 | 여성 목소리 | 남성 목소리 |
| 성우 톤 | 아나운서 톤 | 스포츠 중계 톤 |
| 이미지 AI | Gemini Imagen | DALL-E |
| 영상 스타일 | 정적 이미지 슬라이드 | 동영상 클립 합성 |
| 스크립트 전략 | 댓글 유도형 | 정보 전달형 |
| 출연 방식 | AI 이미지만 | 말하는 사람 포함 (AI 아바타) |
| **직접 입력** | 자유 입력 | 자유 입력 |

#### 사용 흐름
1. A/B 테스트 모드 선택 → 테스트할 변수 선택 (기존 or 새 변수 직접 입력)
2. AI가 A, B 두 버전 생성
3. Human-in-the-loop: 각각 검토·승인
4. 두 영상 동시 업로드
5. 1h/6h/24h 성과 비교 대시보드

**DB**: `ab_tests` 테이블 + `video_metrics`에 `ab_test_id` 연결

---

## 3. API 키 관리 (다중 키 순환)

**로컬 DB `api_keys` 테이블** (SQLite → 클라우드 전환 시 Supabase):
```sql
id, service_name, api_key (encrypted), is_active, last_used_at, error_count
```

- 서비스별로 여러 개 등록 가능, 라운드로빈으로 자동 순환
- 호출 실패·한도 초과 시 다음 키로 자동 전환
- 대시보드 설정 페이지에서 키 추가/삭제/비활성화 가능
- **로컬**: `.env` 파일 + SQLite DB에서 관리
- **클라우드 전환 시**: Supabase + Vercel 환경변수로 이전

**필요한 키 목록**:
```
네이버 뉴스 API       × N개 (순환)
Anthropic (Claude)    × N개
OpenAI (GPT, DALL-E)  × N개
Google AI (Gemini, TTS) × N개
AWS (Polly)           × 계정당 1개
TYPECAST              × N개
ElevenLabs            × N개 (Starter 이상 플랜만)
Pexels                × N개
Unsplash              × N개
YouTube OAuth         × 채널 수만큼 (channels 테이블에서 관리)
Telegram Bot Token    × 1개
```

---

## 4. 인프라 구성

### 로컬 PC 단계 (지금 시작)

```
[크롤링·스케줄러]    Python APScheduler        → PC에서 백그라운드 실행
[반응 감지 트리거]   APScheduler (1시간 주기)   → PC에서 실행
[영상 합성]         ffmpeg + Python           → PC에서 직접 렌더링
[파일 저장]         로컬 폴더 /data/           → PC 디스크
[데이터베이스]       SQLite                    → 파일 하나로 관리, 설정 불필요
[대시보드]          Next.js localhost:3000     → PC 브라우저에서 접근
[TTS]              AWS Polly Neural API       → 100만 자/월 무료 (12개월)
[유튜브 업로드]      Python 스크립트 직접 실행  → PC에서 업로드
[알람]             Telegram Bot              → 영구 무료
```

### 클라우드 전환 시 (검증 후)

```
[크롤링·스케줄러]    GitHub Actions cron      → 영구 무료 (공개 레포)
[반응 감지 트리거]   cron-job.org             → 영구 무료
[영상 합성]         AWS Lambda + Remotion     → Lambda 영구 무료 한도 내
[파일 저장]         Cloudflare R2             → 월 10GB 영구 무료
[데이터베이스]       Supabase (PostgreSQL)     → 500MB 영구 무료
[대시보드]          Vercel                    → 정적 배포·API 라우팅
[TTS]              AWS Polly Neural          → 동일
[유튜브 업로드]      GitHub Actions            → 영구 무료
[알람]             Telegram Bot              → 동일
```

### 전환 기준
- 하루 1개 이상 영상을 꾸준히 만들게 됐을 때
- PC를 끄고 싶은데 크롤러가 걱정될 때
- 채널이 2개 이상으로 늘어날 때

---

## 5. 비용 계획

### 로컬 단계 (지금 당장)

| 항목 | 비용 |
|------|------|
| SQLite DB | $0 (파일 기반) |
| ffmpeg 영상 합성 | $0 (오픈소스) |
| AWS Polly Neural TTS | $0 (100만 자/월, 12개월) |
| AI API (Claude/GPT/Gemini) | AWS 신규 크레딧 활용 |
| Pexels/Unsplash 이미지 | $0 영구 |
| Telegram Bot | $0 영구 |
| **월 실질 비용** | **$0** |

### 클라우드 전환 후 (추가 비용)

| 항목 | 비용 |
|------|------|
| Supabase | $0 영구 (500MB) |
| Cloudflare R2 | $0 영구 (10GB/월) |
| AWS Lambda + Remotion | $0 영구 한도 내 |
| Vercel | $0 영구 (프론트) |
| **추가 비용** | **$0** |

### 12개월 이후

| 항목 | 월 비용 |
|------|---------|
| AI 스크립트 생성 | ~$1 |
| DALL-E 이미지 (10개 × 4컷) | ~$6.4 |
| S3/R2 스토리지 | ~$0.2 |
| Google TTS Wavenet (Polly 교체) | $0 영구 무료 |
| **합계** | **~$8~10/월** |

---

## 6. 기술 스택

| 역할 | 로컬 단계 | 클라우드 전환 시 |
|------|---------|--------------|
| 언어 | Python + TypeScript (Next.js) | 동일 |
| 크롤링 | requests, feedparser, BeautifulSoup4 | 동일 |
| 스케줄러 | Python APScheduler (PC 백그라운드) | GitHub Actions cron |
| DB | SQLite (파일 1개) | Supabase (PostgreSQL) |
| 파일 저장 | 로컬 `/data/` 폴더 | Cloudflare R2 |
| TTS | AWS Polly Neural → Google TTS Wavenet | 동일 |
| AI 스크립트 | Claude / GPT / Gemini API (선택) | 동일 |
| 이미지 생성 | DALL-E / Gemini / Pexels·Unsplash (선택) | 동일 |
| 영상 합성 | **ffmpeg + Python** (PC 렌더링) | Remotion + AWS Lambda |
| 자막 | OpenAI Whisper API | 동일 |
| 대시보드 | Next.js localhost:3000 | Vercel 배포 |
| 알람 | python-telegram-bot | 동일 |
| 유튜브 업로드 | Python 스크립트 직접 실행 | GitHub Actions |

---

## 7. 개발 순서

### Phase 1: 로컬에서 전체 파이프라인 완성

1. **SQLite 스키마 설계** (categories, channels, api_keys, ai_settings, articles, article_metrics, community_posts, videos, video_metrics, ab_tests, workflow_state)
2. **네이버 뉴스 API + RSS 크롤러** (Python, APScheduler로 1시간마다 자동 실행)
3. **루리웹 밀리터리 커뮤니티 모니터링** (1시간마다) → 핫 게시글 탐지 → 네이버 검색 → 댓글 수집
4. **반응 점수 계산 로직** + 임계값 설정
5. **텔레그램 봇 알람** 연동
6. **Next.js 대시보드 localhost:3000** (Kanban 보드, 카테고리 탭)
6. **AI 스크립트/제목/태그 생성** (Claude/GPT/Gemini 선택)
7. **AWS Polly TTS** 연동
8. **이미지 생성** (DALL-E + Pexels 선택)
9. **ffmpeg 영상 합성** + 자막 (Python, PC에서 렌더링)
10. **YouTube 업로드** Python 스크립트 (OAuth 채널별 관리)
11. **APScheduler 성과 모니터링** (1h/6h/24h)
12. **A/B 테스트 프레임워크**
13. **성과 대시보드 고도화** + AI 설정 관리 페이지

### Phase 2: 클라우드 전환 (Phase 1 안정화 후)

14. SQLite → Supabase 마이그레이션
15. 로컬 `/data/` → Cloudflare R2 마이그레이션
16. APScheduler → GitHub Actions cron 전환
17. ffmpeg → Remotion + AWS Lambda 전환
18. localhost → Vercel 배포
19. Python 업로드 스크립트 → GitHub Actions 전환

---

## 8. 주의사항 및 리스크

### 로컬 단계
- **PC 꺼지면 멈춤**: APScheduler는 PC가 켜져 있을 때만 동작 → 클라우드 전환 전까지 수동 관리
- **ffmpeg 설치 필요**: Windows에서 PATH 설정 필요 (`winget install ffmpeg`)
- **SQLite 동시 접근 제한**: 크롤러와 대시보드가 동시에 쓰면 락 발생 → WAL 모드 설정 필요

### 서비스 전반
- **숏츠 수익 낮음**: 채널 성장 도구로 활용, 수익은 롱폼 또는 유료 구독으로 확보
- **이탈률 52%**: 첫 3초 훅·자막 크기·속도 개선이 초기 최우선 과제
- **글로벌 확장**: K-Defense는 영어권 고CPM 공략에 부적합 → AI/기술/지정학 카테고리로 피벗
- **말하는 사람 영상(A/B)**: D-ID, HeyGen 등 AI 아바타 도구 필요 (유료)
- **ElevenLabs 무료 플랜**: 상업적 사용 약관 위반 → Starter($5/월) 이상만 사용 가능
- **YouTube Analytics 연령 데이터**: 일 100건 이상 시청 필요, 초기엔 없을 수 있음
- **네이버 API 약관**: 수집 데이터의 상업적 활용 범위 확인 필요
- **YouTube OAuth 토큰**: 채널별 만료 주기 관리 필요

### 클라우드 전환 시
- **GitHub Actions 비활성화**: 60일 이상 커밋 없으면 cron 자동 중단 → 주기적으로 빈 커밋 필요
- **Remotion 라이선스**: 3인 이하 팀은 무료, 초과 시 $100/월 Company 라이선스 필요
