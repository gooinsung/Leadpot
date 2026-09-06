# docs/SSR-LANDING-PLAN.md — 공개 랜딩 SSR 전환 계획 (Next.js on Cloudflare)

> **작성 2026-09-06. 상태: 📋 계획 수립 완료 — 착수 전 §11 결정 필요.**
> 기준 커밋 `992877e` · **Flyway V40** · 프론트 React+Vite SPA(CSR)
> 배경 조사·방식 비교는 이 문서에 전부 담았다. **이어받는 세션은 이 문서 하나만 읽으면 실행할 수 있다.**
> 관련: [CLAUDE.md](../CLAUDE.md) §2·§3·§6 · [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md)(프론트 이전과 맞물림) · [PROGRESS.md](PROGRESS.md)

---

## 0. 한 줄 요약

**공개 랜딩(`{서브도메인}.lead-pot.com/{식별자}`)을 CSR(빈 HTML + JS) 에서 SSR(완성된 HTML) 로 바꿔
구글 광고 심사에서 "시스템 우회"로 거절되는 구조적 원인을 없앤다.** 관리 화면(대시보드·빌더)은 지금 그대로 둔다.

---

## 1. 왜 하는가

### 1-1. 지금 구조가 광고 심사에서 불리하다

[frontend/index.html](../frontend/index.html) 은 이게 전부다:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

서버가 내려주는 HTML 에는 **콘텐츠가 한 글자도 없다.** 방문자(그리고 구글 크롤러)의 브라우저가:

```
빈 HTML 수신 → JS 번들(660KB) 다운로드 → 실행 → API 호출 → 응답 대기 → 그제서야 화면이 채워짐
```

구글 AdsBot 이 JS 를 실행하긴 하지만 **언제 스냅샷을 찍는지는 우리가 통제할 수 없다.**
이 왕복이 끝나기 전에 찍히면 심사에 **빈 페이지**가 들어간다.

### 1-2. 실시간 위젯이 불일치를 하나 더 얹는다

[LandingView.tsx:47~62](../frontend/src/components/LandingView.tsx) — M8 동적 요소는 **두 번째 API 왕복 후**
DOM 텍스트를 덮어쓴다:

| 시점 | "실시간 신청 수" | "남은 자리" |
|---|---|---|
| 최초 렌더(= 크롤러가 볼 수 있는 상태) | `0` 명 | `100` 개 |
| `/live` 응답 후(= 실사용자가 보는 상태) | `37` 명 | `63` 개 |

**같은 URL 인데 심사 시점과 사용자 시점의 문구·숫자가 다르다.** 의도가 없어도 구글의 자동 판정에는
"클로킹(리뷰용 콘텐츠 ≠ 실제 콘텐츠)"과 구분되지 않는다.

### 1-3. 실제로 거절당하고 있다

`the-law.lead-pot.com/37` 이 **시스템 우회 · 손상된 사이트**로 반복 거절 → 외부 사이트
(`bnevents.mycafe24.com`, 임베드 방식)로 바꿔도 같은 사유로 거절. 로고 이미지를 전부 교체해도 그대로였다
(= 애셋이 아니라 **최종 URL 이 원인**이라는 방증).

### 1-4. 덤으로 풀리는 것

- **SEO(I3)** — PROGRESS.md 에 "실제 도메인+엣지렌더 없이는 효과 없음"으로 미뤄둔 항목. SSR 이면 랜딩별
  `<title>`·`og:*`·설명이 실제 HTML 에 박힌다. 카카오톡·페이스북 링크 미리보기도 이때부터 제대로 나온다.
- **첫 화면 체감 속도** — 모바일에서 JS 660KB 를 받기 전에 이미 글씨가 보인다.

---

## 2. 목표 / 비목표

