# docs/ARCHITECTURE.md — 코드베이스 지도 (파일만 보고 이어받기 위한 문서)

> **이 문서의 목적**: 처음 이 저장소를 여는 사람(또는 AI 에이전트)이 **"이건 이런 프로젝트고, 어디에
> 무엇이 있고, 무엇을 건드리면 무엇이 같이 깨지는지"** 를 한 번에 파악하게 한다.
> 기록(무엇을 언제 왜 했는가)은 [PROGRESS.md](PROGRESS.md), 규칙은 [../CLAUDE.md](../CLAUDE.md) ·
> [../AGENTS.md](../AGENTS.md) 에 있다. **이 문서는 "지금 코드가 어떻게 생겼나"만 다룬다.**
>
> 최종 갱신: **2026-09-15** · 기준 커밋 `367d4df` · **Flyway V43** · 백엔드 Java 239파일 ·
> 프론트 TS/TSX 83파일 · public-ui 27파일 · renderer 10파일

---

## 0. 30초 요약

**Leadpot(리드팟)** = 랜딩페이지를 만들어 공개 URL로 뿌리고, 방문자가 남긴 상담 신청(리드)을 모아
관리하는 **실서비스 중인 B2B 웹 서비스**. 실제 서비스 `dbcart.net`(디비카트) 벤치마킹.

- **실제로 돌고 있다.** 실고객(법률사무소 등)이 구글·메타·당근 광고를 이 랜딩으로 집행 중이다.
- 3개의 사용자 역할: **마케터**(주 고객, 랜딩·폼·리드 소유) / **광고주**(마케터의 하위계정, 배정받은
  리드폼의 리드만 열람) / **운영자**(우리, 계정·문자권한 관리).
- 모노레포 4덩어리: `backend`(Spring Boot) · `frontend`(관리 SPA) · `renderer`(공개 랜딩 SSR) ·
  `packages/public-ui`(둘이 공유하는 공개 렌더링 컴포넌트).

---

## 1. 배포 토폴로지 (2026-09-15 현재 실제 구성)

```
                       Cloudflare DNS (프록시 ON, 무료 SSL)
                                   │
   ┌───────────────────────────────┼────────────────────────────────┐
   │                               │                                │
app.lead-pot.com          *.lead-pot.com/*                 api.lead-pot.com
   │                     (와일드카드 Workers 라우트)                  │
   │                               │                                │
   │                     Cloudflare Workers                     Railway (싱가포르)
   │                     `leadpot-renderer`                     Spring Boot (Docker)
   │                     = renderer/ (Next.js SSR)                   │
   │                               │                                ▼
   │                  ┌────────────┼────────────┐          Railway Postgres
   │                  │            │            │          (같은 프로젝트·내부망 전용)
   │           Host="go"    Host="{sub}"   Host="app"
   │                  │      (구 서브도메인)      │
   │                  ▼            ▼            │
   │        go.lead-pot.com   301 리다이렉트     │
   │        /{sub}/{id}       → go 호스트로      │
   │        = 공개 랜딩 SSR                      │
   │                                            │
   └──────── Cloudflare Pages ◀─────────────────┘
            `leadpot-app`          (renderer/src/proxy.ts 의
            = frontend/ (React SPA)  proxyToAdminApp() 리버스 프록시)
```

| 구성 | 코드 | 배포처 | 도메인 |
|---|---|---|---|
| 관리 앱(로그인·대시보드·빌더·광고주포털) | `frontend/` | Cloudflare Pages `leadpot-app` | `app.lead-pot.com` |
| 공개 랜딩 SSR 렌더러 | `renderer/` | Cloudflare Workers `leadpot-renderer` | `go.lead-pot.com/{sub}/{id}` |
| 백엔드 REST API | `backend/` | **Railway**(자체 GitHub 연동, 이 저장소 워크플로 아님) | `api.lead-pot.com` |
| DB | — | **Railway Postgres**(내부망 전용, 외부 접근 불가) | — |
| 업로드 이미지 | — | **Cloudflare R2** (`leadpot-uploads`) | — |
| 문자·알림톡 | — | **솔라피(Solapi)** | — |

### 🔴 반드시 알아야 할 3가지 함정

1. **와일드카드 Workers 라우트는 `app.lead-pot.com` 도 가로챈다.** Cloudflare는 DNS·커스텀 도메인
   설정과 무관하게 패턴 매칭만 본다. 그래서 `renderer/src/proxy.ts` 의 `proxyToAdminApp()` 이
   `Host`가 `app`이면 관리 앱(Pages)으로 리버스 프록시한다. **이 코드를 지우면 관리 앱이 빈
   placeholder로 대체되는 실제 장애가 난다**(2026-09-07 실측).
