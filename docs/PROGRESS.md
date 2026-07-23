# docs/PROGRESS.md — 이어서 작업하는 지점 (RESUME HERE)

> **이 파일만 보면 "어디서부터 이어서 하면 되는지" 알 수 있다.**
> 규칙: 작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 **이 파일을 갱신하고 커밋**한다. (CLAUDE.md의 진행 기록 규칙 참고)
> 상세 로드맵은 [ROADMAP.md](ROADMAP.md).

---

## 📍 지금 위치

- **현재 Phase**: Phase 2 — 폼 빌더(★핵심) **전체 완료 ✅ (2A·2B·2C)** — 다음은 **Phase 3(랜딩 빌더 & 폼 연결)**
- **완료**: Phase 1 인증 ✅ / Phase 2 폼 빌더 ✅ (기본형·스텝형·선택박스·동의 항목/문서·색상 커스텀·완료페이지·본인인증 자리)
- **프로젝트 위치(중요)**: PC마다 다름 — 현재 gooin PC는 **`C:\Users\gooin\git\Leadpot`** / 이전 wincube PC는 `C:\Users\wincube\projects\Leadpot`
  - Google Drive 폴더는 npm/빌드 병목 때문에 **로컬로 이전함**. 동기화는 **GitHub가 정본**.
- **결정**: Phase 1 DB 방법 = **Docker Desktop** (사용자 확정 2026-07-23). 작업 순서 = **A(디자인) 먼저 → B(Phase 1 인증)**.

## ✅ 방금까지 한 일 (2026-07-23)

- 기획·분석·설계 문서 전체 작성 + 1차 34개 확정 + GitHub 저장소 세팅
- **Phase 0 스캐폴딩 완료**:
  - 프론트(React+Vite+TS): 백엔드 연결 확인 화면, api 클라이언트, `.env.example`
  - 백엔드(Spring Boot 4 / Java 21): `/api/health` + CORS 설정, Dockerfile(멀티스테이지)
  - `docker-compose.yml`(PostgreSQL + backend, Phase 1 대비)
- **로컬 검증 성공**: 프론트(`localhost:5173`) → 백엔드(`localhost:8080/api/health`) **연결 성공(CORS 포함)** 확인
- **프로젝트를 로컬(`C:\Users\wincube\projects\Leadpot`)로 이전** (Drive 병목 해소). npm install 6초로 정상화.
- **디자인 컨셉 v1 작성 + 승인 완료** ([docs/design/concept.html](design/concept.html)) — 인디고+그린, "리드를 팟에 담다" 모티프, 스타일가이드 + 화면 목업(대시보드/폼빌더/스텝폼/공개랜딩). 사용자: "추천대로 진행"(언제든 변경 가능). 공유 링크: claude.ai/code/artifact/167af033-401e-41b1-ab3b-ddedc908d492
- **CLAUDE.md에 최상위 지침 추가**: 애매하면 임의진행 금지, 반드시 질문.
- **gooin PC 환경 세팅 완료 (2026-07-23)**: Java 21(`C:\Program Files\Java\jdk-21`, PATH·JAVA_HOME 정상), **Docker Desktop v4.83.0 설치**(WSL2 Ubuntu 기반, 엔진 29.6.2 + Compose v5.3.1), Node v22.17.0.
  - **전체 스택 스모크 테스트 성공**: `docker compose up -d --build` → `leadpot-db`(healthy)+`leadpot-backend`(Up) → `http://localhost:8080/api/health` `{"status":"UP"}` 확인. (검증 후 `docker compose stop`으로 정지해둠)
  - 프론트 `npm install` 완료. → 이 PC에서 `frontend`는 `npm run dev`, 백엔드는 `docker compose up -d` 또는 `cd backend && ./gradlew bootRun`(JAVA_HOME 수동지정 불필요)으로 바로 실행 가능.

## ▶️ 로컬 실행법 (현재 기준)

