# 숏츠 자동화 서비스 개발 에이전트 설계

> 이 프로젝트를 Claude Code + Agent SDK로 개발하기 위한 에이전트 아키텍처

---

## 1. 왜 에이전트가 필요한가

이 프로젝트는 다음 이유로 단순한 코드 작성이 아닌 **에이전트 기반 개발**이 적합:

- **7개 외부 서비스 연동** (Supabase, AWS, YouTube, Telegram, Naver API, Cloudflare, AI APIs)
- **3개 언어/런타임** (Python 크롤러, TypeScript Remotion, Next.js 프론트)
- **단계별 독립성**: 크롤러 → DB → 대시보드 → AI → 영상 → 업로드가 각자 독립 배포
- **반복 작업**: 카테고리 추가, 채널 추가, A/B 테스트 변수 추가 등 구조가 반복됨
- **검증 필요**: 각 단계마다 실제 API 호출로 동작 확인이 필요

---

## 2. 에이전트 아키텍처 개요

```
[사용자]
   │
   ▼
[오케스트레이터 에이전트]  ← plan.md + agent.md를 항상 참조
   │
   ├── [DB 에이전트]         Supabase 스키마 설계 및 마이그레이션
   ├── [크롤러 에이전트]      Python 크롤러 + GitHub Actions
   ├── [대시보드 에이전트]    Next.js Kanban UI + API 라우팅
   ├── [AI 연동 에이전트]     스크립트/이미지/TTS API 통합
   ├── [영상 에이전트]        Remotion 템플릿 + AWS Lambda
   ├── [업로드 에이전트]      YouTube API + 성과 모니터링
   └── [인프라 에이전트]      환경변수, 배포, CI/CD
```

각 에이전트는 **독립적으로 실행** 가능하고, 오케스트레이터가 의존성 순서를 관리.

---

## 3. Claude Code 기반 구현 방법

### 3-1. 프로젝트 구조

```
shorts/
├── CLAUDE.md               ← Claude Code가 항상 읽는 프로젝트 컨텍스트
├── agent.md                ← 에이전트 설계 (이 파일)
├── plan.md                 ← 전체 서비스 기획
│
├── .claude/
│   └── settings.json       ← Claude Code 훅·권한 설정
│
├── agents/
│   ├── orchestrator.md     ← 오케스트레이터 프롬프트
│   ├── db.md               ← DB 에이전트 프롬프트
│   ├── crawler.md          ← 크롤러 에이전트 프롬프트
│   ├── dashboard.md        ← 대시보드 에이전트 프롬프트
│   ├── ai_integration.md   ← AI 연동 에이전트 프롬프트
│   ├── video.md            ← 영상 에이전트 프롬프트
│   ├── upload.md           ← 업로드 에이전트 프롬프트
│   └── infra.md            ← 인프라 에이전트 프롬프트
│
├── crawler/                ← Python 크롤러 (에이전트가 작성)
├── dashboard/              ← Next.js 프론트 (에이전트가 작성)
├── video/                  ← Remotion 영상 합성 (에이전트가 작성)
└── .github/workflows/      ← GitHub Actions (에이전트가 작성)
```

### 3-2. CLAUDE.md 구성

Claude Code가 모든 세션에서 자동으로 읽는 파일. 에이전트가 컨텍스트를 잃지 않도록 핵심 정보를 여기에 집약.

```markdown
# Shorts 자동화 서비스

## 프로젝트 개요
뉴스 수집 → AI 스크립트 → 영상 합성 → 유튜브 업로드 자동화 서비스
자세한 계획: plan.md / 에이전트 설계: agent.md

## 기술 스택
- 크롤러: Python (crawler/)
- 대시보드: Next.js + Tailwind + shadcn/ui (dashboard/)
- 영상 합성: Remotion + TypeScript (video/)
- DB: Supabase PostgreSQL
- 인프라: GitHub Actions, AWS Lambda, Cloudflare R2, Vercel

## DB 연결
- Supabase URL, anon key는 .env.local에 있음
- 스키마 변경 시 반드시 migrations/ 폴더에 SQL 파일 추가

## 개발 원칙
- API 키는 절대 코드에 하드코딩하지 않음 (환경변수 또는 Supabase api_keys 테이블)
- 모든 외부 API 호출은 api_keys 테이블의 다중 키 순환 로직 사용
- 카테고리·채널·AI 프로바이더는 DB에서 동적 관리 (코드 수정 없이 추가 가능)
- 영상 메타데이터에 사용한 AI 서비스·모델명 반드시 기록

## 현재 개발 단계
→ agents/orchestrator.md 참조
```

