# docs/PROGRESS.md — 이어서 작업하는 지점 (RESUME HERE)

> **이 파일만 보면 "어디서부터 이어서 하면 되는지" 알 수 있다.**
> 규칙: 작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 **이 파일을 갱신하고 커밋**한다. (CLAUDE.md의 진행 기록 규칙 참고)
> 상세 로드맵은 [ROADMAP.md](ROADMAP.md).

---

## 📍 지금 위치

- **현재 Phase**: Phase 0 — 프로젝트 셋업 & 배포 파이프라인
- **상태**: 🔄 진행중 (막 시작)

## ✅ 방금까지 한 일 (2026-07-23)

- 기획·분석·설계 문서 전체 작성 (CLAUDE / SPEC / FEATURES / BACKLOG / DBCART-ANALYSIS / ROADMAP)
- 1차 범위 34개 확정
- Git 저장소 연결 및 문서 첫 커밋/푸시 (https://github.com/gooinsung/Leadpot)
- 로컬 환경 점검: Node 22 ✅ / **JDK 8 ⚠️(21 필요)** / **Docker 미설치 ⚠️**

## 👉 다음에 할 일 (여기서 이어서)

1. **(사용자 준비물)** 백엔드 검증을 위해 설치 필요:
   - **JDK 21** (Eclipse Temurin 등) — Spring Boot 3.x 실행에 필수
   - **Docker Desktop** — PostgreSQL 및 컨테이너 실행용
2. **프론트 스켈레톤 생성** (React+Vite TS) — Node만 있으면 되므로 바로 진행/검증 가능
3. **백엔드 스켈레톤 생성** (Spring Boot, Gradle, Java21) + `/api/health`
4. **docker-compose.yml** (Spring + PostgreSQL) 구성
5. **로컬 검증**: 프론트에서 `/api/health` 호출 성공 확인
6. (이후) 배포 파이프라인: Cloudflare Pages(프론트) + Oracle VM(백엔드) — 계정 준비되면

## 🚧 블로커 / 준비물

- JDK 21 미설치 → 백엔드 빌드·실행 불가 (설치 필요)
- Docker 미설치 → docker-compose 실행 불가 (설치 필요)
- Oracle Cloud VM / Cloudflare 계정 → 배포 단계에서 필요

## 🔗 참고

- 브랜치: `main`
- 최근 커밋: `docs: 프로젝트 기획·설계 문서 초기 커밋 (Leadpot)`