### 목표
- 공개 랜딩의 **최초 HTML 응답에 완성된 콘텐츠**가 들어간다(크롤러가 JS 없이도 전부 읽는다).
- **크롤러가 보는 화면 == 실사용자가 보는 화면.** 실시간 숫자도 서버에서 이미 채워서 내려준다.
- 폼 제출·픽셀·추적 등 **기존 기능이 하나도 죽지 않는다.**
- 렌더링 코드가 **한 벌만 존재한다**(관리 화면과 공개 화면이 같은 컴포넌트를 쓴다).

### 비목표 (이번에 하지 않는다)
- 관리 화면(대시보드·빌더·광고주 포털) SSR — 로그인 뒤 화면이라 SEO·광고심사와 무관하다. **그대로 둔다.**
- 임베드(`embed.js`) SSR — 남의 사이트에 심는 스크립트라 구조상 불가능하고 불필요하다.
- 백엔드 이전·DB 변경 — 건드리지 않는다.

---

## 3. 왜 이 방식인가 (검토한 3안 비교)

| | A. Spring 이 HTML 직접 렌더 | **B. Next.js 렌더러 (채택)** | C. 프리렌더 캐시 계층 |
|---|---|---|---|
| 새 인프라 | 없음 | Cloudflare Workers | 헤드리스 크롬 상시 가동 서버 |
| 코드 재사용 | ❌ 블록 렌더·계산기·스텝폼을 **Java 로 전부 재구현** | ✅ 기존 React 컴포넌트 그대로 | ✅ 앱 코드 안 건드림 |
| 유지보수 | **영구 이원화** — 블록 타입 추가할 때마다 두 곳 수정, 어긋나면 §1-2 문제 재발 | 앱 하나 추가 관리 | 크롤러 UA 목록·캐시 무효화 관리 |
| 신선도 | 항상 최신 | 항상 최신 | 캐시라 수 분 지연 |
| 비용 | $0 | **$0** (무료 티어 10만 req/일 내) | 서버 상시 가동 비용 |

**B 를 고른 이유**: A 는 "두 렌더러가 항상 똑같이 그려야 한다"를 사람이 계속 지켜야 하는데,
그게 어긋나는 순간 **지금 없애려는 그 문제(콘텐츠 불일치)가 형태만 바꿔 재발**한다. C 는 헤드리스
크롬을 24시간 띄우는 운영 부담과 캐시 지연이 붙는다. B 는 컴포넌트를 공유해 불일치가 **구조적으로**
생길 수 없고, Cloudflare 는 이미 DNS·SSL 로 쓰고 있어 새 벤더도 아니다.

> **왜 Railway 가 아니라 Cloudflare 인가**: Railway 는 사용량 과금 + Node 프로세스 상시 가동이라
> 트래픽에 비례해 요금이 붙는다. Cloudflare Workers 는 요청 시에만 실행되고 무료 티어가 넉넉하다.
> Vercel 은 **무료(Hobby) 플랜이 상업적 사용 금지**라 실서비스는 Pro($20/월) 가 필요하다.

---

## 4. 목표 구성

```
[방문자 / 구글 AdsBot]
   │
   ▼
Cloudflare DNS (무료 SSL)
   │
   ├─ *.lead-pot.com  ──▶ ⭐신설 Next.js 렌더러 (Cloudflare Workers)   $0
   │                          │  서버에서 API 호출 → 완성된 HTML 응답
   │                          │  (CF-Connecting-IP 전달 필수 → §6-1)
   │                          ▼
   ├─ api.lead-pot.com ──▶ Railway(싱가포르) Spring Boot ──▶ Neon
   │                          ▲
   └─ app.lead-pot.com ──▶ 기존 React+Vite SPA (그대로. 관리 화면)
                              └ 여기서도 같은 API 를 부른다
```

- `app` 은 **개별 DNS 레코드**라 와일드카드(`*`)보다 우선한다 → 관리 화면은 영향 없다.
- 예약 호스트(`www`·`api`·`admin`·`dashboard`)도 개별 레코드로 남긴다 ([site.ts:10](../frontend/src/lib/site.ts) `RESERVED_HOSTS` 와 일치시킬 것).