2. **공개 랜딩은 고객별 서브도메인이 아니라 `go` 고정 호스트다**(2026-09-09~). 구글 광고 심사가
   고객 1명의 서브도메인을 "손상된 사이트"로 판정한 사고 때문. 평판은 URL이 아니라 **호스트 단위**로
   매겨지므로 전부 호스트 하나 밑의 경로로 모았다. 구 서브도메인은 301 리다이렉트만 한다(전환기).
3. **Oracle VM은 아직 켜져 있지만 실트래픽을 받지 않는다.** 롤백 안전망일 뿐이고
   `deploy-frontend.yml`(rsync)은 레거시다. VM 종료 시 그 워크플로·`Dockerfile.runtime`·
   `docker-compose.prod.yml` 을 같이 정리한다.

---

## 2. 저장소 구조와 경계

```
Leadpot/
├─ AGENTS.md              # 에이전트(Codex 등) 진입점 — 작업 규칙 요약
├─ CLAUDE.md              # 작업 규칙 정본(상세·배경)
├─ README.md              # 프로젝트 소개
├─ package.json           # npm workspaces 루트 (frontend·renderer·packages/*)
├─ docker-compose.yml     # 로컬: postgres:18 + 백엔드
│
├─ backend/               # Spring Boot 4.1 + Spring Security 7 + Java 21 + Gradle. 도메인별 패키지.
│   └─ src/main/
│       ├─ java/com/leadpot/{도메인}/   # §4 참고
│       └─ resources/db/migration/      # Flyway V1~V43 (스키마 정본)
│
├─ frontend/              # 관리 앱 — React 19 + Vite + TypeScript SPA
│   └─ src/
│       ├─ App.tsx        # 라우팅 정본 (§6)
│       ├─ api/client.ts  # 백엔드 API 클라이언트 (모든 호출이 여기 모임)
│       ├─ pages/         # 화면
│       ├─ components/    # 재사용 컴포넌트
│       ├─ lib/           # 유틸·훅
│       ├─ styles/        # CSS 레이어 (tokens/base/components/layout/features)
│       └─ embed/embed.tsx# 외부 사이트 임베드 번들(M6, Shadow DOM)
│
├─ renderer/              # 공개 랜딩 SSR — Next.js 16(App Router) + OpenNext Cloudflare
│   └─ src/
│       ├─ proxy.ts       # 🔴 호스트 라우팅 정본 (go/구서브도메인/app) — §1 함정 참고
│       ├─ app/site/[subdomain]/[identifier]/  # 공개 랜딩
│       ├─ app/f/[identifier]/                 # 단독 공개 리드폼
│       └─ lib/decode-identifier.ts            # 한글 슬러그 이중 인코딩 방어
│
└─ packages/public-ui/    # ⭐ frontend·renderer 공유 패키지 (@leadpot/public-ui)
    └─ src/
        ├─ components/    # LandingView · PublicFormView · HtmlBlock · PublicFormPageView …
        ├─ api/client.ts  # 공개 API 클라이언트(SSR에서도 쓰므로 window 의존 없음)
        ├─ lib/           # utm · pixels · sanitizeHtml · liveMarkers · site · calculators
        └─ styles/        # 공개 화면 CSS
```

### 왜 `packages/public-ui` 가 존재하는가 (가장 중요한 구조적 결정)

공개 랜딩을 SSR로 옮길 때 "렌더러가 따로 그린다"를 택하면 **크롤러가 보는 화면과 실사용자가 보는
화면이 갈라진다** — 그게 바로 구글 광고가 "시스템 우회(클로킹)"로 거절하던 원인이었다.
그래서 **같은 React 컴포넌트를 두 앱이 함께 쓰도록** 공유 패키지로 뽑았다.
**공개 화면에 뭔가를 그린다면 이 패키지에 넣어야 한다.** `frontend` 에만 넣으면 실서비스(SSR)에는
반영되지 않는다 — 실제로 2026-09-08에 광고 픽셀이 이 이유로 조용히 죽어 있었다.

---

## 3. 요청이 어디로 가는가 (URL → 코드)

| 들어온 URL | 처리 주체 | 코드 |
|---|---|---|
| `go.lead-pot.com/{sub}/{id}` | 렌더러 SSR | `renderer/src/proxy.ts` → `app/site/[subdomain]/[identifier]/page.tsx` → `LandingView` |
| `{sub}.lead-pot.com/{id}` (구) | 렌더러 | `proxy.ts` → **301** → `go` 호스트 |
| `app.lead-pot.com/f/{id}` | 렌더러 SSR | `proxy.ts` 예외 분기 → `app/f/[identifier]/page.tsx` → `PublicFormPageView` |
| `app.lead-pot.com/*` (그 외) | 관리 앱 | `proxy.ts` `proxyToAdminApp()` → Cloudflare Pages → `frontend/src/App.tsx` |
| `api.lead-pot.com/api/**` | 백엔드 | Railway Spring Boot |
| 외부 사이트에 심은 임베드 | 브라우저 | `frontend/src/embed/embed.tsx` (Shadow DOM) → `/api/public/**` |