```bash
# 백엔드 (JDK 21 경로 지정해서 실행)
cd C:/Users/wincube/projects/Leadpot/backend
JAVA_HOME="C:/Users/wincube/.jdks/ms-21.0.11" ./gradlew bootRun
#   → http://localhost:8080/api/health

# 프론트
cd C:/Users/wincube/projects/Leadpot/frontend
npm install   # 최초 1회
npm run dev
#   → http://localhost:5173
```

## ❓ 사용자 확인 필요 (돌아오면 이것부터 — 최상위 지침에 따라 임의진행 안 함)

1. ✅ (해결) 디자인 컨셉 — 승인됨(추천대로).
2. ✅ (해결) Phase 1 DB 방법 = **Docker Desktop** 확정 + gooin PC에 설치·검증 완료.
3. (배포) Oracle VM·Cloudflare·도메인 준비 시점.

> 최상위 지침: 애매하거나 확인 필요한 결정은 임의진행 금지 → 반드시 질문.

## ✅ Phase 1 완료 내역 (2026-07-23, 브랜치 `feature/phase1-auth`)

- **백엔드**(Spring Boot 4 / Security 7, stateless JWT):
  - OAuth2 Resource Server + HMAC HS256, `NimbusJwtEncoder`(발급)/`NimbusJwtDecoder`(검증)
  - access/refresh 토큰(`token_type` 구분, refresh를 access로 악용 시 차단), BCrypt(delegating)
  - JPA + PostgreSQL, `User`(users) 엔티티. API: `POST /api/auth/signup·login·refresh`, `GET /api/auth/me`
  - 공통 예외/전역 핸들러(ApiError), `@Valid`, CORS를 SecurityConfig로 통합, 테스트 H2
- **프론트**(React + react-router-dom):
  - 토큰 저장(localStorage) + 401 자동 refresh 재발급, `AuthProvider`/`useAuth`, `ProtectedRoute` 가드
  - `/login`·`/signup`·`/dashboard`(본인 정보·KPI 자리·예정기능), TopBar(테마·계정·로그아웃)
- **검증**: 가입201·중복409·검증400·미인증401·/me200·로그인200·refresh200·토큰타입방어401 / 브라우저 로그인→대시보드→새로고침 세션유지→콘솔 에러0, tsc·prod 빌드 통과
- **범위 조정**: A4(비번재설정)=이메일 준비물 필요 + FEATURES상 2차 → 보류. K1(SSL)=배포 레이어 몫 → 배포 시.

## ▶️ Phase 1 로컬 실행/재현 (gooin PC 기준)

```bash
# 1) DB (Docker)
docker compose up -d db
# 2) 백엔드 (JAVA_HOME 지정 불필요)
cd backend && ./gradlew bootRun     # http://localhost:8080
# 3) 프론트
cd frontend && npm run dev          # http://localhost:5173  → /login
# 또는 전체를 컨테이너로: docker compose up -d --build
```

## 👉 다음에 할 일 (여기서 이어서 — 다른 PC에서)

### Phase 2 — 폼 빌더 (★핵심) — 기획 재검증 완료 / **2A 완료 ✅**, 다음 2B