---

## 4. 에이전트별 역할과 프롬프트

### 4-1. 오케스트레이터 에이전트

**역할**: plan.md를 읽고 현재 개발 단계를 파악, 다음에 실행할 서브 에이전트 결정, 의존성 충돌 방지

**실행 방법**:
```bash
claude --agent agents/orchestrator.md
```

**프롬프트 핵심**:
```
1. plan.md의 "7. 개발 순서"를 읽어라
2. 각 단계의 완료 여부를 실제 파일 존재와 코드로 확인해라
3. 가장 빠른 다음 단계를 결정하고, 해당 서브 에이전트를 실행해라
4. 서브 에이전트 완료 후 동작 확인(테스트)까지 책임져라
```

---

### 4-2. DB 에이전트

**역할**: Supabase 스키마 설계, 마이그레이션 SQL 작성, RLS 정책 설정

**담당 테이블**:
```sql
categories      -- 카테고리 (방산/시사/주식 등)
channels        -- 유튜브 채널 (채널별 OAuth, 카테고리, 국가)
api_keys        -- API 키 다중 관리 (암호화, 순환)
ai_settings     -- AI 프로바이더 설정 (채널별)
articles        -- 수집된 기사
article_metrics -- 기사 반응 시계열 (1h 후 댓글/좋아요 변화)
videos          -- 제작된 영상 메타데이터 (사용 AI 모델 포함)
video_metrics   -- 영상 성과 시계열 (1h/6h/24h)
ab_tests        -- A/B 테스트 설정
workflow_state  -- 기사별 Kanban 단계 상태
```

**실행 방법**:
```bash
claude "Supabase 스키마를 설계하고 migrations/001_init.sql을 작성해줘. plan.md의 DB 구조를 참고해."
```

---

### 4-3. 크롤러 에이전트

**역할**: Python 크롤러 작성, GitHub Actions 워크플로우 설정

**담당 작업**:
- 네이버 뉴스 API 호출 (api_keys 테이블에서 키 순환)
- 국방일보 RSS 파싱
- 1시간 후 반응 재조회 → article_metrics 저장
- 임계값 초과 시 텔레그램 봇 알람 전송

**파일 구조**:
```
crawler/
├── main.py              -- 진입점
├── sources/
│   ├── naver.py         -- 네이버 뉴스 API
│   └── rss.py           -- RSS 파싱
├── metrics.py           -- 반응 속도 계산
├── alert.py             -- 텔레그램 알람
└── requirements.txt
```

**실행 방법**:
```bash
claude "crawler/main.py를 작성해줘. plan.md 2-2, 2-3, 2-4 섹션 참고. 
네이버 API 키는 Supabase api_keys 테이블에서 순환해서 사용."
```

---

### 4-4. 대시보드 에이전트

**역할**: Next.js Kanban 대시보드 제작

**담당 화면**:
```
/                     -- Kanban 보드 (카테고리 탭 + 컬럼)
/articles/[id]        -- 기사 상세 + Human-in-the-loop 작업 화면
/settings/keys        -- API 키 관리 (추가/삭제/비활성화)
/settings/channels    -- 유튜브 채널 관리
/settings/ai          -- AI 프로바이더 설정
/analytics            -- 채널 성과 + 연령대 분포 위젯
/ab-tests             -- A/B 테스트 관리
```

**파일 구조**:
```
dashboard/
├── app/
│   ├── page.tsx          -- Kanban 보드
│   ├── articles/[id]/    -- 기사 상세
│   ├── settings/         -- 설정 페이지들
│   └── api/              -- API 라우팅
├── components/
│   ├── kanban/           -- Kanban 보드 컴포넌트
│   ├── workflow/         -- Human-in-the-loop 단계별 UI
│   └── analytics/        -- 차트·위젯
└── lib/
    ├── supabase.ts
    └── api-keys.ts       -- 다중 키 순환 로직
```

**실행 방법**:
```bash
claude "dashboard/ 폴더에 Next.js 앱을 초기화하고 Kanban 보드 메인 화면을 만들어줘.
shadcn/ui 사용. plan.md 2-5 섹션 참고."
```

---