> SSR이 실패하면(백엔드 5xx·네트워크 오류) `error.tsx` 가 **브라우저에서 직접 다시 조회해 같은
> 컴포넌트를 CSR로** 그린다(자동 폴백). 진짜 404(미존재·IP차단)만 404로 떨어진다.

---

## 4. 백엔드 도메인 지도 (`backend/src/main/java/com/leadpot/`)

| 패키지 | 무엇을 담당하나 | 핵심 클래스 |
|---|---|---|
| `auth` | 회원가입·로그인·JWT·비밀번호 재설정·서브도메인 | `AuthService` · `JwtService` · `User` · `Role`(USER/ADVERTISER/ADMIN) · `Subdomains` |
| `form` | 리드폼 CRUD, 공개 폼 조회, 인바운드 웹훅 설정 | `FormService` · `Form`(BASIC/STEP) · `FormBlock` · `WebhookTokens` |
| `landing` | 랜딩 CRUD, 공개 사이트 조회, 실시간(live) 데이터 | `LandingService` · `LandingPage` · `PublicSiteController` |
| `lead` | ⭐ **리드 접수·조회·상태·메모·태그·내보내기·가져오기** | `LeadService`(1212줄, 가장 큰 파일) · `LeadStatuses` · `LeadStatusService` · `LeadExcelService` |
| `lead.webhook` | 외부(Zapier·Make·LeadsBridge·메타) 리드 수신 | `WebhookLeadService` · `WebhookRateLimiter` |
| `advertiser` | 광고주 하위계정 전체(초대·권한·포털·감사로그·리포트) | `AdvertiserService` · `AdvertiserPortalController` · `AdvertiserFormGrant` |
| `admin` | 운영자 — 계정 목록·문자권한·읽기전용 열람·감사 | `AdminService` · `AdminBootstrap` · `AdminAuditLog` |
| `stats` | 통계 집계·엑셀 보고서 | `StatsService` · `StatsResponse` · `StatsExportService` |
| `visit` / `event` | 방문 기록 / 상호작용 이벤트(퍼널·스크롤·이탈) | `VisitService` · `InteractionEventService` |
| `ipblock` | 리드폼별 제출 차단(K2) + 계정 전역 접속 차단 | `IpBlockService` · `SiteIpBlockService` · `IpMatcher` |
| `sms` | 문자·알림톡 발송(솔라피), 권한·이력 | `SmsService` · `SolapiSmsSender` · `SmsPermissions` · `TemplateRenderer` |
| `integration` | 텔레그램·구글시트·아웃바운드 웹훅 | `NotificationService` · `GoogleSheetsClient` · `OutboundWebhookService` |
| `consent` | 동의/약관 문서 | `ConsentDocumentService` |
| `htmlcomponent` | 재사용 HTML 요소 라이브러리(M8) | `HtmlComponentService` |
| `folder` | 리드폼·랜딩 폴더(계층형) | `FolderService`(순환참조 방지 `isDescendant`) |
| `common` | 공통 — 보안·에러·업로드·IP·추적파라미터·예열 | `SecurityConfig` · `ClientIp` · `TrackingParams` · `R2FileStorage` · `WarmupRunner` |

### 권한 모델 (`common/security/SecurityConfig.java`)

**화이트리스트 방식** — 새 마케터 API를 추가해도 광고주·운영자에게 자동으로 닫힌다.

| 경로 | 누가 |
|---|---|
| `/api/health`, `/api/auth/{signup,login,refresh,password-reset/*}`, `/api/public/**`, `/uploads/**` | 전체 공개 |
| `/api/auth/me` | 로그인한 누구나 |
| `/api/admin/**` | `ROLE_ADMIN` 만 |
| `/api/advertiser/**` | `ROLE_ADVERTISER` 만 |
| **그 외 `/api/**`** | `ROLE_USER`(마케터) 만 |

- JWT는 HMAC HS256. `role` 클레임을 `ROLE_*` authority로 바꾸는 **커스텀 컨버터가 필수**다 —
  없으면 모든 인증 사용자가 조용히 403을 받는다(주석에 경고 있음).
- CORS: `/api/public/**` 는 모든 오리진 허용(외부 임베드용, credentials 끔). 나머지는 설정된
  오리진만.
- 액세스 토큰 TTL: 마케터 30분 / 광고주 15분. 리프레시: 마케터 14일 / 광고주 30일.

---

## 5. DB 스키마 (Flyway V1~V43, 정본은 `backend/src/main/resources/db/migration/`)

> `ddl-auto=validate` — **스키마는 Flyway가 소유한다.** 엔티티만 고치면 기동이 실패한다.
> ⚠️ **이미 적용된 마이그레이션 파일은 절대 지우지 않는다.** 지우면 Flyway 검증이 실패해
> 앱이 아예 안 뜬다("applied migration not resolved locally"). 롤백할 땐 코드만 되돌린다.