---

## 5. 핵심 설계

### 5-1. 무엇을 서버에서 그리고, 무엇을 브라우저에 남기나

| 요소 | 서버(SSR) | 브라우저(하이드레이션 후) | 근거 |
|---|---|---|---|
| 블록 콘텐츠(TEXT·IMAGE·HTML) | ✅ 완성된 HTML | — | 크롤러가 읽어야 하는 본문 |
| 실시간 신청수·남은자리(M8) | ✅ **실제 값을 서버에서 채움** | 갱신만 | §1-2 불일치 제거 |
| 리드폼 마크업(입력창·선택지·동의) | ✅ | 상태 관리·검증·제출 | 폼이 HTML 에 보여야 "빈 페이지"가 아니다 |
| 스텝폼 진행·계산기 | 1단계만 | 이후 전부 | 인터랙션은 원래 클라이언트 몫 |
| 광고 픽셀(메타·구글·틱톡…) | ❌ | ✅ | 서버에서 쏘면 크롤링이 전환으로 잡힌다 |
| 방문·이벤트 기록(`/visits`·`/events`) | ❌ | ✅ | **크롤러 방문이 통계에 섞이면 안 된다** |
| 최근 신청자 토스트 | ❌ | ✅ | 타이머 기반. 서버 HTML 과 달라지면 하이드레이션 불일치 |

### 5-2. 컴포넌트 공유 (드리프트 방지 — 이 방식의 핵심)

**같은 컴포넌트를 두 앱이 쓴다.** 복사하면 B 를 고른 이유가 사라진다.

```
packages/public-ui/        ⭐신설 (npm workspaces)
  LandingView · PublicFormView · HtmlBlock · ConsentItemRow
  formRenderers/* · lib/calculators/* · lib/utm · lib/pixels · styles/*
        ▲                          ▲
        │                          │
   frontend/ (관리앱·임베드)    renderer/ (Next.js) ⭐신설
```

- 루트 `package.json` 에 `workspaces: ["frontend", "renderer", "packages/*"]`
- **Phase 1 을 독립 단계로 두고, 프론트가 기존과 100% 동일하게 동작하는지 회귀 검증 후 다음으로 간다.**
- 대안(빠른 시작): `renderer` 에서 `../frontend/src` 를 경로 별칭으로 직접 import. 초기엔 빠르지만
  두 앱의 빌드 설정이 얽히므로 **권장하지 않는다.**

### 5-3. SSR 안전성 — 서버에는 `window` 가 없다

| 파일 | 문제 | 처리 |
|---|---|---|
| [lib/utm.ts:28](../frontend/src/lib/utm.ts) | `window.location.search` 직접 접근 | 서버에서 URL 을 넘겨받도록 인자화(또는 `typeof window` 가드) |
| [lib/site.ts:13](../frontend/src/lib/site.ts) | `window.location.hostname` | 서버는 `Host` 헤더로 판정 → 인자화 |
| [lib/pixels.ts](../frontend/src/lib/pixels.ts) | `window`·`document` | 이미 클라이언트 전용 경로에서만 호출 — `useEffect` 안인지만 확인 |
| [HtmlBlock.tsx:98](../frontend/src/components/HtmlBlock.tsx) | `useEffect` 안에서 `innerHTML` → **서버 HTML 이 빈다** | §5-4 |
| [LandingView.tsx:65~121](../frontend/src/components/LandingView.tsx) | 스크롤·이탈 추적 | `useEffect` 라 서버 영향 없음 |

### 5-4. HTML 블록 — SSR 경로에서 스크립트를 제거한다 ⭐

지금 HTML 블록은 `useEffect` 안에서 `host.innerHTML = html` 로 그린다 → **서버 HTML 에 아무것도 안 남는다.**
SSR 하려면 서버에서 문자열을 그대로 심어야 하는데, 그 과정에서 **정화(sanitize)를 함께 넣는다**:

- 서버 렌더: `<script>`·`<iframe>`·인라인 이벤트 핸들러(`onerror` 등) 제거 후 삽입
- 이유: (a) SSR 결과를 결정적으로 만들고, (b) **"손상된 사이트" 거절 사유를 함께 제거**한다
  — 임의 스크립트 실행이 그 판정의 직접 원인이었다
- 마케터 안내: 편집기에서 "구글 광고용 랜딩에서는 HTML 블록의 스크립트가 실행되지 않습니다" 경고 표시

> 이 한 가지로 **시스템 우회(§1-1·1-2)와 손상된 사이트가 동시에 정리된다.** 이번 작업의 가장 큰 실익이다.

### 5-5. "구글 랜딩으로 설정하기" 토글

> **권장: 기본값을 SSR 로 두고, 토글은 "문제 생겼을 때 옛 경로로 되돌리는 비상 스위치"로 쓴다.**
> 랜딩마다 렌더링 방식이 갈리면 §3 에서 A 안을 탈락시킨 이유(경로 이원화)가 작게나마 되살아난다.

구현은 **추가 왕복 없이** 된다 — 렌더러는 어차피 랜딩 데이터를 먼저 가져오기 때문이다:

```
요청 → 렌더러가 /api/public/sites/{sub}/{id} 호출
        ├─ renderMode = SSR  → 서버에서 렌더링해 완성 HTML 응답 (기본)
        └─ renderMode = CSR  → 기존 SPA 셸을 그대로 응답 (비상용)
```

| 항목 | 내용 |
|---|---|
| DB | `landing_pages.render_mode varchar(10) not null default 'SSR'` — **Flyway V41** |
| 엔티티 | [LandingPage.java](../backend/src/main/java/com/leadpot/landing/LandingPage.java) 필드 추가 |
| 응답 DTO | [PublicLandingResponse](../backend/src/main/java/com/leadpot/landing/dto/PublicLandingResponse.java) 에 `renderMode` 추가 |
| 편집기 UI | [LandingEditPage.tsx](../frontend/src/pages/LandingEditPage.tsx) 설정 영역에 토글 |

---

## 6. ⚠️ 착수 전에 반드시 알아야 할 함정

### 6-1. 🔴 IP 차단이 조용히 망가진다 — 가장 중요

[ClientIp.java](../backend/src/main/java/com/leadpot/common/ClientIp.java) 는 **`CF-Connecting-IP` 헤더**로 방문자 IP 를 판정한다.
이 값은 **IP 차단(K2)·중복 제출 방지·순방문 통계**에 쓰인다.

SSR 은 브라우저가 아니라 **렌더러(Worker)가 백엔드를 부른다.** 그대로 두면 백엔드는 모든 방문자를
**Worker 의 IP 하나로** 인식한다 →
- 차단해둔 IP 가 통과한다(차단 기능 무력화)
- 반대로 한 명이 차단당하면 **전원이 차단**될 수 있다

**대응**: 렌더러가 백엔드로 fetch 할 때 원 요청의 `CF-Connecting-IP` 와 `User-Agent` 를 **그대로 전달**한다.
([PublicSiteController:29~32](../backend/src/main/java/com/leadpot/landing/PublicSiteController.java) 가 두 값을 모두 쓴다.)
Phase 6 검증에 **IP 차단 실동작 테스트를 반드시 포함**할 것.

### 6-2. 하이드레이션 불일치

서버가 그린 HTML 과 브라우저의 첫 렌더가 다르면 React 가 화면을 통째로 다시 그리거나 경고를 뿜는다.
- 실시간 값(M8)은 **서버에서 받은 값을 초기 props 로 내려** 첫 렌더를 맞춘다(다시 fetch 해서 덮어쓰지 않는다)
- 토스트·타이머 등 시간 의존 UI 는 **마운트 후에만** 렌더

### 6-3. 와일드카드 도메인 — 선행 확인 필요 ❓

