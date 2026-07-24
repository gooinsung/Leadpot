# docs/PROGRESS.md — 이어서 작업하는 지점 (RESUME HERE)

> **이 파일만 보면 "어디서부터 이어서 하면 되는지" 알 수 있다.**
> 규칙: 작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 **이 파일을 갱신하고 커밋**한다. (CLAUDE.md의 진행 기록 규칙 참고)
> 상세 로드맵은 [ROADMAP.md](ROADMAP.md).

---

## 📍 지금 위치

- **✅ 서브도메인 관리(D3) 검증 완료 (2026-07-24, gooinsung PC)**: 백엔드 빌드+테스트 통과 / API 스모크 전부 통과 / 브라우저에서 `{sub}.localhost:5173/{id}` 공개 렌더·루트 404 확인. 브랜치 `feature/d3-subdomain`(코드 커밋 ce10518).
  - **DB = Neon(무료 호스팅 Postgres)로 전환** — "모든 환경 공유 DB 한 대". 접속정보는 `backend/application-local.properties`(**gitignore됨·커밋금지**)에 저장, profile `local`로 기동. Flyway V1~V10 Neon에 적용됨(리전 ap-southeast-1).
  - **⚙️ 이 PC 환경 세팅(gooinsung PC = `C:\Users\gooinsung\git\Leadpot`)**: JDK21(`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`, winget) 설치, `npm install` 완료. Docker/WSL은 미설치(Neon 쓰므로 불필요).
  - **❗ 로컬 실행 필수 플래그**: 이 PC는 기본 임시폴더 경로가 길어 JDK21 NIO의 AF_UNIX self-pipe가 실패("Unable to establish loopback connection") → **사용자 환경변수 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\Temp` 설정으로 해결**(설정 완료). 새 셸부터 자동 적용. (Java NIO 서버 전반에 필요)
  - **▶️ 로컬 실행법(현재)**: `C:\Temp` 존재 + 위 env 적용 상태에서 — 백엔드 `cd backend; $env:SPRING_PROFILES_ACTIVE='local'; .\gradlew.bat bootRun` (→ :8080, Neon 연결) / 프론트 `cd frontend; npm run dev` (→ :5173). 서브도메인 테스트는 `http://{내서브도메인}.localhost:5173/{랜딩번호}`.
  - **남은 것**: `feature/d3-subdomain` → `main` PR 병합 / SPEC·FEATURES 문서에 D3 반영 / 배포용 와일드카드 DNS·SSL(사용자 리소스, 나중).
- **현재 위치**: **핵심 루프(폼 공개→제출→리드 수집→조회) 완성 ✅** — 실제 데이터가 쌓임(방문자정보 포함) + **통계 대시보드 ✅**
- **완료**: Phase 1 인증 ✅ / Phase 2 폼 빌더 ✅ / **리드 수집(Phase 4 앞당김) ✅** / **Phase 3 랜딩 빌더 & 폼 연결 ✅** / **리드 상태변경·CSV 내보내기 ✅** / **이미지 업로드 R2 연동(경로 구조화 landing-image/YYYY/MM/DD) ✅** / **통계 고도화(방문 추적+전환율+순방문·트래픽 분리+일/주/월+호버툴팁+기간/대상 필터+랜딩/폼별) ✅** / **동의문서 이름/제목/내용 분리 ✅**
- **추가 폼 개선(2026-07-24)**: 공개 폼 이름 숨김 · 동의 항목 기본체크 설정 · 공개 폼 모바일 최적화(1차) · **스텝형 답변 방식 확장**(카드 단일/다중 + 선택박스·텍스트·장문·연락처·이메일·숫자·날짜) · **마지막 단계 커스텀 안내문구**(typeConfig.contactMessage) · 스텝 입력형 간격 개선 · **중복 제출 방지(K3)**: 항목별 중복허용/유효기간 + 폼 동일IP 접수허용(settings_config, Flyway V6)

## 👉 다음에 할 일 (이어받는 세션은 여기부터)