| 테이블 | 용도 | 도입 |
|---|---|---|
| `users` | 계정. 마케터·광고주·운영자 공용. `parent_user_id`=소속 마케터(광고주만), `subdomain`, `role`, `plan`, `active`, 화이트라벨(`brand_*`), 문자권한(`sms_*`), `notify_phone` | V1, V10, V18, V25, V33 |
| `forms` | 리드폼. `form_type`(BASIC/STEP), `source`(SELF/WEBHOOK), 각종 JSONB 설정(consent/submit/success/type/style/settings/tracking/webhook), `category`(분야), `var_key_seq`, `folder_id` | V2, V4, V6, V12, V22, V34, V39, V42 |
| `form_blocks` | 폼 본문 = 순서 있는 블록 배열(FIELD/IMAGE/HTML/TEXT/DIVIDER/CHOICE). `var_key`=불변 변수키 | V2, V22 |
| `landing_pages` | 랜딩. `content`(블록 JSONB), `slug`, `google_ads_safe`, `bg_color`, `folder_id` | V7, V12, V41, V42, V43 |
| `leads` | ⭐ 수집된 리드. `answers`/`consents`/`utm`/`tags` JSONB, `status`(통합 축), `custom_status_id`, `seen_at`(마케터 열람), `advertiser_seen_at`, `category`(도장), `external_id`(웹훅 멱등성), `deleted_at`(휴지통), 방문자정보, 아웃바운드 웹훅 결과 | V5, V11, V16, V18, V29~V32, V35, V39, V40 |
| `lead_notes` | 리드 메모(MEMO)·자동 이력(SYSTEM). `visibility`(MARKETER_ONLY/ALL) | V16, V18, V27 |
| `lead_statuses` | 광고주가 만든 커스텀 진행상태 | V29 |
| `lead_as_requests` | 광고주의 AS(이의) 요청 → 마케터가 인정/거부 | V30 |
| `visits` | 방문 로그(IP는 해시만) | V8 |
| `interaction_events` | 폼열기·클릭·스크롤(`scroll_depth`)·이탈(`duration_sec`) | V15, V37 |
| `consent_documents` | 동의·약관 문서 | V3, V9 |
| `html_components` | 재사용 HTML 조각 라이브러리 | V14 |
| `folders` | 리드폼·랜딩 폴더(계층형, depth 무제한) | V42 |
| `ip_blocks` / `ip_block_hits` | **리드폼별 제출** 차단 + 시도 로그 | V13 |
| `site_ip_blocks` / `site_ip_block_hits` | **계정 전역 접속** 차단 + 시도 로그 | V20, V21 |
| `advertiser_invites` | 광고주 초대(토큰 **해시만** 저장) | V18 |
| `advertiser_form_grants` | ⭐ 광고주 권한의 단일 출처. **1 리드폼 : 1 광고주**(unique 제약), `notify_phone`, `notify_disabled` | V18, V28, V33 |
| `advertiser_password_resets` | 광고주 비번 재설정 토큰(해시) | V19 |
| `advertiser_access_logs` | 광고주 열람·다운로드 감사(append-only, **FK 없음**=계정 삭제해도 보존) | V18 |
| `admin_audit_logs` | 운영자 변경 이력 | V26 |
| `notification_logs` | 텔레그램·시트 발송 결과 | V18 |
| `message_logs` | 문자·알림톡 발송 이력(= 월 사용량 집계 원천) | V23 |
| `password_reset_codes` | 마케터 비번 재설정 인증번호(해시, 시도횟수 제한) | V36 |
| `integration_settings` | 계정별 텔레그램·구글시트 연동 설정 | V16, V17 |

### 제거된 것 (되살리지 말 것)
- `advertiser_ledger` + 광고주 선입금 과금 컬럼들 → **V38에서 제거**. 정산은 별도로 다시 만들 계획.
- `integration_settings.sms_*` (마케터 개별 문자 계정) → **V24에서 제거**. 문자는 리드팟 계정 하나로만 나간다.

### 리드 상태 축 (V29 — 마케터·광고주 공용 단일 축)

`NEW`(신규) · `VALID`(유효) · `AS_REQUESTED`(AS요청) · `INVALID`(무효) · `CUSTOM`(광고주 정의)

- **AS_REQUESTED 는 일반 상태변경으로 진입 불가** — AS 요청 플로우로만.
- **INVALID 는 마케터 전용**(넣는 것도 빼는 것도).
- 상태 변경은 **`LeadStatusService` 단일 관문**으로만 한다.
- ⚠️ **"미확인"은 상태가 아니라 `leads.seen_at`** 이다(V32). 상태와 무관.

---

## 6. 화면 라우트 (`frontend/src/App.tsx` 가 정본)

