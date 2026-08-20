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

## 2. 기술 스택 (2026-08-20 기준 실제 구성)

> ⚠️ 아래 "배포처"는 **지금 실제로 도는 곳**이다. 최초 기획(§9 의사결정 로그)과는 다르다 —
> 백엔드·DB는 이미 이전됐고, 프론트만 아직 과거 계획(Oracle VM)에 남아 있다. 상세·실측치는
> [docs/DEPLOY.md](docs/DEPLOY.md) 부록 C, 남은 이전 단계는 [docs/HOSTING-MIGRATION-PLAN.md](docs/HOSTING-MIGRATION-PLAN.md).

| 구성 | 선택 | 지금 배포처 |
|---|---|---|
| 프론트엔드 | **React + Vite (TypeScript) SPA** | **Oracle VM 의 Nginx**(`app.lead-pot.com`, GitHub Actions 가 rsync, §6) — 추후 **Railway 또는 Cloudflare Pages**로 이전 예정(미정, 둘 중 하나) |
| 백엔드 | **Spring Boot (REST API) + Docker** | **Railway**(싱가포르, `api.lead-pot.com`) — 2026-08-09 Oracle VM에서 컷오버 완료 |
| DB | **PostgreSQL** | **Neon**(외부 호스팅, 무료) |
| 파일 저장 | 초기: VM 디스크 → 후기: Cloudflare R2 / S3 | — |
| 인증 | **JWT** (Spring Security + BCrypt) | — |
| 결제(후기) | PortOne(아임포트) / 토스페이먼츠 | — |

**이식성 원칙 (중요)**: 백엔드는 Docker 컨테이너로, DB는 표준 PostgreSQL로 유지한다.
→ 나중에 유료 VPS(Hetzner)·Google Cloud Run·AWS 등 어디로든 코드 수정 거의 없이 이전 가능해야 한다.
특정 플랫폼 전용 기능(락인)에 의존하지 않는다. (실제로 백엔드·DB가 Oracle VM → Railway/Neon 으로
코드 거의 안 건드리고 옮겨간 것이 이 원칙 덕분이다.)

---

## 3. 아키텍처 (2026-08-20 기준 실제 구성)

```
[방문자 / 사용자]
        │
        ▼
Cloudflare DNS(프록시, 무료 SSL)
        │
        ├─ app.lead-pot.com ─▶ Oracle VM Nginx ─▶ React SPA(정적 파일)
        │                        (추후 Railway 또는 Cloudflare Pages로 이전 예정)
        │
        └─ api.lead-pot.com ─▶ Railway(싱가포르) ─▶ Spring Boot(Docker)
                                                          │
                                                          ▼
                                              Neon(PostgreSQL, 외부 호스팅)
```

- 프론트: `app.lead-pot.com` (Oracle VM Nginx) / 백엔드: `api.lead-pot.com` (Railway) / DB: Neon
- 서로 다른 오리진 → **CORS 설정 필수** (허용 오리진을 환경변수로 관리)
- 시크릿/키는 **절대 코드·git에 커밋하지 않는다.** 프론트·VM 은 `.env`(git 무시), 백엔드는 **Railway Variables**로만 관리(§6).

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
├─ frontend/                  # React + Vite (TypeScript)
│   ├─ src/
│   │   ├─ pages/             # 화면(대시보드/로그인/빌더/공개랜딩)
│   │   ├─ components/        # 재사용 컴포넌트
│   │   ├─ api/               # 백엔드 API 클라이언트
│   │   └─ lib/               # 유틸/훅
│   ├─ .env.example
│   ├─ vite.config.ts
│   └─ package.json
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

> ⚠️ **아래는 실제 구성이다(2026-08-04 코드로 확인).** 초기 계획(프론트=Cloudflare Pages)과 다르다 —
> 프론트·백엔드 **둘 다 GitHub Actions 가 Oracle VM 으로 배포**한다. Cloudflare 는 DNS·SSL 프록시만 담당한다.
> 상세·실측치는 [docs/DEPLOY.md](docs/DEPLOY.md) 부록 C.