### 4-5. AI 연동 에이전트

**역할**: 스크립트·이미지·TTS API 통합, 프로바이더 추상화 레이어

**담당 모듈**:
```
dashboard/lib/ai/
├── script.ts        -- Claude/GPT/Gemini 스크립트 생성
├── image.ts         -- DALL-E/Gemini/Pexels 이미지 생성·검색
├── tts.ts           -- AWS Polly/Google TTS/TYPECAST
└── provider.ts      -- ai_settings 테이블 기반 프로바이더 선택
```

**핵심 요구사항**:
- `ai_settings` 테이블에서 채널별 프로바이더/모델 읽기
- 모든 API 호출 결과를 `videos.ai_metadata`에 JSON으로 저장
- 스크립트에 사용된 모델명이 성과 분석에 연결되어야 함

**실행 방법**:
```bash
claude "dashboard/lib/ai/ 폴더를 만들고 프로바이더 추상화 레이어를 작성해줘.
Claude, GPT, Gemini 모두 같은 인터페이스로 호출 가능하게."
```

---

### 4-6. 영상 에이전트

**역할**: Remotion 숏츠 템플릿 제작, AWS Lambda 배포

**담당 작업**:
```
video/
├── src/
│   ├── Shorts.tsx       -- 메인 숏츠 컴포넌트 (9:16, 1080×1920)
│   ├── Subtitle.tsx     -- 자막 레이어 (큰 글씨, 모바일 최적화)
│   ├── Hook.tsx         -- 첫 3초 훅 애니메이션
│   └── ImageSlide.tsx   -- 이미지 슬라이드
├── remotion.config.ts
└── deploy-lambda.sh     -- Lambda 배포 스크립트
```

**최적화 포인트** (이탈률 52% 개선):
- 첫 3초: 강렬한 텍스트 훅 + 동적 효과
- 자막: 최소 60px 이상, 모바일 화면 기준
- 배경: 이미지 Ken Burns 효과 적용

**실행 방법**:
```bash
claude "video/ 폴더에 Remotion 숏츠 템플릿을 만들어줘. 
9:16 세로형, 이탈률 개선을 위한 첫 3초 훅 강조, 큰 자막 필수."
```

---

### 4-7. 업로드·모니터링 에이전트

**역할**: YouTube 업로드, 성과 수집 cron

**담당 작업**:
```
.github/workflows/
├── upload.yml           -- 유튜브 업로드 (channels 테이블에서 OAuth 토큰 사용)
├── monitor-1h.yml       -- 업로드 후 1시간 성과 수집
├── monitor-6h.yml       -- 6시간 성과 수집
└── monitor-24h.yml      -- 24시간 성과 수집
```

**실행 방법**:
```bash
claude ".github/workflows/upload.yml을 작성해줘. 
channels 테이블에서 채널별 OAuth 토큰을 읽어 업로드. 
업로드 완료 후 videos.uploaded_at 기록."
```

---

### 4-8. 인프라 에이전트

**역할**: 환경변수 정리, Vercel 배포 설정, AWS 초기 설정

**담당 작업**:
- `.env.example` 작성 (모든 필요 키 목록)
- `vercel.json` 설정
- AWS IAM 권한 최소화 정책 작성
- Supabase RLS 정책

**실행 방법**:
```bash
claude "이 프로젝트의 .env.example을 작성해줘. plan.md의 API 키 목록 참고."
```

---

## 5. 개발 워크플로우

### 5-1. 처음 시작하는 경우

```bash
# 1. Claude Code에서 오케스트레이터 실행
claude "plan.md와 agent.md를 읽고 지금 어디까지 개발해야 하는지 파악해줘.
1단계(Supabase 스키마)부터 시작해."

# 2. 각 에이전트를 순서대로 실행
claude "migrations/001_init.sql을 작성해줘"
claude "crawler/main.py를 작성해줘"
# ...
```

### 5-2. 특정 기능을 추가하는 경우

```bash
# 카테고리 추가 (건강/의학상식)
claude "categories 테이블에 '건강/의학상식' 카테고리를 추가하고,
네이버 뉴스 크롤러에 관련 키워드를 추가해줘."

# 새 유튜브 채널 추가
claude "channels 테이블에 영어 방산 채널을 추가하고,
해당 채널의 OAuth 설정 방법을 알려줘."

# A/B 테스트 새 변수 추가
claude "A/B 테스트에 '썸네일 스타일 (텍스트 중심 vs 이미지 중심)' 변수를 추가해줘."
```

