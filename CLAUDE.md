# CLAUDE.md — Leadpot(리드팟) 작업 규칙

> 이 문서는 **누구나 · 어디서나 · 이 작업을 이어서 할 수 있도록** 하는 프로젝트의 최상위 규칙이다.
> 작업을 시작하기 전에 반드시 이 문서를 먼저 읽는다. 규칙이 바뀌면 이 문서를 갱신한다.
> **이어받을 때**: 이 문서 → [docs/ROADMAP.md](docs/ROADMAP.md)(진행상황) → [docs/SPEC.md](docs/SPEC.md) 순서로 읽는다.

- **서비스명**: Leadpot (리드팟)
- **저장소**: https://github.com/gooinsung/Leadpot

---

## 1. 프로젝트 개요

실제 서비스 중인 **디비카트(dbcart.net)** 를 벤치마킹한 **랜딩페이지 제작 + 상담 DB(리드) 수집 + 리드 관리(CRM)** 웹 서비스. 서비스명은 **Leadpot(리드팟)**.

- 사용자가 코딩 없이 랜딩페이지를 만들고, 공개 URL로 배포한다.
- 방문자가 폼(이름·연락처 등)을 남기면 DB(리드)로 수집된다.
- 수집된 리드를 대시보드/CRM으로 관리한다.
- 최종 목표: 디비카트 전체 기능 벤치마킹 + 자체 기능 확장. 실서비스 운영.

자세한 기능/명세는 [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/SPEC.md`](docs/SPEC.md) 참고.

---

## 2. 기술 스택 (확정)

| 구성 | 선택 | 배포처(무료 시작) |
|---|---|---|
| 프론트엔드 | **React + Vite (TypeScript) SPA** | Cloudflare Pages (GitHub 연동 자동배포) |
| 백엔드 | **Spring Boot (REST API) + Docker** | Oracle Cloud "Always Free" VM |
| DB | **PostgreSQL** | Oracle VM 내 Docker 컨테이너 |
| 파일 저장 | 초기: VM 디스크 → 후기: Cloudflare R2 / S3 | — |
| 인증 | **JWT** (Spring Security + BCrypt) | — |
| 결제(후기) | PortOne(아임포트) / 토스페이먼츠 | — |

**이식성 원칙 (중요)**: 백엔드는 Docker 컨테이너로, DB는 표준 PostgreSQL로 유지한다.
→ 나중에 유료 VPS(Hetzner)·Google Cloud Run·AWS 등 어디로든 코드 수정 거의 없이 이전 가능해야 한다.
특정 플랫폼 전용 기능(락인)에 의존하지 않는다.

---

## 3. 아키텍처

```
[방문자 / 사용자]
   │
   ▼
React SPA ───────────── Cloudflare Pages (정적 자산, 무료)
   │  HTTPS API 호출 (api.도메인)
   ▼
Cloudflare DNS(프록시, 무료 SSL) ── Oracle VM
                                     ├─ Nginx (리버스 프록시)
                                     ├─ Spring Boot (Docker) :8080
                                     └─ PostgreSQL (Docker)
```

- 프론트: `app.도메인` (Cloudflare Pages) / 백엔드: `api.도메인` (Oracle VM)
- 서로 다른 오리진 → **CORS 설정 필수** (허용 오리진을 환경변수로 관리)
- 시크릿/키는 **절대 코드·git에 커밋하지 않는다.** `.env`(git 무시) 또는 배포 환경변수로만 관리.

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

### 프론트엔드 → Cloudflare Pages
- GitHub `main` 브랜치에 push하면 자동 빌드/배포.
- Pages 프로젝트 설정: **루트 디렉터리** `frontend`, **빌드 명령** `npm run build`, **출력 디렉터리** `dist`.
- 환경변수 `VITE_API_BASE_URL` = `https://api.도메인` 설정.

### 백엔드 → Oracle Cloud VM
- VM에서 Docker로 Spring + Postgres 컨테이너 실행.
- 배포: git pull → `docker-compose up -d --build` (또는 이미지 재기동).
- Cloudflare에서 `api.도메인` A레코드를 VM 공인 IP로, 프록시 ON → 무료 SSL.
- 상세 절차는 인프라 세팅 단계에서 별도 가이드로 문서화한다.

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