[HOSTING-MIGRATION-PLAN.md §Phase B](HOSTING-MIGRATION-PLAN.md) 에도 미해결로 남아 있는 항목이다.
- **Cloudflare Pages 는 와일드카드 커스텀 도메인이 제한적**이다 → 그래서 이 계획은 **Workers 배포**를 택했다
  (Workers 라우트는 `*.lead-pot.com/*` 를 정식 지원)
- 와일드카드 **DNS·SSL 자체가 아직 미구성**이다 → 이번에 같이 세팅해야 한다

### 6-4. Next.js on Cloudflare 어댑터 선택 ❓

- `@opennextjs/cloudflare` (OpenNext) — Workers 배포, Node 런타임 API 호환이 넓다. **현재 권장 경로**
- `@cloudflare/next-on-pages` — Pages 전용, 모든 SSR 라우트가 edge 런타임이어야 해 제약이 크다
- **착수 시점에 두 어댑터의 최신 상태를 반드시 재확인할 것** (변화가 빠른 영역이다)

### 6-5. 그 밖에

| 항목 | 내용 |
|---|---|
| CORS | SSR fetch 는 서버→서버라 무관. 브라우저 fetch(제출·이벤트)는 `https://*.lead-pot.com` 이 이미 허용돼 있음 |
| 동의문서 링크 | `consentDocUrl()` 이 앱 도메인 절대 URL 을 만든다 — 렌더러에서도 `VITE_APP_BASE_URL` 대응 값 필요 |
| 라이트 고정 | 공개 화면은 `.public-form`·`.landing-public` 클래스가 있어야 다크모드 유입이 막힌다 ([public.css:24~27](../frontend/src/styles/features/public.css)) — 렌더러도 같은 래퍼를 써야 한다 (`992877e` 이전 임베드 버그와 동일 함정) |
| 폰트 | Pretendard 를 jsdelivr 에서 받는다 — 렌더러 `<head>` 에도 동일하게 |
| 이미지 | R2 절대 URL 이라 그대로 동작 |

---

## 7. 실행 단계

> **원칙: 되돌릴 수 있는 순서로 쪼갠다.** 각 Phase 끝에서 기존 서비스가 멀쩡한지 확인하고 다음으로 간다.
> Phase 1~4 는 배포 없이 진행되므로 **운영에 아무 영향이 없다.**

### Phase 0 — 사전 확인 (코드 작업 없음)
- [ ] §6-4 어댑터 최신 상태 확인 → OpenNext 로 갈지 확정
- [ ] Cloudflare 에서 `*.lead-pot.com` 와일드카드 DNS·SSL 구성 가능 여부 확인 (§6-3)
- [ ] Workers 무료 티어 한도 확인(요청 수·CPU 시간)
- [ ] §11 열린 질문 결정

### Phase 1 — 공유 패키지 추출 (운영 영향 없음)
- [ ] 루트 `package.json` 에 npm workspaces 설정
- [ ] `packages/public-ui/` 신설 → 공개 렌더 컴포넌트·lib·styles 이동 (§5-2)
- [ ] `frontend` 가 새 패키지를 바라보도록 import 정리
- [ ] ✅ **회귀 검증**: `tsc -b` · `npm run build`(앱+embed) · `vitest` · 공개 폼/랜딩/임베드 육안 확인
- [ ] 여기서 커밋 — 이 시점의 동작은 지금과 100% 같아야 한다

### Phase 2 — SSR 안전성 정리 (운영 영향 없음)
- [ ] `utm.ts`·`site.ts` 의 `window` 의존 제거(인자화) — §5-3
- [ ] `HtmlBlock` 에 **서버 렌더 경로 + 정화(sanitize)** 추가 — §5-4
- [ ] `LandingView` 가 실시간 값을 **props 로도** 받도록(서버 주입용) — §6-2
- [ ] ✅ 회귀 검증 반복