### 5-3. 디버깅·리뷰

```bash
# 크롤러 동작 확인
claude "crawler/main.py를 실행해서 네이버 API가 실제로 동작하는지 확인해줘.
결과를 Supabase articles 테이블에 잘 저장되는지 확인."

# 영상 미리보기
claude "video/src/Shorts.tsx의 현재 상태로 미리보기를 렌더링해서 확인해줘."
```

---

## 6. 에이전트 실행 시 공통 지침

모든 에이전트 세션에서 반드시 지켜야 할 규칙:

### 코드 작성 원칙
```
1. API 키는 환경변수 또는 Supabase api_keys 테이블에서만 읽기
2. 카테고리·채널·AI 프로바이더는 DB에서 동적 조회 (하드코딩 금지)
3. 모든 AI API 호출 결과는 videos.ai_metadata에 저장 (성과 비교용)
4. 외부 API 실패 시 다음 키로 자동 전환하는 로직 항상 포함
5. 이탈률 개선: 첫 3초 훅, 큰 자막(60px+), 9:16 세로형 최적화
```

### 확인 체크리스트 (각 에이전트 완료 후)
```
□ 실제 API 호출 테스트 완료
□ 환경변수 .env.example에 추가됨
□ DB 스키마 변경 시 migrations/ SQL 파일 생성됨
□ GitHub Actions 워크플로우가 push 없이도 수동 실행 가능
□ 에러 발생 시 텔레그램으로 에러 알람 전송
```

---

## 7. 단계별 마일스톤

### M1: 데이터 파이프라인 (1~2주)
- [ ] Supabase 스키마 완성
- [ ] 네이버 뉴스 크롤러 동작
- [ ] GitHub Actions 1시간 cron 동작
- [ ] 텔레그램 알람 수신 확인

### M2: 대시보드 기본 (2~3주)
- [ ] Kanban 보드 UI 완성
- [ ] 기사 카드 단계 이동 동작
- [ ] API 키 관리 페이지 완성
- [ ] 채널 관리 페이지 완성

### M3: AI + 영상 파이프라인 (3~4주)
- [ ] 스크립트 생성 (Claude/GPT/Gemini 선택 가능)
- [ ] 이미지 생성/검색 (DALL-E/Pexels 선택 가능)
- [ ] TTS 생성 (AWS Polly 기본)
- [ ] Remotion 영상 합성 + 자막
- [ ] 영상 미리보기 동작

### M4: 업로드 + 모니터링 (4~5주)
- [ ] YouTube 업로드 자동화
- [ ] 1h/6h/24h 성과 수집
- [ ] 성과 대시보드 위젯

### M5: A/B 테스트 (5~6주)
- [ ] A/B 테스트 모드 UI
- [ ] 두 영상 동시 업로드
- [ ] 성과 비교 대시보드

---

## 8. 자주 쓰는 Claude Code 명령어

```bash
# 프로젝트 전체 상태 파악
claude "plan.md와 현재 파일 구조를 보고 어디까지 구현됐는지 체크해줘"

# 특정 에이전트 역할로 작업
claude "크롤러 에이전트 역할로: agents/crawler.md를 읽고 다음 작업을 진행해"

# 에러 디버깅
claude "GitHub Actions의 크롤러 워크플로우가 실패했어. 로그를 보고 고쳐줘"

# 기능 검증
claude "전체 파이프라인을 처음부터 끝까지 테스트 실행해줘. 
뉴스 수집 → 스크립트 생성 → 영상 합성까지 각 단계 확인"
```

---

## 9. 에이전트 확장 방법

새로운 카테고리·채널·기능을 추가할 때 에이전트에게 요청하는 방법:

```bash
# 새 카테고리 추가
claude "plan.md에 '건강/의학상식' 카테고리를 추가하고,
크롤러·대시보드·Kanban까지 모두 반영해줘"

# 새 AI 프로바이더 추가
claude "이미지 생성에 Stability AI(Stable Diffusion)를 추가해줘.
dashboard/lib/ai/image.ts에 provider='stability' 케이스 추가"

# 새 A/B 테스트 변수 추가
claude "A/B 테스트에 새 변수 타입을 추가하는 방법을 보여주고,
'배경음악 유무' 변수를 예시로 추가해줘"
```