**마케터** (로그인 필요, LNB 사이드바)
`/dashboard` · `/inbox`(통합 인박스) · `/forms`·`/forms/new`·`/forms/:id/edit`·`/forms/:id/leads`·
`/forms/:id/ip-blocks` · `/landings`·`/landings/new`·`/landings/:id/edit` · `/consent-docs/*` ·
`/html-components/*` · `/stats`·`/stats/report` · `/site-ip-blocks` · `/sms` · `/integrations` ·
`/advertisers` · `/advertisers/:id/preview`

**광고주** (`ROLE_ADVERTISER`, 모바일 퍼스트, 마케터 내비 완전 은폐)
`/client`(리드 목록=홈) · `/client/integrations` · `/client/report` · `/client/guide` ·
`/client/login` · `/client/reset/:token`

**운영자** (`ROLE_ADMIN`)
`/admin` · `/admin/users/:id`

**공개(비로그인)**
`/f/:id`(단독 폼 — 운영에선 렌더러가 가로챔) · `/p/:slug`(소유자 미리보기) · `/consent/:id` ·
`/invite/:token` · `/about` · `/login` · `/reset-password`

> `/signup` 은 `/login` 으로 리다이렉트된다 — **공개 회원가입은 닫혀 있다**(2026-08-06 결정).
> 서버도 `app.auth.signup-enabled=false` 로 거부한다. 다시 열려면 양쪽을 다 바꿔야 한다.

---

## 7. API 엔드포인트 전체