> **2A 완료(2026-07-23, main)**: Flyway 도입(V1 users·V2 forms/form_blocks, ddl-auto=validate), Form/FormBlock 엔티티(JSONB), `/api/forms` CRUD(K5), 프론트 폼 목록·기본형 편집기(블록 추가/순서/인라인·실용형)·유형별 렌더러(M7) 실시간 미리보기.
> **2B 완료(2026-07-23, main)**: STEP을 **별도 테이블 없이 블록으로 통합**(SPEC 개선) — `BlockType.CHOICE` + `step_no` 그룹핑(form_steps 테이블 미생성). 스텝 편집기(질문 단계·선택지·연락처 단계)·StepFormRenderer(진행바+카드선택+다음/이전). 추가로 입력 항목에 **선택박스(select)** 유형(선택지 편집 + `<select>` 렌더). 브라우저·API 검증 완료.
> **2C 진행 중**:
>   - ✅ **동의 기능 강화(2026-07-23)**: 동의 항목 커스텀 리스트(기본 3개: 개인정보 수집·이용/제3자 제공(필수)·광고성 수신(선택)), 항목별 '보기' 링크(외부 URL / 내부 동의문서). **동의 문서 관리 기능 신규**(consent_documents + Flyway V3 + CRUD + 공개 뷰 `/consent/:id` + 상단 내비 "동의 문서"). 브라우저·API 검증 완료.
>   - ✅ **C1 색상 커스터마이징(2026-07-23)**: forms.style_config(jsonb, Flyway V4). 편집기 '디자인·색상'에서 제출 버튼 색 + 폼 포인트(강조) 색을 프리셋/컬러픽커/hex로 지정 → 렌더러(버튼·진행바·선택·다음·동의 체크박스) 반영. 저장 영속 검증.
>   - ✅ **C2 완료페이지/리다이렉트 + M5 본인인증 자리(2026-07-23)**: success_config(감사 메시지/리다이렉트) 편집+CompletionView 미리보기, require_phone_verification 토글(외부 연동은 추후). 기존 컬럼 재사용(마이그레이션 불필요). 영속 검증.
> **→ Phase 2 전체 완료.** 다음은 **Phase 3(랜딩 빌더 & 폼 연결: B1 단순랜딩·B3 이미지 상하배치·B5 요소 자동배치·B7 미리보기 + 랜딩에 폼 연결)**. 착수 전 SPEC(§4 landing_pages·landing_page_forms)·FEATURES(B)·ROADMAP 재정독하여 기획 재검증부터.

## 🔌 현재 폼 API 요약 (Phase 3에서 랜딩이 폼을 연결할 때 참고)
- `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/{id}` (본인만). Form: formType(BASIC/STEP), blocks(FIELD/IMAGE/HTML/TEXT/DIVIDER/CHOICE, select 필드 choices), consentConfig.items, submitButtonConfig, successConfig(mode message/redirect), styleConfig(buttonColor/accentColor), requirePhoneVerification
- `GET/POST /api/consent-documents` (본인) + `GET /api/public/consent-documents/{id}` (공개). 공개 뷰 `/consent/:id`
- 유형별 렌더러: `frontend/src/components/formRenderers/`(FormRenderer→Basic/Step + ConsentView/CompletionView/formStyle). **Phase 4 공개 폼 렌더에서 재사용 가능.**
> 참고: STEP `form_steps` 미생성은 의도적 설계(개선). 향후 SPEC 문서도 이 방향으로 정리 필요.

**재검증 결과 확정 사항**:
- **범위 재구성**(원래 10개 → 슬라이스): 
  - **2A(이번 집중, 코어)**: M1 폼 CRUD(독립·재사용) + M7 유형 확장구조 + M2 기본형(BASIC) + B2 항목/동의 + M4 콘텐츠블록 + 미리보기
  - **2B**: M3 스텝형(STEP) + 미리보기 (form_blocks/form_steps 역할 정리 포함)
  - **2C(후순위)**: C1 폼 디자인 커스터마이징, C2 완료페이지/리다이렉트 설정, M5 본인인증 필드 자리(연동X)
  - **M6 외부임베드 → Phase 4(공개·수집)로 이동** (공개 렌더 필요 → 정합)
- **빌더 UX = 실용형**(항목/블록 추가 + 위/아래 순서 + 인라인 편집). 드래그앤드롭은 2차 고도화.
- **DB 스키마 = Flyway 마이그레이션 도입** (지금부터. ddl-auto=update → validate 로 전환)

**2A 실행계획(착수 시)**:
1. 백엔드: Flyway 도입(`V1__init_users.sql`로 기존 users 반영 → `V2__forms.sql`) + `spring.jpa.hibernate.ddl-auto=validate`
2. 엔티티/모델: `Form`(owner_id, name, form_type, *_config JSONB) + `FormBlock`(sort_order, block_type, FIELD/IMAGE/HTML/TEXT/DIVIDER…) — JSONB는 `@JdbcTypeCode(SqlTypes.JSON)`
3. API: `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/{id}` (소유자 K5 필터)
4. 프론트: 폼 목록 / 폼 편집(BASIC: 항목·콘텐츠블록 추가·순서·필수/동의) / 미리보기 렌더러(유형별 렌더러 구조 M7)
- ✔ 2A 검증: 기본형 폼 생성 → 항목/블록 편집 → 저장 → 미리보기 동작 (본인 폼만 접근)

