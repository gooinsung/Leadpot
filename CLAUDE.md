# CLAUDE.md — Leadpot(리드팟) 작업 규칙

> 이 문서는 **누구나 · 어디서나 · 이 작업을 이어서 할 수 있도록** 하는 프로젝트의 최상위 규칙이다.
> 작업을 시작하기 전에 반드시 이 문서를 먼저 읽는다. 규칙이 바뀌면 이 문서를 갱신한다.
> **이어받을 때**: 이 문서 → [docs/ROADMAP.md](docs/ROADMAP.md)(진행상황) → [docs/SPEC.md](docs/SPEC.md) 순서로 읽는다.

- **서비스명**: Leadpot (리드팟)
- **저장소**: https://github.com/gooinsung/Leadpot

---

## ⚠️ 0. 최상위 지침 (다른 모든 규칙에 우선)

- **애매하거나 확인이 필요한 부분은 절대 임의로 진행하지 않는다. 반드시 사용자에게 먼저 물어본다.**
  - 해당: 판단이 갈리는 설계·범위·기술 선택, 되돌리기 어렵거나 외부에 영향 주는 작업, 사용자 의도가 불확실한 경우, 여러 갈래가 있는 결정.
  - 명백하고 안전하며 이미 합의된 범위의 작업만 자율적으로 진행한다.
  - 확신이 서지 않으면 진행을 멈추고 질문한 뒤 답을 기다린다. "일단 진행하고 나중에 되돌리기"는 하지 않는다.

### 각 Phase 착수 전 필수 절차 (기획 재검증)

전체 Phase 계획은 프로젝트 초반에 **한 번에 세운 초안**이다. 따라서 각 Phase를 시작할 때 그대로 믿고 진행하지 말고, 반드시 아래를 먼저 수행한다:

1. **기획 문서 재정독**: 해당 Phase와 관련된 [docs/SPEC.md](docs/SPEC.md) · [docs/FEATURES.md](docs/FEATURES.md) · [docs/BACKLOG.md](docs/BACKLOG.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/DBCART-ANALYSIS.md](docs/DBCART-ANALYSIS.md)를 다시 읽는다.
2. **현실성 재검증**: 이 Phase 계획이 지금 시점에도 타당한지 점검한다 — 기술적 실현 가능성, 앞 Phase 결과·실제 코드와의 정합성, 의존성/전제(준비물)가 충족됐는지, 범위가 과하거나 부족하지 않은지, 더 나은 접근이 생겼는지.
3. **의문·리스크 공유**: 비현실적이거나 애매하거나 조정이 필요한 부분이 보이면 **착수 전에 사용자에게 알리고 함께 조정**한다 (위 최상위 지침과 연결).
4. **문제 없을 때만 착수**, 착수 시 [docs/PROGRESS.md](docs/PROGRESS.md)·ROADMAP 상태 갱신.

> 즉 "계획대로 실행"이 아니라 **"매 Phase마다 계획을 다시 검증하고 실행"** 이 원칙이다.

### 📱 모바일 퍼스트 (제품 최상위 원칙)

- **우리가 만든 공개 폼·랜딩페이지는 99% 모바일에서 열린다.** 따라서 **모든 공개 화면(공개 폼 `/f/{id}`, 랜딩, 동의 뷰 등)은 모바일 최적화를 최우선**으로 설계·검증한다.
- 새 공개 화면/기능을 만들 때 항상 모바일(≈375px)에서 먼저 확인한다: 입력창 16px(iOS 자동확대 방지), 큰 탭 타깃, 풀폭 레이아웃, safe-area 대응.
- 관리자 화면(대시보드·빌더)은 데스크톱 우선이어도 되지만, 공개 화면은 예외 없이 모바일 우선.

---

## 1. 프로젝트 개요

실제 서비스 중인 **디비카트(dbcart.net)** 를 벤치마킹한 **랜딩페이지 제작 + 상담 DB(리드) 수집 + 리드 관리(CRM)** 웹 서비스. 서비스명은 **Leadpot(리드팟)**.