> ### ⭐ 바로 다음 작업 = **D3 마무리(PR 병합·문서 반영) → 다음 기능**
> **D3 검증 완료(2026-07-24)** — 결정 확정: ① 루트=**404** · ② 식별자=**번호+슬러그 둘 다** · ③ `/p/{slug}`=**소유자 전용 미리보기(draft 포함)**, 공개는 서브도메인 URL. DB=**Neon 공유**.
> **✅ 검증 결과**: 백엔드 build+test 통과 / 가입 랜덤부여·변경200·예약어400·형식400·중복409 / 공개해석 번호200·슬러그200·draft404·없음404 / 미리보기 소유자200·비로그인401·타인404 / 브라우저 `{sub}.localhost:5173/{id}` 렌더·루트404.
> **남은 마무리**: (a) `feature/d3-subdomain` → `main` PR 병합, (b) SPEC(§4)·FEATURES(D)·ROADMAP에 D3 상태/설계 반영, (c) 배포 시 와일드카드 DNS·SSL(사용자 리소스).
>
> **구현 요약(작성분)** — 브랜치 `feature/d3-subdomain`:
>   - 백엔드: Flyway **V10**(`users.subdomain` unique + 기존행 랜덤 백필), `User.subdomain`, `Subdomains`(형식·예약어·랜덤), 가입 시 자동부여, `PATCH /api/auth/subdomain`, `UserResponse.subdomain`, 공개 해석 `GET /api/public/sites/{subdomain}/{identifier}`, 소유자 미리보기 `GET /api/landings/preview/{slug}`, `PublicLandingController` 삭제→`PublicSiteController` 신설, CORS `http://*.localhost:5173` 허용(배포 시 `https://*.도메인` 추가).
>   - 프론트: `lib/site.ts`(`currentSubdomain`/`publicSiteUrl`), `api`(resolveSite·getLandingPreview·updateSubdomain·`AuthUser.subdomain`), `App` 서브도메인 분기 라우팅, `components/LandingView`(렌더 추출), `pages/PublicSitePage`, `/p/:slug`→소유자 미리보기, 대시보드 계정설정 UI, `AuthContext.updateUser`, 랜딩목록 "공개 열기(서브도메인)/미리보기(/p)" 분리.
>   - **아직 안 한 것**: 빌드·타입체크·DB초기화·API/브라우저 스모크 전부(위 1~5). SPEC/FEATURES 문서에 D3 반영도 미완.
>
> **배포 시(사용자 리소스, 나중)**: 도메인 구입 + `*.도메인` 와일드카드 DNS + 와일드카드 SSL(Cloudflare 무료) + 서브도메인에서 SPA 서빙 + `APP_CORS_ALLOWED_ORIGINS`에 `https://*.도메인` 추가.
>
> **그 다음(혼자 가능)**: M8 HTML 요소 라이브러리 → 리드폼 외부 임베드(M6) → **광고 픽셀 I1** → IP차단(K2). (~~리드 검색·필터·휴지통 E4~~ ✅ 완료)
> 사용자 리소스 필요(나중): 구글시트/텔레그램/카톡 연동, SMS 본인인증, 클라우드 배포, 도메인/와일드카드 SSL, 결제.
> ✅ Flyway 현재 **V11(lead_soft_delete)** 까지 적용됨(다음 V12). DB는 Neon 공유.
>
> **✅ 최근 완료(이번 세션 추가분, 브랜치 feature/d3-subdomain)**:
>   - **폼 입력 유효성 검사**(이메일/전화/숫자, 프론트+백엔드) — 연락처 문자 통과 버그 수정
>   - **랜딩 slug 직접 지정**(형식·중복 검증)
>   - **UI**: 로그인/회원가입 확대, 입력·긴URL 레이아웃 흔들림 방지
>   - **'폼' → '리드폼' 전면 리네임**(UI·에러메시지)
>   - **리드 관리 고도화 E4**: 검색·상태필터·휴지통(soft delete)·복원·영구삭제. Flyway V11. API 스모크 통과.
- **다음 후보**: Phase 3 랜딩 빌더 / 리드 관리 고도화(상태변경·CSV·중복방지) / 연동(구글시트·텔레그램·카톡 알림) — 택1
- **플랜에 추가된 항목(지금 X, 나중에)**:
  - 📱 **모바일 퍼스트(최상위 원칙, CLAUDE.md §0)**: 공개 화면은 99% 모바일 → 모바일 최적화 최우선. 공개 폼은 1차 적용 완료, **랜딩(Phase 3)·기타 공개 화면도 모바일 우선으로 만들 것**.
  - 🌐 **사용자별 서브도메인(D3)**: `bali.lead-pot.com` + `.../landing/{landingId}`. 와일드카드 DNS/SSL + 서브도메인 라우팅. (D2 커스텀도메인과 연계, 배포·도메인 준비 후)
  - 🔌 **구글시트 자동연동 + 텔레그램/카톡 알림**(선택형 on/off): 리드 저장 훅 자리 마련됨(`LeadService.submit` TODO). 텔레그램·구글시트 무료, 카톡 알림톡은 사업자+유료. M5 본인인증은 SMS OTP 수준(장난번호 거르기).
  - 🧩 **재사용 HTML 요소 라이브러리(M8, 요소 생성기)**: 플로팅/고정 헤더·푸터·CTA·신청현황 등을 미리 만들어 저장 → 랜딩·폼 HTML 블록에 꺼내 삽입. `html_components` 엔티티 + 관리 페이지(동의문서 패턴). 정적 요소 먼저, 동적(신청현황=실시간 리드 수 등)은 2단계. 상세는 BACKLOG M8.