> 착수 전 H2 테스트에서 JSONB/Flyway 호환 처리 필요(테스트는 Flyway off + H2, 또는 Testcontainers 검토).

### (구) Phase 1 남은 항목 — 나중에

### A. 프론트에 디자인 시스템 적용 ✅ 완료 (2026-07-23, 브랜치 `feature/design-system`)
- 스타일링 방식: **플레인 CSS + CSS 변수(디자인 토큰)** 확정
- `src/styles/tokens.css`(concept.html 팔레트 light/dark/data-theme), `src/styles/base.css`(reset + 버튼/카드/뱃지/입력/알약 등 재사용 컴포넌트)
- `index.html`: lang=ko, title "Leadpot · 리드팟", **Pretendard(jsdelivr CDN)** + preconnect, theme-color/description
- `App.tsx`: Vite 인라인 스타일 제거 → 브랜드 셸(상단바+로고 마크+테마전환) + 브랜드화된 health 카드
- `src/lib/useTheme.ts`: system→dark→light 순환 토글, localStorage 저장
- `public/favicon.svg`: Vite 로고 → Leadpot 팟 마크로 교체. Vite 잔재 에셋(react/vite/hero/icons) 삭제
- 검증: `npx tsc -b` exit 0, dev 서버 렌더 OK, 콘솔 에러 0, 테마 토글 동작(다크 배경 #0e1020) 확인
- 참고 원본: [docs/design/concept.html](design/concept.html)
- ⏳ 남은 것: `feature/design-system` → `main` PR 병합 (사용자 확인 후)

### B. Phase 1 — 인증 & 계정 (DB 방법 확정 후)
- PostgreSQL 준비 → 백엔드에 Spring Data JPA + PostgreSQL 드라이버 + Spring Security(JWT) 추가
- users 엔티티 → 회원가입/로그인(BCrypt+JWT) → 비번재설정(A4)
- 프론트: 로그인/회원가입 화면 + 토큰 저장 + 인증 가드 + 대시보드 골격
- 리드 접근 권한(K5): 본인 리소스만
- ✔ 검증: 가입 → 로그인 → 내 데이터만 보이는 대시보드

### (원래 Phase 1 메모)

1. **PostgreSQL 준비** (Phase 1은 DB 필요):
   - Docker Desktop 설치 완료(재부팅) 후 `docker compose up db` 로 Postgres 기동, **또는** 로컬 Postgres 설치
2. 백엔드에 **Spring Data JPA + PostgreSQL 드라이버 + Spring Security(JWT)** 추가 (build.gradle)
3. **users 테이블 + 엔티티** (id, email, password_hash, name, role, plan, created_at)
4. **회원가입/로그인 API** (BCrypt 해시, JWT 발급), 비밀번호 재설정(A4)
5. 프론트: **로그인/회원가입 화면 + 토큰 저장 + 인증 가드 + 빈 대시보드**
6. 리드/데이터 **접근 권한(K5)**: 본인 소유 리소스만 접근
7. ✔ 검증: 가입 → 로그인 → 내 데이터만 보이는 대시보드 진입

## 🚧 블로커 / 준비물

- ✅ (해소) **Docker Desktop**: gooin PC 설치·기동·스모크 테스트 완료.
- ✅ (해소) **JDK 21**: gooin PC는 `C:\Program Files\Java\jdk-21` PATH·JAVA_HOME 정상 → gradlew 바로 실행. (※ wincube PC는 여전히 JAVA_HOME 수동지정 필요)
- **배포(Phase 0 잔여)**: Cloudflare Pages(프론트) + Oracle VM(백엔드) 실제 배포는 계정 준비되면.

## 🔗 참고

- 저장소: https://github.com/gooinsung/Leadpot · 브랜치: `main`
- 백엔드 스택 확인: Spring Boot **4.1.0**, Java 21, Gradle 9.5.1 (starter: webmvc + actuator)