### Phase 3 — 렌더러 앱 신설 (로컬까지)
- [ ] `renderer/` Next.js 앱 생성 + OpenNext Cloudflare 어댑터
- [ ] 라우트: `app/[identifier]/page.tsx` — `Host` 헤더에서 서브도메인 추출
- [ ] 서버 데이터 로딩: `/api/public/sites/{sub}/{id}` + 필요 시 `/live`
      → **`CF-Connecting-IP`·`User-Agent` 전달** (§6-1) 🔴
- [ ] 메타데이터: 랜딩별 `<title>`·`og:*`·`description` (§1-4)
- [ ] 404 처리: 없는 서브도메인/식별자 → 기존 `SiteNotFound` 와 동일하게
- [ ] ✅ 로컬 검증: `curl` 로 **JS 없이** 본문이 보이는지, 실시간 숫자가 이미 박혀 있는지

### Phase 4 — 렌더 모드 토글 (백엔드 + 편집기)
- [ ] **Flyway V41** `landing_pages.render_mode` 추가 (기본 `'SSR'`)
- [ ] 엔티티·서비스·DTO 반영 (§5-5)
- [ ] 편집기 토글 UI + HTML 블록 스크립트 제한 안내 문구 (§5-4)
- [ ] 렌더러가 `renderMode=CSR` 이면 SPA 셸로 폴백
- [ ] ✅ 백엔드 테스트 통과 확인

### Phase 5 — 배포 (⚠️ 사용자 직접 작업 구간 — §8)
- [ ] Cloudflare 에 렌더러 배포 → `*.workers.dev` 임시 도메인에서 먼저 검증
- [ ] 배포 워크플로 추가(`renderer/**` 변경 시에만)
- [ ] 와일드카드 DNS·SSL 구성
- [ ] `*.lead-pot.com` 라우트를 렌더러로 전환 ⭐ **되돌리기 지점**
- [ ] `app`·`api` 등 예약 호스트가 영향받지 않았는지 확인

### Phase 6 — 검증 & 재심사
- [ ] §9 검증 시나리오 전부 통과
- [ ] 🔴 **IP 차단 실동작 테스트** (§6-1)
- [ ] 구글 광고: 최종 URL 재설정 → **이의신청(재심사 요청)** 제출
- [ ] 2~3일 관찰: 리드 유실 없는지 · 통계가 정상인지 · 승인 나는지

### Phase 7 — 정리
- [ ] [CLAUDE.md](../CLAUDE.md) §2 표·§3 아키텍처·§6 배포법 갱신
- [ ] [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) Phase B 와 정합성 맞추기(프론트 이전 대상 확정)
- [ ] [PROGRESS.md](PROGRESS.md)·[ROADMAP.md](ROADMAP.md) 갱신
- [ ] I3 SEO 항목을 "해소됨"으로 정리

---

## 8. 사용자가 직접 해야 하는 일 (Claude 는 계정 접근 권한 없음)

| # | 작업 | 위치 |
|---|---|---|
| 1 | Cloudflare Workers 프로젝트 생성 · GitHub 저장소 연결 | Cloudflare 대시보드 |
| 2 | 환경변수 등록 — API 주소·앱 주소 | Workers → Settings → Variables |
| 3 | `*.lead-pot.com` 와일드카드 DNS 레코드 + SSL | Cloudflare DNS |
| 4 | Workers 라우트 `*.lead-pot.com/*` 연결 | Workers → Routes |
| 5 | `app`·`api`·`www` 개별 레코드가 그대로인지 확인 | Cloudflare DNS |
| 6 | (선택) API 토큰을 발급해 주면 이후 배포는 CLI 로 자동화 가능 | 최소 권한(Workers 배포)으로만 |

---

## 9. 검증 시나리오 (Phase 6 체크리스트)