- **프로젝트 위치(중요)**: PC마다 다름 — 현재 gooin PC는 **`C:\Users\gooin\git\Leadpot`** / 이전 wincube PC는 `C:\Users\wincube\projects\Leadpot`
  - Google Drive 폴더는 npm/빌드 병목 때문에 **로컬로 이전함**. 동기화는 **GitHub가 정본**.
- **결정**: Phase 1 DB 방법 = **Docker Desktop** (사용자 확정 2026-07-23). 작업 순서 = **A(디자인) 먼저 → B(Phase 1 인증)**.

## ✅ 방금까지 한 일 (2026-07-24 · 3차)

- **통계 2차 개선**: 방문을 **순 방문(고유, IP 해시 distinct)** / **총 트래픽(중복 포함 전체 접속)** 으로 분리(요약·랜딩별·폼별 모두). 전환율 = 접수/순방문. 추이 차트 **일별/주간/월별** 토글(프론트 버킷 집계) + 막대 **호버 툴팁**(구간·트래픽·리드) + 하단 축 라벨. `StatsResponse.Summary(uniqueVisits,totalVisits,leads,conversionRate)` / `EntityCount(uniqueVisits,totalVisits,...)`. API 검증 완료.
  - ⚠️ 참고: IP 해시 기반 고유 방문은 **모바일 캐리어 NAT**로 과소집계될 수 있음(전환율이 100% 넘을 수 있음). 로컬 테스트는 단일 IP라 순방문=1로 보임. 정밀도 필요 시 쿠키/로컬스토리지 방문자 ID 도입 검토.
- **동의문서 이름/제목/내용 분리**: `name`(관리용) + `title`(공개 제목) + `content`(공개 내용). Flyway V9(name 추가+백필), 엔티티/DTO/서비스/편집·목록 UI 반영, 공개 뷰(/consent/:id)는 제목+내용만 노출. API 검증 완료.

## ✅ 그 전에 한 일 (2026-07-24 · 2차)