> 🚚 **백엔드는 이미 Railway 로 이전됐다 (Phase A 컷오버 완료 2026-08-09, 커밋 `611d3eb`).**
>
> | | 지금 어디서 도는가 | 배포 | 환경변수 |
> |---|---|---|---|
> | **백엔드** `api.lead-pot.com` | **Railway(싱가포르)** | `main` push → Railway 가 `backend/**` 감지해 자동 배포 | **Railway → Variables 화면**(저장하면 무중단 재배포) |
> | **프론트** `app.lead-pot.com` | 아직 Oracle VM Nginx | `main` push → GitHub Actions rsync | — |
>
> - 랜딩 API 실측 **850~980ms → 220~246ms**. VM 은 프론트 때문에 아직 살아 있다.
> - **push 하면 VM(Actions)과 Railway 둘 다 배포된다**(이전 기간 의도). 실제 API 트래픽은 Railway 만 받는다.
> - ⚠️ **시크릿을 SSH 로 고치지 말 것.** 백엔드 환경변수는 이제 **Railway Variables** 다.
>   아래 §6 본문의 "VM `.env` 를 SSH 로 편집" 설명은 **프론트·VM 에만 해당**하는 옛 절차다.
> - 남은 단계(프론트 → **Railway 또는 Cloudflare Pages**로 이전, 어느 쪽인지 미정 · VM 종료)는
>   [docs/HOSTING-MIGRATION-PLAN.md](docs/HOSTING-MIGRATION-PLAN.md) — 이 문서는 아직 Cloudflare Pages 단독 기준으로
>   쓰여 있어 이전 대상이 정해지면 함께 갱신해야 한다(2026-08-20 사용자: Railway 도 후보로 고려 중).
>   **VM 을 내리는 날 Railway 에서 `APP_LEAD_AUTO_APPROVE_ENABLED=true` 로 켜는 것을 잊지 말 것** ⭐
>   §2·§3 은 2026-08-20 에 실제 구성으로 갱신 완료 — 프론트 이전이 끝나면 이 §6 표와 §2·§3 을 다시 갱신한다.

**`main` 에 push 하면 아래 두 워크플로가 경로별로 자동 실행된다(+ Railway 가 백엔드를 따로 배포한다). 수동 배포는 필요 없다.**

| 워크플로 | 트리거 경로 | 하는 일 | 소요 | 다운타임 |
|---|---|---|---|---|
| [deploy-frontend.yml](.github/workflows/deploy-frontend.yml) | `frontend/**` | 러너에서 `npm run build`(`VITE_API_BASE_URL=https://api.lead-pot.com` 주입) → rsync 로 VM `/var/www/leadpot/` | 1~2분 | **없음** (해시 자산 먼저 올리고 `index.html` 을 마지막에 교체) |
| [deploy-backend.yml](.github/workflows/deploy-backend.yml) | `backend/**`·`docker-compose.prod.yml` | **러너에서 테스트+`bootJar`** → jar 을 VM 으로 `scp` → SSH `git pull` → `docker compose -f docker-compose.prod.yml up -d --build`(jar COPY 만) → `/api/health` 가 `UP` 될 때까지 대기 | **2~3분** | **약 1분** |

- 필요한 저장소 시크릿: `VM_SSH_KEY` · `VM_HOST` · `VM_USER`.
- ⚠️ **백엔드 배포는 약 1분 끊긴다**(컨테이너가 하나뿐이라 내리고 올린다). 무중단은 서버 업그레이드 후 과제.
- ⚠️ **로컬과 배포의 Dockerfile 이 다르다.** 로컬 `docker compose up` = `backend/Dockerfile`(컨테이너 안에서 빌드) / 배포 = `backend/Dockerfile.runtime`(만들어진 jar 만 COPY). **합치지 말 것** — 상세는 DEPLOY.md 부록 C-3.
- ⚠️ **`docker-compose.prod.yml` 을 손으로 돌리면 실패한다** — `backend/build/libs/app.jar` 이 먼저 있어야 한다.
- ⚠️ **시크릿은 자동 배포 대상이 아니다.** VM 의 `~/Leadpot/.env`(gitignore)에만 있어 값이 바뀌면 SSH 로 직접 고치고 재기동해야 한다.
- DB 는 **Neon**(외부 호스팅 Postgres)이다. VM 안에 Postgres 컨테이너를 띄우지 않는다.

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