**A. 크롤러 관점 — 이번 작업의 핵심**
- [ ] `curl https://{sub}.lead-pot.com/{id}` 응답 HTML 에 **본문 텍스트가 그대로** 들어 있다
- [ ] 그 HTML 에 **실시간 숫자가 이미 박혀 있다**(`0명`·`100개` 가 아니라 실제 값)
- [ ] JS 를 끈 브라우저에서도 페이지가 읽힌다
- [ ] `<title>`·`og:title` 이 랜딩별로 나온다

**B. 기존 기능이 안 죽었는지**
- [ ] 리드 제출 → 대시보드에 정상 수집(값·UTM·유입 파라미터 포함)
- [ ] 스텝형 폼 단계 이동·유효성 검사·자동 진행
- [ ] 계산기 랜딩 결과 화면
- [ ] 동의문서 인라인 펼침(`992877e`)
- [ ] 오버레이·풀스크린 CTA
- [ ] 픽셀 PageView·전환 발사 (Google Tag Assistant 로 확인)
- [ ] 🔴 **IP 차단**: 차단된 IP 로 접속 시 실제로 막히는지 (§6-1)
- [ ] 방문·스크롤·이탈 통계가 정상 기록 + **크롤러 방문이 통계에 안 섞이는지**

**C. 안 건드린 영역**
- [ ] `app.lead-pot.com` 관리 화면 정상
- [ ] `/f/{id}` 단독 공개 폼 정상
- [ ] 외부 사이트 임베드(`embed.js`) 정상

---

## 10. 롤백

| 시점 | 되돌리는 법 |
|---|---|
| Phase 1~4 중 | 배포 전이라 코드 되돌리면 끝. 운영 영향 0 |
| Phase 5 직후 문제 발생 | Cloudflare 에서 **Workers 라우트만 해제** → 즉시 기존 SPA 로 복귀 |
| 특정 랜딩만 문제 | 그 랜딩의 `renderMode` 를 `CSR` 로 (§5-5) — 배포 없이 개별 회피 |

> Flyway V41 은 컬럼 추가(기본값 있음)라 **롤백해도 기존 코드가 그대로 동작**한다.

---

## 11. 착수 전 결정 필요 ❓

1. **`/f/{id}` 단독 공개 폼도 SSR 대상에 넣을 것인가**
   - 지금 계획은 **서브도메인 랜딩만** 다룬다(광고 최종 URL 이 주로 이쪽이라).
   - `/f/{id}` 는 `app.lead-pot.com` 에 있어 같은 호스트를 두 오리진으로 쪼개야 한다(복잡).
   - → **광고에 `/f/{id}` 를 직접 쓰고 있다면 범위에 넣어야 한다.** 확인 필요.
2. **토글 기본값** — §5-5 권장대로 "기본 SSR + 비상용 CSR" 로 갈지, 사용자가 켜야 SSR 이 될지
3. **공유 패키지 추출(Phase 1) 을 지금 할지** — 안 하면 초기 속도는 빠르지만 드리프트 위험이 남는다
4. **프론트 호스팅 이전(HOSTING-MIGRATION-PLAN Phase B)과 묶을지** — 어차피 Cloudflare 를 만지므로 같이 하면 효율적

---

## 12. 진행 체크리스트 (이어받는 세션용)

```
[ ] 0  어댑터·와일드카드 확인 + §11 결정
[ ] 1  packages/public-ui 추출 → 프론트 회귀 검증 (운영 영향 0)
[ ] 2  SSR 안전성(window 제거·HtmlBlock 서버렌더+정화·live props화)
[ ] 3  renderer(Next.js) 신설 → 로컬에서 "JS 없이 본문 보임" 확인
[ ] 4  V41 render_mode + 편집기 토글
[ ] 5  Cloudflare 배포 → 임시 도메인 검증 → *.lead-pot.com 라우트 전환 ⭐
[ ] 6  §9 검증 전부 + 🔴 IP 차단 테스트 + 구글 이의신청 → 2~3일 관찰
[ ] 7  CLAUDE.md·HOSTING-MIGRATION-PLAN·PROGRESS 갱신
```