- **통계 고도화(디비카트 벤치마킹)**: **방문(유입) 추적 신설** — `visits` 테이블(Flyway V8) + `com.leadpot.visit`(Visit/Repo/Service, `POST /api/public/visits`, IP는 SHA-256 해시만 저장). 공개 랜딩/폼 진입 시 프론트가 1회 기록(`recordVisit`, `lib/utm.ts`). **통계 API 확장**: `GET /api/stats/overview?from&to&landingId&formId` — 요약(방문/리드/**전환율**), 일별 방문·리드 추이, 상세(기기/OS/브라우저/상태/UTM 소스·매체·캠페인/유입경로), **랜딩별·폼별 표(방문/리드/전환율)**. 프론트 `StatsPage` 전면 개편(필터바=기간 프리셋+직접지정+대상선택, 이중 막대 추이, 엔티티 표 클릭→필터). API 검증 완료(방문9/리드2/전환율22.22%, 필터·날짜 정상).
  - ⚠️ 모델 한계(문서화): 랜딩 방문은 landingPageId만, 단독 폼 방문은 formId만 기록 → **랜딩에 임베드된 폼**의 방문은 폼별 전환율에 안 잡힘(랜딩별로는 정확). 총 방문 이중집계는 없음. 필요 시 추후 정교화.
- **이미지 업로드 경로 구조화**: R2/로컬 저장 키를 `landing-image/YYYY/MM/DD/{uuid}.{ext}` 로 변경(UploadController, `type` 파라미터로 폴더 접두 지정 가능, 기본 landing). 로컬 저장은 중첩 디렉터리 생성 + 경로 탈출 방지. R2 실업로드·공개 GET(200) 검증.
- **기본 레이아웃 폭 확대**: `.wrap` 최대폭 1080→1280, 좌우 패딩/카드 간격 확대(관리자 화면이 좁게 느껴진다는 피드백).
- **build.gradle UTF-8 인코딩 고정**: 한글 소스 리터럴이 플랫폼 기본 인코딩으로 깨지지 않도록 `JavaCompile.options.encoding='UTF-8'`.

## ✅ 그 전에 한 일 (2026-07-24 · 1차)

- **통계 대시보드 초판**: 백엔드 `com.leadpot.stats` 최초 도입(리드 기반 집계). 이후 위 2차에서 방문/전환율/필터로 확장.
- **버그픽스 ① 비공개 랜딩 공개 차단**: `LandingService.getPublic`이 status를 검사하지 않아 draft(비공개) 랜딩도 공개 URL로 열렸음 → published가 아니면 404(존재 노출 방지). API 검증 완료(draft=404, published=200).
- **버그픽스 ② 랜딩 편집 PC 미리보기 좌우 스크롤 제거**: `.lp-preview-stage.pc`의 고정 `width:720px`+`overflow-x:auto` → `width:100%`+`overflow-x:hidden`. 디바이스 컨테이너가 `overflow:hidden`이라 폭에 맞춰 클리핑(좌우 스크롤 없음).
- **버그픽스 ① 비공개 랜딩 공개 차단**: `LandingService.getPublic`이 status를 검사하지 않아 draft(비공개) 랜딩도 공개 URL로 열렸음 → published가 아니면 404(존재 노출 방지). API 검증 완료(draft=404, published=200).
- **버그픽스 ② 랜딩 편집 PC 미리보기 좌우 스크롤 제거**: `.lp-preview-stage.pc`의 고정 `width:720px`+`overflow-x:auto` → `width:100%`+`overflow-x:hidden`. 디바이스 컨테이너가 `overflow:hidden`이라 폭에 맞춰 클리핑(좌우 스크롤 없음).

## ✅ 이전에 한 일 (2026-07-23)

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

## ✅ Phase 3 — 랜딩 빌더 & 폼 연결 (완료 2026-07-24)
- landing_pages(Flyway V7) + `/api/landings` CRUD(K5) + 공개 `GET /api/public/landings/{slug}`(콘텐츠+연결폼 정의). 슬러그 자동생성. 리드 제출 시 `landing_page_id` 기록.
- 프론트: 랜딩 목록/편집기(블록 이미지·텍스트·HTML·폼[폼선택+inline/overlay]+미리보기), 공개 랜딩 `/p/{slug}`(모바일, 인라인 폼 + CTA 배경블러 오버레이). `PublicFormView`로 공개 폼 렌더 재사용.
- 검증: 랜딩 생성·공개GET·랜딩 경유 제출(lead.landing_page_id=1)·오버레이 모달.

## ✅ 이미지 업로드 (완료 2026-07-24)
- 백엔드 `POST /api/uploads`(multipart, 로그인) → 로컬/VM 디스크 저장 → 공개 URL(`/uploads/{file}`). 이미지 타입·5MB 검증, `/uploads/**` 공개 서빙. `app.uploads.dir`(기본 `./data/uploads`), docker-compose `uploads` 볼륨.
- 프론트 `ImageUploadField`(파일 업로드 + URL 직접입력 겸용) — 폼·랜딩 IMAGE 블록에 적용. 업로드 후 절대 URL 저장.
- 저장소: 초기 VM 디스크 → **후기 Cloudflare R2/S3로 교체**(계정 준비 시). 검증: 업로드201·공개GET200·비이미지400·미인증401.

## 🎯 (완료) Phase 3 기획 계획 — 참고 (기획 재검증 완료 2026-07-24)

**확정 결정**:
- **랜딩 콘텐츠 = 블록 방식**: 폼 빌더처럼 이미지/텍스트/HTML + "폼" 블록을 순서대로 배치(B3 이미지 상하배치 자연 포함). B5 요소 자동배치는 2차 제외.
- **폼 연결 = 인라인 + CTA 오버레이 둘 다**: 폼 블록의 노출방식(inline / button_overlay) 선택.
- **모바일 퍼스트**(최상위 원칙)로 공개 랜딩 최적화 필수.

**구현 계획**:
1. 백엔드: `landing_pages`(owner_id·title·slug unique·content_json·status) (Flyway **V7** — V1~V6 사용중: users/forms/consent_documents/form_style/leads/form_settings), CRUD `/api/landings`(본인만 K5) + 공개 `GET /api/public/landings/{slug}`(콘텐츠 + 연결폼 정의). 폼 연결은 content_json 블록 안에 formId+trigger로 임베드(별도 landing_page_forms 테이블은 생략, MVP). 리드 제출 시 landing_page_id 채우기.
2. 프론트: 랜딩 목록 / 랜딩 편집(블록: 이미지·텍스트·HTML·폼블록[폼 선택+inline/overlay], 실시간 미리보기 B7) / 공개 랜딩 `/p/{slug}`(모바일 최적화, 인라인 폼 + CTA 오버레이). 공개 폼 렌더링(PublicFormPage) 재사용 위해 폼 렌더 컴포넌트 추출.
- ✔ 검증: 랜딩 생성→폼 연결→미리보기→공개 URL 제출→리드에 landing 기록

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

## ✅ 리드 수집 핵심 루프 (2026-07-23, main)
- **leads 테이블(Flyway V5)** + Lead 엔티티: answers/consents/utm(JSONB) + 방문자정보(submitter_ip·device·os·browser·language·referer)
- **공개**: `GET /api/public/forms/{id}`(렌더 데이터), `POST /api/public/leads`(제출) — 필수항목/필수동의 서버검증, UA 파싱(UserAgentParser), X-Forwarded-For, UTM 수집
- **조회**: `GET /api/leads?formId=`(본인 폼만 K5), `GET /api/leads/count`
- **프론트**: 공개 폼 `/f/{id}`(실제 입력·제출·완료화면/리다이렉트, BASIC/STEP, 색상 반영), 리드 목록 `/forms/{id}/leads`(답변+방문자정보 카드 + 공개링크 복사/열기), 대시보드 실제 리드 수, 폼 목록 '리드' 버튼
- **검증**: 제출201·필수누락400·조회(device/os/browser/ip/lang/referer/utm)·카운트 / 브라우저 실제 제출→완료화면→목록 표시(한글 정상)
- **통합 훅 자리**: `LeadService.submit()` 끝에 TODO — 추후 구글시트 append / 텔레그램·카톡 알림 발송 지점
- **보류(Phase 5/후속)**: 리드 상태변경·CSV·중복방지(K3)·IP차단(K2)·휴지통. landing_page_id는 nullable(Phase 3 랜딩 붙으면 채움)

## 🔌 현재 폼 API 요약 (Phase 3에서 랜딩이 폼을 연결할 때 참고)
- `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/{id}` (본인만). Form 설정(모두 JSONB): formType(BASIC/STEP), blocks(FIELD/IMAGE/HTML/TEXT/DIVIDER/CHOICE; FIELD options: fieldType·choices·allowDuplicate·dedupDays), consentConfig.items(title·required·defaultChecked·linkType·url·documentId), submitButtonConfig(label), successConfig(mode message/redirect·title·message·redirectUrl), styleConfig(buttonColor·accentColor), typeConfig(STEP contactMessage), settingsConfig(allowSameIp·ipDedupDays), requirePhoneVerification
- 공개 폼: `GET /api/public/forms/{id}`, `POST /api/public/leads`(방문자정보+UTM 수집, 필수/중복 검증), 공개 폼 URL `/f/{id}`
- 리드: `GET /api/leads?formId=`(본인), `GET /api/leads/count`. 리드 목록 `/forms/{id}/leads`
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
- **M5 본인인증 방향 확정(2026-07-23)**: 목적 = "장난번호 거르기" → **SMS OTP(번호 확인) 수준**으로 충분(실명 PASS 인증 불필요). 리드 수집 붙일 때 SMS API(CoolSMS/알리고/NHN/SENS 중 택1) 연동. **지금은 토글 자리만, 실제 연동 보류.**

## 🔗 참고

- 저장소: https://github.com/gooinsung/Leadpot · 브랜치: `main`
- 백엔드 스택 확인: Spring Boot **4.1.0**, Java 21, Gradle 9.5.1 (starter: webmvc + actuator)
