# Leadpot (리드팟)

랜딩페이지로 리드(상담 DB)를 수집·관리하는 웹 서비스. 실제 서비스 **디비카트(dbcart.net)** 를
벤치마킹해 직접 구현하고 확장했다. **실서비스 운영 중** — https://app.lead-pot.com

**차별점**: 입력폼을 랜딩과 **독립적으로 만들어 여러 랜딩에서 재사용**, 폼 유형 확장 구조
(**기본형 / 선택형(스텝)**), 폼 본문에 **이미지·HTML 콘텐츠 블록** 삽입, **광고주 하위계정 포털**.

## 구성

| 구성 | 기술 | 배포처 | 주소 |
|---|---|---|---|
| 관리 앱 | React 19 + Vite (TS) SPA | Cloudflare Pages | `app.lead-pot.com` |
| 공개 랜딩 | Next.js 16 (App Router) SSR | Cloudflare Workers | `go.lead-pot.com/{sub}/{id}` |
| 백엔드 | Spring Boot + Java 21 (Docker) | Railway (싱가포르) | `api.lead-pot.com` |
| DB | PostgreSQL 18 | Railway Postgres (내부망 전용) | — |
| 이미지 | — | Cloudflare R2 | — |

**이식성 원칙**: 백엔드는 Docker, DB는 표준 Postgres로 유지해 어디로든 옮길 수 있게 한다.
실제로 백엔드가 Oracle VM → Railway로, DB가 Neon → Railway Postgres로 코드를 거의 안 건드리고
이전됐다.

## 저장소 구조 (모노레포 · npm workspaces)

```
backend/            Spring Boot REST API + Flyway 마이그레이션(V1~V43)
frontend/           관리 앱(로그인·대시보드·빌더·광고주 포털) React SPA
renderer/           공개 랜딩 SSR (Next.js + OpenNext Cloudflare 어댑터)
packages/public-ui/ ⭐ frontend·renderer 가 공유하는 공개 렌더링 컴포넌트
docs/               기획·설계·진행 기록
```

> ⭐ **공개 화면에 뭔가를 그린다면 `packages/public-ui/` 에 넣어야 한다.** `frontend/` 에만 넣으면
> 실서비스 공개 랜딩(SSR)에는 반영되지 않는다.

## 문서 (읽는 순서)

1. **[AGENTS.md](AGENTS.md)** — 작업 지침 (AI 에이전트·신규 참여자 진입점)
2. **[docs/PROGRESS.md](docs/PROGRESS.md)** — 지금 위치 / 다음에 할 일 ← **이어받을 땐 항상 여기부터**
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — 코드베이스 지도 (모듈·DB·API·라우트 전체)
4. [CLAUDE.md](CLAUDE.md) — 작업 규칙 정본(상세·배경)
5. [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/SPEC.md](docs/SPEC.md) ·
   [docs/FEATURES.md](docs/FEATURES.md) · [docs/BACKLOG.md](docs/BACKLOG.md) — 기획

## 로컬 실행

사전 요구: **JDK 21+**, **Node 20+**, **Docker**

```bash
npm install                                # 루트에서 (npm workspaces)

# 백엔드 + DB
docker compose up -d db                    # postgres:18 → localhost:5432
cd backend
cp src/main/resources/application-local.properties.example \
   src/main/resources/application-local.properties
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun     # → :8080 (Flyway가 스키마 자동 생성)
curl http://localhost:8080/api/health               # {"status":"UP"}

# 관리 앱
cd frontend && npm run dev                 # → http://localhost:5173

# 공개 랜딩 렌더러
cd renderer && cp .env.local.example .env.local && npm run dev   # → http://localhost:3000
```

로컬 DB는 프로덕션과 완전히 분리돼 있다(프로덕션은 Railway 내부망 전용이라 외부 접근 불가).

## 검증

```bash
cd backend  && ./gradlew test              # 단위 + 통합(@SpringBootTest 는 DB 필요)
cd frontend && npx tsc -b && npx vitest run
cd packages/public-ui && npx vitest run
cd renderer && npx next build
```

## 배포

`main` 에 push 하면 경로별로 자동 배포된다(수동 배포 없음).
`frontend`·`packages/public-ui` → Cloudflare Pages / `renderer`·`packages/public-ui` →
Cloudflare Workers / `backend` → Railway(자체 GitHub 연동).

🔴 **`main` push = 즉시 실서비스 반영.** 작업은 브랜치에서 하고 PR로 병합한다.