- 사용자가 코딩 없이 랜딩페이지를 만들고, 공개 URL로 배포한다.
- 방문자가 폼(이름·연락처 등)을 남기면 DB(리드)로 수집된다.
- 수집된 리드를 대시보드/CRM으로 관리한다.
- 최종 목표: 디비카트 전체 기능 벤치마킹 + 자체 기능 확장. 실서비스 운영.

자세한 기능/명세는 [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/SPEC.md`](docs/SPEC.md) 참고.

---

## 2. 기술 스택 (2026-09-07 기준 실제 구성)

> ⚠️ 아래 "배포처"는 **지금 실제로 도는 곳**이다. 최초 기획(§9 의사결정 로그)과는 다르다.
> 상세·실측치는 [docs/DEPLOY.md](docs/DEPLOY.md) 부록 C, SSR·Cloudflare 이전 경과는
> [docs/SSR-LANDING-PLAN.md](docs/SSR-LANDING-PLAN.md)(§7 Phase 5 완료 기록).

| 구성 | 선택 | 지금 배포처 |
|---|---|---|
| 관리 앱(로그인·대시보드·빌더) | **React + Vite (TypeScript) SPA** | **Cloudflare Pages**(`app.lead-pot.com`, 프로젝트 `leadpot-app`) — 2026-09-07 Oracle VM 에서 컷오버 완료 |
| 공개 랜딩(`{sub}.lead-pot.com`) | **Next.js(App Router) SSR** | **Cloudflare Workers**(OpenNext 어댑터, `renderer/`, 워커 `leadpot-renderer`) — 2026-09-07 신설·전환 완료. 관리 앱과 컴포넌트를 `packages/public-ui` 로 공유 |
| 백엔드 | **Spring Boot (REST API) + Docker** | **Railway**(싱가포르, `api.lead-pot.com`) — 2026-08-09 Oracle VM에서 컷오버 완료 |
| DB | **PostgreSQL** | **Railway Postgres**(Railway 가 직접 호스팅, 백엔드와 같은 프로젝트) — Neon 은 비용 문제로 삭제하고 이전 완료(2026-09-07 확인) |
| 파일 저장 | 초기: VM 디스크 → 후기: Cloudflare R2 / S3 | — |
| 인증 | **JWT** (Spring Security + BCrypt) | — |
| 결제(후기) | PortOne(아임포트) / 토스페이먼츠 | — |

**이식성 원칙 (중요)**: 백엔드는 Docker 컨테이너로, DB는 표준 PostgreSQL로 유지한다.
→ 나중에 유료 VPS(Hetzner)·Google Cloud Run·AWS 등 어디로든 코드 수정 거의 없이 이전 가능해야 한다.
특정 플랫폼 전용 기능(락인)에 의존하지 않는다. (실제로 백엔드가 Oracle VM → Railway 로,
DB 가 Neon → Railway Postgres 로 코드 거의 안 건드리고 옮겨간 것이 이 원칙 덕분이다. 프론트·
렌더러의 Cloudflare 전환도 표준 Vite/Next 빌드 산출물이라 다른 정적 호스팅으로 옮기는 것도
어렵지 않다 — 단, `renderer/` 는 OpenNext 어댑터로 Cloudflare Workers 런타임에 맞춰 빌드하므로
다른 플랫폼으로 옮기려면 그 부분만 다시 빌드 설정을 맞춰야 한다.)

- Oracle VM 은 **아직 켜져 있다**(롤백 안전망, `docs/SSR-LANDING-PLAN.md` §7 Phase 6 관찰 기간
  종료 후 종료 예정) — 정적 파일은 이제 서빙하지 않고 비어 있는 상태.

---

## 3. 아키텍처 (2026-09-07 기준 실제 구성)

```
[방문자 / 사용자]
        │
        ▼
Cloudflare DNS(프록시, 무료 SSL)
        │
        ├─ app.lead-pot.com ─▶ Cloudflare Pages ─▶ React SPA(정적 파일, 관리 앱)
        │
        ├─ {sub}.lead-pot.com/* (와일드카드 Workers 라우트)
        │        └─▶ Cloudflare Workers(leadpot-renderer, Next.js SSR)
        │                 ├─ 서브도메인 있음 → 공개 랜딩 SSR 렌더
        │                 └─ Host="app" → 관리 앱(Pages)으로 리버스 프록시
        │                    (renderer/src/proxy.ts proxyToAdminApp() — 와일드카드 라우트가
        │                    app 도 가로채는 것에 대한 안전장치, §6-5 실제 장애 참고)
        │
        └─ api.lead-pot.com ─▶ Railway(싱가포르) ─▶ Spring Boot(Docker)
                                                          │
                                                          ▼
                                          Railway Postgres(같은 프로젝트, 같은 리전)
```

- 관리 앱: `app.lead-pot.com`(Cloudflare Pages) / 공개 랜딩: `{sub}.lead-pot.com`(Cloudflare Workers
  SSR) / 백엔드: `api.lead-pot.com`(Railway) / DB: Railway Postgres
  (⚠️ DB 는 예전엔 Neon 이었으나 비용 문제로 삭제 → Railway 자체 Postgres 로 이전, 2026-09-07 확인.
  같은 프로젝트·같은 리전이라 [HOSTING-MIGRATION-PLAN.md](docs/HOSTING-MIGRATION-PLAN.md) P1 이
  노리던 "DB 왕복 지연 해소" 목표에 오히려 더 잘 맞는 구성이 됐다)
- 서로 다른 오리진 → **CORS 설정 필수** (허용 오리진을 환경변수로 관리)
- 시크릿/키는 **절대 코드·git에 커밋하지 않는다.** 프론트·렌더러는 Cloudflare 환경변수(Workers/Pages
  Variables), 백엔드는 **Railway Variables**로만 관리(§6).
- 🔴 **와일드카드 Workers 라우트는 DNS/커스텀 도메인 설정과 무관하게 패턴에 매칭되는 모든 요청을
  가로챈다** — `app.lead-pot.com` 도 `*.lead-pot.com` 에 매칭되므로 라우트를 걸면 렌더러로도
  들어온다. 그래서 렌더러가 `app` 요청을 관리 앱으로 리버스 프록시하도록 코드로 방어해뒀다
  (`renderer/src/proxy.ts`) — 이 방어가 없으면 실제 장애가 난다(2026-09-07 실측, 상세는
  [PHASE5-CLOUDFLARE-HANDOFF.md](docs/PHASE5-CLOUDFLARE-HANDOFF.md) §4-1).

---

## 4. 저장소 구조 (모노레포)

```
dbcart/
├─ CLAUDE.md                  # (이 파일) 작업 규칙
├─ README.md                  # 프로젝트 소개 + 빠른 시작
├─ docs/
│   ├─ FEATURES.md            # 디비카트 전체 기능 카탈로그
│   ├─ SPEC.md                # 우리 서비스 기능 명세
│   └─ DECISIONS.md           # (선택) 의사결정 로그 상세
├─ frontend/                  # 관리 앱 — React + Vite (TypeScript) SPA. Cloudflare Pages 배포
│   ├─ src/
│   │   ├─ pages/             # 화면(대시보드/로그인/빌더 등 — 공개 랜딩 렌더링은 renderer/ 가 담당)
│   │   ├─ components/        # 재사용 컴포넌트
│   │   ├─ api/               # 백엔드 API 클라이언트(공개 API 부분은 packages/public-ui 재-export)
│   │   └─ lib/               # 유틸/훅
│   ├─ .env.example
│   ├─ vite.config.ts
│   └─ package.json
├─ renderer/                  # 공개 랜딩 SSR 렌더러 — Next.js(App Router) + OpenNext Cloudflare
│   │                           어댑터. Cloudflare Workers(leadpot-renderer)에 배포. {sub}.lead-pot.com
│   │                           만 처리(관리 앱과 무관) — 자세한 배경은 docs/SSR-LANDING-PLAN.md
│   ├─ src/app/                # site/[subdomain]/[identifier] 라우트 + robots.ts
│   ├─ src/proxy.ts            # 서브도메인 라우팅(구 middleware) + app 리버스 프록시 안전장치
│   └─ wrangler.jsonc
├─ packages/public-ui/        # frontend·renderer 가 공유하는 공개 렌더링 컴포넌트·API 클라이언트
│   │                           (LandingView·PublicFormView·HtmlBlock 등) — npm workspaces 패키지.
│   │                           크롤러가 보는 화면과 실사용자가 보는 화면이 갈라지지 않게 하는 핵심.
├─ backend/                   # Spring Boot (Gradle)
│   ├─ src/main/java/com/dbcart/
│   │   ├─ auth/              # 회원가입·로그인·JWT
│   │   ├─ landing/           # 랜딩페이지 CRUD + 공개 데이터
│   │   ├─ lead/              # 폼 제출 수신 + 리드 조회/내보내기
│   │   ├─ team/              # 팀 CRM (후기)
│   │   └─ common/            # 공통(config, 예외, security)
│   ├─ src/main/resources/
│   ├─ build.gradle
│   └─ Dockerfile
├─ docker-compose.yml         # 로컬: spring + postgres 동시 기동
└─ .github/workflows/         # (선택) CI/CD
```

---

## 5. 로컬 실행법

### 사전 요구
- JDK 21+ (백엔드), Node.js 20+ (프론트), Docker Desktop

### 백엔드 + DB (Docker)
```bash
docker-compose up
# Spring Boot :8080, PostgreSQL :5432 기동
# 헬스체크: http://localhost:8080/api/health
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173  (.env 의 VITE_API_BASE_URL 로 백엔드 지정)
```

---

## 6. 배포법

> ⚠️ **아래는 2026-09-07 Cloudflare 전환 완료 후 실제 구성이다.** 이전 이력(Oracle VM 시절)은
> [docs/DEPLOY.md](docs/DEPLOY.md) 부록 C·[docs/HOSTING-MIGRATION-PLAN.md](docs/HOSTING-MIGRATION-PLAN.md),
> Cloudflare 전환 경과·겪은 장애는 [docs/SSR-LANDING-PLAN.md](docs/SSR-LANDING-PLAN.md) §7 Phase 5·
> [docs/PHASE5-CLOUDFLARE-HANDOFF.md](docs/PHASE5-CLOUDFLARE-HANDOFF.md) 참고.

**`main` 에 push 하면 아래 워크플로가 경로별로 자동 실행된다(+ Railway 가 백엔드를 따로 배포한다). 수동 배포는 필요 없다.**

| 워크플로 | 트리거 경로 | 하는 일 | 배포처 |
|---|---|---|---|
| [deploy-frontend-cloudflare.yml](.github/workflows/deploy-frontend-cloudflare.yml) | `frontend/**`·`packages/public-ui/**` | `npm run build`(`VITE_API_BASE_URL` 주입) → `cloudflare/pages-action` | Cloudflare Pages(`leadpot-app`, `app.lead-pot.com`) |
| [deploy-renderer.yml](.github/workflows/deploy-renderer.yml) | `renderer/**`·`packages/public-ui/**` | `npm run deploy`(OpenNext 빌드 + `wrangler deploy`) | Cloudflare Workers(`leadpot-renderer`, `{sub}.lead-pot.com`) |
| [deploy-frontend.yml](.github/workflows/deploy-frontend.yml) | `frontend/**` | rsync 로 Oracle VM `/var/www/leadpot/` | Oracle VM(**이제 실제 트래픽 안 받음** — 관찰 기간 동안의 롤백 안전망일 뿐, 정리 예정) |

- 필요한 저장소 시크릿: `CLOUDFLARE_API_TOKEN`(Workers Scripts:Edit + Cloudflare Pages:Edit +
  Account Settings:Read) · `CLOUDFLARE_ACCOUNT_ID` · (VM 용) `VM_SSH_KEY`·`VM_HOST`·`VM_USER`.
- `NEXT_PUBLIC_*`(렌더러)·`VITE_*`(프론트)는 **빌드 시점에** 번들에 박히므로 워크플로의 `env:` 에서
  프로덕션 값을 넣어 빌드한다 — Cloudflare 대시보드의 런타임 변수와는 별개다.
- 백엔드(`api.lead-pot.com`)는 **Railway 가 자체 GitHub 연동으로 독립 배포**한다 — 이 저장소의
  워크플로가 아니다. `backend/**` push 시 Railway 대시보드에서 자동으로 빌드·배포되고, 환경변수는
  Railway Variables 로 관리한다(무중단 롤링 배포).
- DB 는 **Railway Postgres**다(Railway 가 직접 호스팅, 예전 Neon 은 삭제됨 — 위 §2·§3 참고).
  VM 안에 Postgres 컨테이너를 띄우지 않는다.
- 🔴 **와일드카드 Workers 라우트(`*.lead-pot.com/*` → `leadpot-renderer`)는 `app.lead-pot.com` 도
  그대로 가로챈다** — Cloudflare 는 DNS/커스텀 도메인 설정과 무관하게 패턴 매칭만 본다. 그래서
  `renderer/src/proxy.ts` 가 `Host` 가 `app` 이면 관리 앱(Pages)으로 리버스 프록시한다(`ADMIN_APP_ORIGIN`
  환경변수, 기본값 `https://leadpot-app.pages.dev`) — 이 방어가 없으면 관리 앱이 렌더러의 빈
  placeholder 로 대체되는 실제 장애가 난다(2026-09-07 실측, 되돌리기는 라우트 삭제로 즉시 가능).
- 🗑️ **`deploy-backend.yml`(VM 에 백엔드를 따로 배포하던 옛 워크플로)은 2026-09-07 삭제했다.**
  VM `~/Leadpot/.env` 가 가리키던 Neon 접속정보가 Neon 삭제로 죽어서, VM 컨테이너가 뜨자마자
  Flyway DB 연결에 실패하고 매번 헬스체크 타임아웃으로 실패하고 있었다. 실제 트래픽은 Railway 만
  받으니 서비스 영향은 없었다. `backend/Dockerfile.runtime`·`docker-compose.prod.yml`(이 워크플로
  전용 산출물)은 VM 완전 종료 때 같이 정리 예정.
- Oracle VM 은 [SSR-LANDING-PLAN.md](docs/SSR-LANDING-PLAN.md) §7 Phase 6 의 2~3일 관찰 기간이
  끝나면 종료한다 — 그때 `deploy-frontend.yml` 도 함께 삭제.

---

## 7. 작업 규칙 (컨벤션)

### 언어
- **문서·주석·커밋 메시지·UI 텍스트: 한국어** 기본.
- 코드 식별자(변수/함수/클래스): 영어.

### 브랜치 전략
- `main`: 배포 가능한 안정 브랜치. 직접 push 지양.
- 작업 브랜치: `feature/<요약>`, `fix/<요약>`, `docs/<요약>`.
- 작업 완료 후 PR로 `main` 병합.

### 커밋 컨벤션 (Conventional Commits)
```
<type>: <요약>

feat:     새 기능
fix:      버그 수정
docs:     문서
refactor: 리팩터링(기능 변화 없음)
chore:    빌드/설정/잡무
test:     테스트
```
- **작은 단위로 원자적 커밋.** 한 커밋은 한 가지 일만.
- 시크릿/키/개인정보를 커밋에 포함하지 않는다.

### 코딩 컨벤션
- **백엔드**: 표준 Spring Boot 레이어(Controller → Service → Repository). DTO로 요청/응답 분리. 엔티티를 그대로 노출하지 않는다. 예외는 공통 핸들러에서 처리.
- **프론트**: 함수형 컴포넌트 + 훅. API 호출은 `src/api/`에 집중(컴포넌트에서 직접 fetch 남발 금지). 타입은 명시.
- 새 코드는 **주변 코드 스타일을 따른다.** 불필요한 재작성 지양, 재사용 우선.

### 문서 규칙
- 의사결정이 바뀌면 이 `CLAUDE.md`와 관련 `docs/*`를 **같은 PR에서** 갱신.
- 기능 범위/우선순위 변경은 `docs/FEATURES.md`에 반영.

### ⭐ 진행 기록 규칙 (필수 — 이어받기 위한 핵심)
- **작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때, 반드시 [docs/PROGRESS.md](docs/PROGRESS.md)를 갱신하고 커밋한다.**
- `PROGRESS.md`에는 항상 "지금 위치 / 방금 한 일 / **다음에 할 일** / 블로커"를 최신으로 유지한다.
- 이어받는 세션(다른 PC 포함)은 **가장 먼저 `docs/PROGRESS.md`를 읽고** 거기 적힌 "다음에 할 일"부터 시작한다.
- Phase 상태가 바뀌면 [docs/ROADMAP.md](docs/ROADMAP.md)의 상태표(⬜/🔄/✅)도 함께 갱신한다.

---

## 8. 개발 로드맵 (Phase)

MVP까지가 Phase 0~3. 이후 단계적 확장.

| Phase | 내용 | 상태 |
|---|---|---|
| **0** | 스캐폴딩 & 배포 파이프라인 (hello world 배포 검증) | ⬜ 예정 |
| **1** | 인증(회원가입/로그인 JWT) & 대시보드 골격 | ⬜ |
| **2** | 랜딩 CRUD + 공개 렌더 + 폼 제출/리드 수집 (핵심 루프) | ⬜ |
| **3** | 리드 대시보드 + CSV 내보내기 **(MVP 완성)** | ⬜ |
| **4** | 랜딩페이지 빌더(블록 에디터 + 이미지 업로드) | ⬜ |
| **5** | 팀 CRM(팀플): 팀원·DB 자동배정·진행상태·통계 | ⬜ |
| **6** | 업종별 템플릿 | ⬜ |
| **7** | 결제/구독(PortOne·토스), 마케팅 트래킹·통계·보안 고도화 | ⬜ |

> 각 Phase는 끝에 "검증(스모크 테스트)"을 통과해야 완료로 본다. 상세 검증 항목은 실행 계획(plan) 참고.

---

## 9. 확정된 의사결정 로그

| 결정 | 내용 | 이유 |
|---|---|---|
| 백엔드 프레임워크 | **Spring Boot** | 사용자가 Java 개발자 |
| 프론트 | **React + Vite SPA** | 빌더 등 리치 UI 필요, Cloudflare Pages 무료 배포 |
| DB | **PostgreSQL** | JSONB(랜딩 content_json/리드 값) 강력, 무결성 엄격, 이식성 |
| 프론트 호스팅 | **Cloudflare Pages** | 무료, 상업적 사용 허용, git 자동배포 |
| 백엔드 호스팅(초기) | **Oracle Cloud Always Free VM** | 영구 무료, Spring 상주 가능 |
| 배포 이식성 | **Docker 컨테이너화** | 유료 VPS/Cloud Run/AWS로 자유 이전 |
| Git 원격 | **GitHub** | — |
| 비용 전략 | 무료로 시작 → 성장 시 유료 이전/결제 도입 | 부트스트랩 |

---

## 10. 이어받는 사람을 위한 빠른 안내

1. **가장 먼저 [docs/PROGRESS.md](docs/PROGRESS.md)를 읽는다** → "다음에 할 일"부터 이어서 시작.
2. 배경이 필요하면 이 문서 → `docs/ROADMAP.md` → `docs/SPEC.md` → `docs/FEATURES.md` 순으로 읽는다.
3. `docker-compose up` + `frontend`에서 `npm run dev`로 로컬을 띄운다.
4. 새 작업은 작업 브랜치에서, 원자적 커밋으로, 문서 갱신과 함께 진행한다.
5. **작업을 멈출 때 반드시 `docs/PROGRESS.md`를 갱신·커밋한다** (진행 기록 규칙).