<details>
<summary><b>공개 (인증 없음) — <code>/api/public/**</code></b></summary>

```
GET  /api/public/sites/{subdomain}/{identifier}   공개 랜딩 데이터(SSR이 호출)
GET  /api/public/landings/{id}/live               실시간 신청수·최근 신청자(M8 동적요소)
GET  /api/public/forms/{id}                       공개 리드폼 데이터
POST /api/public/leads                            ⭐ 리드 제출
POST /api/public/visits                           방문 기록
POST /api/public/events                           상호작용 이벤트(폼열기·클릭·스크롤·이탈)
GET  /api/public/consent-documents/{id}           동의문서 공개 조회
POST /api/public/webhook-leads/{token}            ⭐ 외부 웹훅 리드 수신(V39)
GET  /api/public/advertiser-invites/{token}       초대 정보
POST /api/public/advertiser-invites/{token}       초대 수락(계정 생성)
GET  /api/public/advertiser-password-resets/{token}
POST /api/public/advertiser-password-resets/{token}
```
</details>

<details>
<summary><b>인증 — <code>/api/auth/**</code></b></summary>

```
POST /api/auth/signup            (기본 비활성)
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/password-reset/request    마케터 셀프 재설정 — 휴대폰 인증번호(V36)
POST /api/auth/password-reset/confirm
GET  /api/auth/me                로그인한 누구나
PATCH /api/auth/subdomain
```
</details>

<details>
<summary><b>마케터 — <code>ROLE_USER</code></b></summary>

```
# 리드폼
GET/POST      /api/forms              GET/PUT/DELETE /api/forms/{id}
PATCH         /api/forms/{id}/folder
GET/POST/DELETE /api/forms/{id}/webhook          POST /api/forms/{id}/webhook/regenerate
PUT           /api/forms/{id}/webhook/mapping

# 랜딩
GET/POST      /api/landings           GET/PUT/DELETE /api/landings/{id}
GET           /api/landings/preview/{slug}        PATCH /api/landings/{id}/folder

# 리드 (가장 큰 표면)
GET  /api/leads                       GET /api/leads/count   GET /api/leads/inbox
GET  /api/leads/{id}                  PATCH /api/leads/{id}/status
GET/POST/DELETE /api/leads/{id}/notes[/{noteId}]  PUT /api/leads/{id}/tags
GET  /api/leads/{id}/as-requests      POST /api/leads/{id}/as-resolve
GET  /api/leads/{id}/advertiser-activity
POST /api/leads/{id}/webhook-out/retry
GET  /api/leads/status-options        GET /api/leads/columns   GET /api/leads/utm-facets
PATCH /api/leads/bulk/status          PATCH /api/leads/bulk/category
POST /api/leads/bulk/{seen,unseen,trash,restore,permanent}
DELETE /api/leads/{id}                POST /api/leads/{id}/restore
DELETE /api/leads/{id}/permanent
POST /api/leads/export                GET /api/leads/template   POST /api/leads/import
POST /api/leads/manual                수기 등록(K7)

# 그 밖
GET/POST/PUT/DELETE  /api/consent-documents[/{id}]
GET/POST/PUT/DELETE  /api/html-components[/{id}]
GET/POST/PUT/DELETE  /api/folders[/{id}]
GET/POST/DELETE      /api/forms/{formId}/ip-blocks[/{blockId}]   GET/DELETE .../hits
GET/POST/DELETE      /api/site-ip-blocks[/{blockId}]             GET/DELETE .../hits
GET/PUT              /api/integrations    POST /api/integrations/test|/test-sheets
GET  /api/stats/overview      POST /api/stats/export
GET  /api/sms/status|/logs|/measure   POST /api/sms/test|/attachment
POST /api/uploads
# 광고주 관리
GET/PUT/DELETE /api/advertisers[/{id}]   PATCH /api/advertisers/{id}/active
GET/PUT   /api/advertisers/{id}/grants   GET /api/advertisers/{id}/logs
GET  /api/advertisers/{id}/reports/response-time
GET  /api/advertisers/{id}/preview[/leads[/{leadId}]]   POST .../preview/exit
GET/PUT   /api/advertisers/brand         POST /api/advertisers/{id}/password-reset
GET/POST/DELETE /api/advertisers/invites[/{inviteId}]   POST .../reissue
GET  /api/advertisers/notify-status/{formId}
```
</details>

<details>
<summary><b>광고주 — <code>ROLE_ADVERTISER</code> · <code>/api/advertiser/**</code></b></summary>

```
GET  /me   /forms   /dashboard   /reports   /leads   /leads/{id}   /leads/updates
PATCH /leads/{id}/status          POST /leads/{id}/as-request    GET /leads/{id}/as-requests
GET/POST /leads/{id}/notes        POST /leads/export
GET  /lead-statuses               GET/POST/PATCH/DELETE /statuses[/{id}]
PUT  /notify-phone   /forms/{formId}/notify-phone   /forms/{formId}/notify-disabled
GET/PUT /integrations             POST /integrations/test
POST /api/advertiser/uploads      (AS 증빙 이미지)
```
> ⚠️ **DELETE 엔드포인트가 의도적으로 없다.** 광고주는 리드를 지울 수 없다.
</details>

<details>
<summary><b>운영자 — <code>ROLE_ADMIN</code> · <code>/api/admin/**</code></b></summary>

```
GET   /users      PATCH /users/{id}/sms      GET /audit
GET   /users/{id}/forms | /landings | /leads        (읽기 전용 열람, 감사 이력 남음)
POST  /users/{id}/login-as                          (대행 로그인)
```
</details>

---

## 8. 핵심 데이터 흐름 — 리드가 접수되기까지

`POST /api/public/leads` → `PublicLeadController` → **`LeadService.submit()`** (`lead/LeadService.java:87`)

```
1. 리드폼 조회
2. IP 차단 검사          (외부 웹훅 유입이면 건너뜀 — 서버 대 서버라 방문자 IP가 없음)
3. 유효성 검사            필수·형식
4. 중복 제출 방지(K3)     항목별 중복허용·유효기간 + 동일 IP 허용 여부
5. 리드 조립
   ├ answers 에 varKey 도장   (항목명이 바뀌어도 템플릿이 안 깨지게 — 클라이언트 값은 안 믿고 서버가 재계산)
   ├ utm = TrackingParams.sanitize()  🔴 허용 키만 통과 + 200자 컷 (공개 엔드포인트 방어)
   ├ category 도장           (접수 순간 폼의 분야를 복사 — 나중에 폼을 바꿔도 소급 안 됨)
   └ 방문자정보 파싱          device/os/browser (UserAgentParser)
6. 저장
7. 커밋 후 비동기(best-effort, 실패해도 접수엔 영향 없음)
   ├ 텔레그램 / 구글시트 알림   (+ 중복 의심 표시)
   ├ 문자·알림톡               (LeadSmsPlanner → SmsService → Solapi)
   └ 아웃바운드 웹훅           (외부 URL로 전달, 결과를 leads 에 기록)
```

**방문자 IP 판정은 `common/ClientIp.java` 가 `CF-Connecting-IP` 로 한다.**
🔴 SSR에서는 브라우저가 아니라 **렌더러(Worker)가 백엔드를 부르므로**, 렌더러가 원 방문자의
`CF-Connecting-IP`·`User-Agent` 를 그대로 전달해야 한다(`ForwardedRequestContext`).
이걸 빠뜨리면 **모든 방문자가 Worker IP 하나로 보여** IP 차단·중복방지·순방문 통계가 전부 망가진다.

---

## 9. ⚠️ 같이 고쳐야 하는 곳 (한 곳만 고치면 조용히 어긋난다)

이 저장소에서 **버그가 가장 자주 생긴 지점들**이다. 손대기 전에 반드시 확인한다.

| 바꾸려는 것 | 함께 고쳐야 하는 파일 |
|---|---|
| **광고 URL 파라미터 키** | ① `frontend/src/lib/adUrl.ts`(`AD_PARAM_KEYS`) ② `packages/public-ui/src/lib/utm.ts`(`AD_KEYS`) ③ `backend/.../common/TrackingParams.java`(`ALLOWED_KEYS`) ④ `frontend/src/components/AdUrlBuilder.tsx`(라벨) ⑤ 통계 6곳(`StatsResponse`·`StatsService`·`StatsExportService`·`client.ts`·`StatsPage`·`StatsReportPage`) ⑥ `frontend/src/lib/tracking.ts`(필터 라벨) |
| **공개 화면에 뭔가 그리기** | `packages/public-ui/` 에 넣는다. `frontend/` 에만 넣으면 **실서비스(SSR)에 반영 안 됨** |
| **예약 호스트 목록** | `renderer/src/proxy.ts`(`RESERVED_HOSTS`) ↔ `packages/public-ui/src/lib/site.ts`(`currentSubdomain`) |
| **DB 스키마** | Flyway 새 마이그레이션 + 엔티티 + DTO + 프론트 타입(`api/client.ts`). `ddl-auto=validate` 라 엔티티만 고치면 **기동 실패** |
| **리드 상태** | `LeadStatuses` + `LeadStatusService`(단일 관문) + 프론트 상태 라벨·색(`styles/features/leads.css` `.ld-*`) |
| **공용 CSS 클래스 삭제** | 반드시 `grep` 전수 조사. 과거 LNB 전환 때 광고주 상단바가 스타일 없이 렌더되는 회귀가 실사용자에게 노출됐다 |
| **픽셀 이벤트 추가** | `packages/public-ui/src/lib/pixels.ts` + `frontend/src/components/PixelFields.tsx`(`EVENT_PICKERS`) |

---

## 10. 로컬 실행 · 검증

```bash
# 0) 의존성 (npm workspaces — 반드시 저장소 루트에서)
npm install

# 1) DB + 백엔드
docker compose up -d db                    # postgres:18, localhost:5432
cd backend
cp src/main/resources/application-local.properties.example \
   src/main/resources/application-local.properties        # 그대로 써도 됨
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun            # → :8080, Flyway가 V1~V43 자동 적용
# (또는 docker compose up — 백엔드까지 컨테이너로)
curl http://localhost:8080/api/health                     # {"status":"UP"}

# 2) 관리 앱
cd frontend && npm run dev                 # → :5173  (.env 의 VITE_API_BASE_URL)

# 3) 공개 랜딩 렌더러
cd renderer && cp .env.local.example .env.local && npm run dev    # → :3000
#    Workers 런타임까지 재현하려면: cp .dev.vars.example .dev.vars && npm run preview
```

**검증 명령** (PR 전에 최소 이것들)

```bash
cd backend  && ./gradlew test                    # 단위+통합(@SpringBootTest 는 DB 필요)
cd frontend && npx tsc -b && npx vitest run      # 타입 + 테스트
cd packages/public-ui && npx vitest run
cd renderer && npx next build                    # SSR 컴파일 확인
```

> ⚠️ **원격/샌드박스 세션에는 Docker 데몬이 없을 수 있다** — 그러면 `@SpringBootTest`(DB 필요)는
> 못 돌린다. `./gradlew compileJava compileTestJava` + 순수 단위 테스트(`TrackingParamsTest` 등)까지만
> 하고, **"DB 필요 테스트는 못 돌렸다"고 명시적으로 남긴다.** 통과했다고 하지 않는다.

---

## 11. 환경변수

**백엔드** (Railway Variables · 로컬은 `application-local.properties`)

| 키 | 용도 |
|---|---|
| `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` | DB 접속 |
| `APP_JWT_SECRET` | 🔴 32바이트 이상. 운영에서 반드시 교체 |
| `APP_CORS_ALLOWED_ORIGINS` | 허용 오리진(콤마) |
| `APP_PUBLIC_BASE_URL` | 알림 메시지의 딥링크 기준 |
| `APP_STORAGE_TYPE` / `APP_STORAGE_R2_*` | 업로드 저장소(`local` 또는 `r2`) |
| `APP_ADMIN_BOOTSTRAP_EMAIL` | 기동 시 이 이메일을 ROLE_ADMIN 으로 승격(코드·git에 이메일을 안 남기려는 장치) |
| `GOOGLE_SHEETS_CREDENTIALS` | 구글 서비스계정 JSON(base64 권장) |
| `APP_SMS_SOLAPI_*` | 솔라피 키·발신번호·알림톡 PF/템플릿 ID |
| `APP_AUTH_SIGNUP_ENABLED` | 공개 가입(기본 false) |
| `APP_LEAD_AUTO_APPROVE_ENABLED/CRON` | 자동 승인 배치(매시 10분) |
| `APP_WARMUP_ENABLED` | 기동 직후 예열 |
| `APP_ADVERTISER_*` | 광고주 상한·초대 TTL·내보내기 일일 상한 |
| `APP_DB_*` | HikariCP 튜닝(keepalive 등) |

**프론트·렌더러** — ⚠️ **빌드 시점에 번들에 박힌다.** 워크플로의 `env:` 가 프로덕션 값의 출처다
(Cloudflare 대시보드 런타임 변수와 별개).

| 키 | 값 |
|---|---|
| `VITE_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` | `https://api.lead-pot.com` |
| `VITE_APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` | `https://app.lead-pot.com` |
| `ADMIN_APP_ORIGIN` (렌더러 런타임) | `https://leadpot-app.pages.dev` |

**GitHub 저장소 시크릿**: `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` · (레거시 VM용)
`VM_SSH_KEY`·`VM_HOST`·`VM_USER`

---

## 12. 배포

`main` 에 push 하면 경로별로 자동 실행된다. **수동 배포 없음.**

| 워크플로 | 트리거 경로 | 배포처 |
|---|---|---|
| `deploy-frontend-cloudflare.yml` | `frontend/**` · `packages/public-ui/**` | Cloudflare Pages `leadpot-app` |
| `deploy-renderer.yml` | `renderer/**` · `packages/public-ui/**` | Cloudflare Workers `leadpot-renderer` |
| `deploy-frontend.yml` | `frontend/**` | Oracle VM (**레거시 — 실트래픽 없음**, 정리 예정) |
| (워크플로 아님) | `backend/**` | **Railway 자체 GitHub 연동**이 빌드·배포. 대시보드에서 확인 |

> `packages/public-ui/**` 를 고치면 **Pages·Workers 둘 다** 다시 나간다 — 공개 화면 전체에 영향.

---

## 13. 지금 알려진 미해결·확인 필요 (2026-09-15)

- ⬜ **구글 광고 재심사** — `go.lead-pot.com` 고정 호스트 전환 후 각 광고 플랫폼의 Final URL을
  사용자가 직접 갱신해야 한다(301은 임시 안전망). gTech 티켓 회신 확인 필요.
- ⬜ **Oracle VM 종료** + `deploy-frontend.yml`·`Dockerfile.runtime`·`docker-compose.prod.yml` 정리.
- ⬜ **SSR 전환 후 회귀 확인 잔여분** — 스텝폼·계산기·동의문서 인라인·오버레이/풀스크린 CTA·
  픽셀 발사·**IP 차단 실동작**·방문/스크롤/이탈 통계를 실제 도메인 브라우저로 확인
  ([SSR-LANDING-PLAN.md](SSR-LANDING-PLAN.md) §9-B).
- ⬜ **GO-LIVE 점검표** 미완 항목 — [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md).
  특히 오리진 방화벽(Cloudflare 대역 제한), 비번 변경 시 리프레시 토큰 무효화(`token_version`).
- ⬜ **광고주 포털 내부 실화면 검증** — 광고주 자격증명이 없어 아직 눈으로 못 봤다.
- ⬜ **인바운드 웹훅 종단 테스트** — LeadsBridge/Zapier/메타 실연동은 미검증(로컬 curl 만).

---

## 14. 더 읽을 것

| 문서 | 언제 읽나 |
|---|---|
| [../AGENTS.md](../AGENTS.md) · [../CLAUDE.md](../CLAUDE.md) | **작업 시작 전 항상** — 규칙 |
| [PROGRESS.md](PROGRESS.md) | **작업 시작 전 항상** — 지금 위치·다음 할 일 (3200줄, 최신이 맨 위) |
| [ROADMAP.md](ROADMAP.md) | Phase 진행 상황 |
| [SPEC.md](SPEC.md) · [FEATURES.md](FEATURES.md) · [BACKLOG.md](BACKLOG.md) | 기능 명세·카탈로그·선택 목록 |
| [SSR-LANDING-PLAN.md](SSR-LANDING-PLAN.md) | 공개 랜딩 SSR·Cloudflare 전환의 모든 배경 |
| [ADVERTISER-PORTAL-PLAN.md](ADVERTISER-PORTAL-PLAN.md) | 광고주 기능 정본 |
| [MESSAGING-PLAN.md](MESSAGING-PLAN.md) | 문자·알림톡(솔라피) 설계·제약 |
| [META-LEADS-PLAN.md](META-LEADS-PLAN.md) | 인바운드 웹훅 리드 수신 |
| [DB-MIGRATION-RAILWAY.md](DB-MIGRATION-RAILWAY.md) | DB 이전 경위(Neon→Railway) |
| [DEPLOY.md](DEPLOY.md) · [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) | 배포 이력(대부분 과거 기록) |
| [UIUX-PLAN.md](UIUX-PLAN.md) | 디자인 컨셉(관리=Cockpit / 공개=Daylight) |
| [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) | 오픈 전 점검 |
| [DBCART-ANALYSIS.md](DBCART-ANALYSIS.md) | 벤치마킹 대상 분석 |

> ⚠️ **git 로그로 히스토리를 추적할 수 없다** — 이 저장소 클론은 **shallow**(2026-09-01 이후만)다.
> 그 이전 경위는 전부 `docs/PROGRESS.md` 에만 있다.
