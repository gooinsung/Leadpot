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
  - **✅ D3 `main` 병합 완료**(현재 main에 `auth/Subdomains.java`·`PublicSiteController` 포함). 남은 것: SPEC·FEATURES 문서에 D3 반영 / 배포용 와일드카드 DNS·SSL(사용자 리소스, 나중).
- **현재 위치**: **핵심 루프(폼 공개→제출→리드 수집→조회) 완성 ✅** — 실제 데이터가 쌓임(방문자정보 포함) + **통계 대시보드 ✅**
- **완료**: Phase 1 인증 ✅ / Phase 2 폼 빌더 ✅ / **리드 수집(Phase 4 앞당김) ✅** / **Phase 3 랜딩 빌더 & 폼 연결 ✅** / **리드 상태변경·CSV 내보내기 ✅** / **이미지 업로드 R2 연동(경로 구조화 landing-image/YYYY/MM/DD) ✅** / **통계 고도화(방문 추적+전환율+순방문·트래픽 분리+일/주/월+호버툴팁+기간/대상 필터+랜딩/폼별) ✅** / **동의문서 이름/제목/내용 분리 ✅** / **IP 차단(K2) — 리드폼별·CIDR·사유·차단 로그 ✅**
- **추가 폼 개선(2026-07-24)**: 공개 폼 이름 숨김 · 동의 항목 기본체크 설정 · 공개 폼 모바일 최적화(1차) · **스텝형 답변 방식 확장**(카드 단일/다중 + 선택박스·텍스트·장문·연락처·이메일·숫자·날짜) · **마지막 단계 커스텀 안내문구**(typeConfig.contactMessage) · 스텝 입력형 간격 개선 · **중복 제출 방지(K3)**: 항목별 중복허용/유효기간 + 폼 동일IP 접수허용(settings_config, Flyway V6)

## 👉 다음에 할 일 (이어받는 세션은 여기부터)

> ### 🎨 UI/UX 개선 단계 진행 중 — 정본 계획 [UIUX-PLAN.md](UIUX-PLAN.md)
>
> #### ✅ 2026-08-01 세션 — **U1~U3 실앱 검증 완료 + 버그 2건 수정** (gooinsung PC)
>
> **U0~U3 는 이제 실앱(로그인 상태)에서 검증됐다.** 이전 세션의 "실앱 화면을 못 봤다" 항목은 해소.
>
> - **검증 방법**: 브라우저 패널이 화면에 표시되지 않아 **실제 클릭이 페이지에 전달되지 않았다** → 읽기 확인은 `read_page`·`get_page_text`, 동작 확인은 **DOM 이벤트 디스패치**(`el.click()`)와 **fetch 인터셉트**(요청/응답/상태 로깅)로 했다. 좌표 클릭은 이 환경에서 빗나간다(DPR 1.25 + 패널 미표시). 다음 세션도 같은 방법을 쓰면 된다.
> - **읽기 검증 통과**: 대시보드 KPI(리드 14·유입 5·폼 2·랜딩 1) / 인박스 rail 카운트가 DB와 일치(미확인 14·폼별 2·12) / 3-pane 좌표 겹침 없음(rail 0–236 · 목록 236–865 · 패널 865–1265) / **폼별 목록 헤더-데이터 열 폭 완전 일치·행 높이 60px 균일** / 상태 셀렉트 색 정상(`ld-NEW` = `#2D35A3` on `#ECEDF9`, 회색 아님) / 표 회귀 없음(리드폼·랜딩·동의문서·광고주 전부 `card-table`, 요소·통계 정상).
> - **쓰기 검증 통과**(사용자가 실데이터 변경 승인): 단건 상태변경(PATCH 204 → 재조회 DONE → 이력 "상담중 → 완료" 정확) · 태그 추가/유지 · 메모 저장·삭제 · **SYSTEM 이력은 삭제 버튼 없음**(사용자 MEMO만 삭제 가능) · **일괄 상태변경**(3건 → 상담중, rail 신규 14→10·상담중 4) · **일괄 휴지통**(14→13) · **복원**(휴지통 → 활성 목록).
>   - ⚠️ 관찰: 빠른 연속 클릭으로 상태변경 요청이 겹치면 이력에 같은 전이가 중복 기록될 수 있다(내 스크립트가 만든 경합, 단독 조작에선 재현 안 됨). 쓰기 중에는 UI가 입력을 잠그므로 실사용 문제로 보진 않았다. **정식 재현·수정은 안 했다.**
> - **✅ 답변 1줄 요약 = 쓸 만하다**(판단 대기 항목 해소): 실데이터에서 `2000만원~ 4000만원 · 집(자가)`, `1000만원~ 2000만원 · 차량` 처럼 나온다. **요약 규칙 조정 불필요** — "목록에 보일 항목" 설정 추가 안건은 접는다.
>
> **🐞 발견·수정한 버그 2건** (`bb1032f`·`7e900fa`, 프론트 전용·마이그레이션 없음)
>
> 1. **목록 연락처 마스킹 하이픈 위치 오류** — 모든 행에 `010-1234-··` 대신 **`0101-234-··`** 로 표시됐다. 원인: `maskPhone` 정규식 `(\d{2,4})[-\s]?(\d{3,4})[-\s]?(\d{4})` 이 11자리 번호에서 greedy 백트래킹으로 `0101`+`111`+`1111` 로 쪼갬. → 숫자만 뽑아 **뒤 4자리를 가리고 국번(02는 2자리, 그 외 3자리)** 으로 하이픈을 넣도록 재작성. 국제표기 등 형식을 특정할 수 없는 값도 뒤 4자리는 반드시 가린다(원본 노출 방지). `lib/leadDisplay.ts`.
> 2. **좁은 화면(375px)에서 문서 폭이 뷰포트를 넘어 리드 상세 서랍이 화면 밖으로 밀렸다** — 문서 폭 734px. 원인 둘: ① **상단바**(로고+내비 9개+계정 액션)가 줄지 않음(`topbar-left` 463px, `nav-link` 에 `white-space` 없어 글자가 세로로 쪼개짐) ② **목록 상단 액션 바**(`.dash-head`/`.edit-actions`)가 줄바꿈 없이 min-content 411px 요구. `position:fixed` 인 `.lead-drawer` 가 넓어진 레이아웃 뷰포트 기준으로 밀려 **x=376(뷰포트 375) → 안 보였다**. → `.nav-link{white-space:nowrap}` + 900px 이하에서 내비만 자체 가로 스크롤·이메일 숨김 + 두 액션 컨테이너에 `flex-wrap:wrap`. **데스크톱 시각 변화 없음.**
>    - 결과: 문서 폭 734 → 375, 서랍이 뷰포트 안(x=131)으로 들어옴. **내비 그룹핑 정본 정리는 U4** (지금은 넘침만 막은 임시 조치 — 375px 에서 내비 가시 폭이 52px 뿐이라 스크롤해야 한다).
>
> - **`main` 최신 = `7e900fa`** · 프론트 자동배포 success · 백엔드 변경 없음(다음 Flyway 여전히 **V20**).
> - **⚠️ 배포 직후 브라우저 캐시**: `index.html` 이 캐시되어 구버전 자산을 계속 물 수 있다. 확인할 때 캐시 무시 새로고침(또는 `?cb=1`)을 쓸 것.
>
> - ✅ **U0 CSS 구조화** (`7f298ed`): `App.css` 1778줄 모놀리식 → 레이어(tokens/base/components/layout/features) + `frontend/src/styles/README.md` 지도. 동작·시각 변화 0(번들 크기 동일 검증).
> - ✅ **U1 통합 리드 인박스** (`29fcb47`): `GET /api/leads/inbox`(전체 폼 합산·필터·페이징+출처폼명, 미확인=신규NEW) + `/inbox` 3-pane 페이지(rail·목록·사이드패널) + TopBar '리드' 내비. 폼별 뷰(`/forms/:id/leads`)는 유지. `InboxTest` 5개.
> - ✅ **U2 일괄 작업** (`e403b8b`): `PATCH /api/leads/bulk/status`·`POST /api/leads/bulk/trash`(부분성공, 처리건수) + 인박스 체크박스·전체선택·일괄 툴바(상태변경/휴지통). `BulkLeadTest` 3개.
> - ✅ **U2 사이드 패널 통일** (`68263d6`, 병합 `60fb348`): 공용 **`components/LeadSidePanel.tsx`** 신설(인박스 로컬 패널 추출·확장) — `variant="pane"`(인박스 3-pane) / `variant="drawer"`(폼별 목록 우측 서랍, **딤 배경 없어 목록 맥락 유지**). 내용 합집합 = 답변·상태칩·**태그 편집**·방문자(IP/언어/유입/UTM)·메모·이력(삭제)·ESC 닫기. `LeadsListPage` 의 모달 → 이 패널로 교체, **`LeadDetailModal.tsx` 삭제**. CSS는 `features/leads.css`(`.lead-drawer`·`.ip-tags`·`.ip-head-*`).
>   - **결정**: 일괄작업은 **인박스에만** 둔다(폼별 뷰는 카드 레이아웃이라 체크박스가 어색 + 일괄은 여러 폼을 아우르는 성격). 폼별 뷰 표 정리는 U3에서.
>   - **검증**: `tsc -b` + prod(embed 포함) 빌드 통과. ⚠️ **실앱 시각 확인은 아직(아래 1번)**.
>
> - ✅ **U3 가독성 패스** (`cbca5f2`, 병합 `fb71205`): **폼별 리드 목록을 컴팩트 행 목록으로 전환**(사용자 결정 — 답변 인라인 카드 폐기, 전체 답변은 상세 서랍에서) + **연한 배경 위 글자색 ink 토큰** 신설로 상태 배지·pill 대비 2~3:1 → **5.0~8.4:1** + **마케터 상태색 `.ld-*` 한 벌로 단일화**(`.badge b-*` 갈래 제거, 광고주 상태 셀렉트가 회색으로만 보이던 문제도 함께 해결) + 표 정돈(`th` 톤·행 밀도·`card-table` 모서리 클리핑을 6개 목록 화면에) + 타이포 토큰 `--fs-*` 도입. 표시 로직은 **`lib/leadDisplay.ts`** 로 공용화(인박스·폼별 동일 규칙). 상세 = [UIUX-PLAN.md](UIUX-PLAN.md) §U3.
>   - **검증**: `tsc -b`+prod 빌드 통과 · 빌드된 CSS 로 정적 프리뷰를 띄워 **DOM 실측**(1440/375px: 헤더-데이터 열 정렬 일치 · 행 높이 61px 균일 · 가로 스크롤 없음 · 상태색 대비 전부 ≥4.5:1). ⚠️ **실앱 로그인 확인은 아래 1번**.
>
> #### ✅ 2026-08-01 세션 — **HTML 블록 `<script>` 실행 지원** (`00320b1`, 배포 success)
>
> **문제**: 랜딩 HTML 블록에 넣은 요소가 미리보기·공개 페이지 모두에서 제대로 안 나왔다.
> **원인**: HTML 블록은 `dangerouslySetInnerHTML`(=`innerHTML`)로 렌더되는데, **`innerHTML` 로 삽입된 `<script>` 는 HTML 표준상 실행되지 않는다**(React 제약 아님). `<style>` 은 적용되므로 → `opacity:0` 으로 숨겨두고 JS 로 보이게 하는 흔한 패턴이 **영구히 안 보였다**. 게다가 블록은 로드 후 주입되므로 `DOMContentLoaded` 도 이미 지난 상태(이중 차단). 실측: `scriptActuallyExecuted:false` / `styleApplied:opacity 0` / `readyState:complete`.
>
> **해결 = 공용 [`components/HtmlBlock.tsx`](../frontend/src/components/HtmlBlock.tsx)** (사용자 결정: "script 실행 지원 추가")
> - HTML 을 붙인 뒤 `<script>` 를 **재생성해 교체** → 실행
> - 이미 지나간 `DOMContentLoaded`·`load` 등록은 실행 구간에만 **즉시 실행으로 보정**(워드프레스·티스토리에서 복사한 코드가 이 패턴을 많이 씀 — 사용자 실제 사용 코드가 그랬다)
> - 실행 중 만든 **`setInterval`·`setTimeout`·`addEventListener`·`IntersectionObserver`/`MutationObserver`/`ResizeObserver` 를 추적해 블록이 사라지거나 내용이 바뀔 때 정리**. 사용자 코드에 `setInterval(fn, 10)`(초당 100회)이 있어 이게 없으면 편집 중 타이머가 누적돼 편집기가 멈춘다. 편집 미리보기는 `debounceMs=600`.
> - 적용 5곳: 공개 랜딩 · 랜딩 편집 미리보기 · 공개 리드폼 · 리드폼 미리보기 · 요소 편집 미리보기. **동의문서는 제외**(법적 문서, script 불필요).
>
> **결정: 같은 문서에 주입하는 방식 유지**(iframe·Shadow DOM 아님) — 플로팅 헤더의 `position:fixed` 가 화면 기준으로 붙어야 하고, 사용자 코드가 `document.getElementById` 로 자기 요소를 찾기 때문. Shadow DOM 은 후자가 깨지고, iframe 은 전자가 깨진다.
>
> **보안 판단**: HTML 블록은 이 변경 **이전에도** 임의 JS 실행이 가능했다 — `<img onerror>` 같은 인라인 이벤트 핸들러는 `innerHTML` 로도 실행된다(실측 `inlineEventHandlerExecuted:true`). 작성자는 소유 마케터 본인뿐(광고주 계정에 HTML 편집 권한 없음)이라 **신뢰 경계가 넓어지지 않는다.**
>
> **실앱 검증**(`/html-components/new` 미리보기, 사용자 실제 코드): `#sc-dynamic-date` → `7/25(토) ~ 8/1(토)` 채워짐 · **카운트다운 실제 작동**(`23:15:44`) · `.sc-highlight` 색 적용 · 내용 교체 시 `clearInterval` 정확히 1회 호출·이전 블록 제거(**타이머 누출 0**).
>
> #### ✅ 이어서 — **블록 CSS 자동 격리** (`ee8da91`, 배포 success)
>
> **사용자 요구**: "AI에게 '플로팅 헤더 만들어줘' 해서 나온 코드를 **검증 없이 그대로 붙여쓰고 싶다**."
>
> **문제**: 같은 문서 주입의 대가로 블록 `<style>` 이 전역에 샌다. 워드프레스·티스토리·AI 코드에는 전역 리셋이 흔하다(`* { margin:0;padding:0 }` · `html, body {…!important}` · `body { padding-top:70px !important }` · `#tt-body-page` · `.tt_article_useless_p_margin`). 실측: 그 코드를 **주입만 해도** `document.body` 의 `padding-top` 이 `0px → 70px` 로 바뀌었다(= 랜딩 전체·관리자 화면이 깨진다).
>
> **해결**: 주입할 때 블록 `<style>` 의 선택자를 블록 스코프로 다시 쓴다(`scopeStyles`).
> - 블록마다 고유 `data-lp-hb` 속성을 스코프로 사용 → **블록끼리도 CSS 가 안 섞인다**
> - `html`·`body`·`:root` → 블록 루트가 대신 받는다 / `*` → 블록 루트와 그 자손까지만
> - `@media`·`@supports` 재귀 처리, `@keyframes`·`@font-face`·`@import` 는 그대로(스코프 개념 없음)
> - 선택자 파싱은 정규식이 아니라 **브라우저 CSSOM**(`styleEl.sheet.cssRules`)으로 한다 — 정확하다
>
> **실앱 검증**(`/html-components/new`, 사용자가 준 티스토리 리셋+플로팅 헤더+10ms 타이머 코드 그대로): `body padding-top` **0px 유지** · 관리자 상단바 그대로 · 헤더 `position:fixed`·top 0·height 55 정상 · **타이머 작동**(`00:53:20:97 → :96`) · 스코프 `lp-hb-1` 적용.
>
> **⚠️ 여전히 블록마다 고유해야 하는 것**(CSS 만 격리되고 JS 는 같은 문서를 공유하므로):
> - **`id`** — 사용자 코드가 `document.getElementById(...)` 로 찾으면 문서 전체에서 먼저 나온 것을 집는다. 같은 id 를 두 블록에 쓰면 서로의 요소를 갱신하는 사고가 난다.
> - **`@keyframes` 이름** — 전역. 같은 이름이면 나중 정의가 이긴다.
> - 전역 JS 변수·함수 — 사용자·AI 코드는 보통 IIFE 로 감싸므로 실제 문제는 드물다.
> - **사용자 확인 대기**: 스크립트 본문을 함수로 감싸고 그 안의 `document` 를 **블록 안을 먼저 찾는 프록시**로 바꾸면 id·이름 충돌까지 사라진다(`(function(document){…})(블록전용document)`). 대가 = 최상위 `return` 같은 특이 코드가 문법 오류가 될 수 있고 외부 `src` 스크립트는 해당 안 됨.
>
> #### ✅ 2026-08-01 세션 — **기기 미리보기를 iframe 으로** (`edf3271`·`0424bbd`, 배포 success)
>
> **문제(사용자 제보)**: 랜딩 미리보기에서는 글자가 넘쳐 보이는데 **실제 배포된 랜딩은 정상**이었다.
> **원인**: 미리보기 '모바일' 은 `.lp-preview-stage.mobile .lp-preview-device { max-width: 360px }` — **박스만 좁힌 것**이었다. `@media (max-width: 768px)` 는 박스가 아니라 **브라우저 창 폭**(1280px)을 보므로 미리보기에서는 적용되지 않았고, 데스크톱 크기(`5rem`=80px)가 360px 박스에 들어가 넘쳤다. 실제 폰은 뷰포트 375px → 미디어쿼리 적용(`3.5rem`=56px) → 정상. **사용자 코드도 우리 CSS 도 틀린 게 아니라 미리보기 구조의 한계였다.**
>
> **해결 = [`components/DevicePreviewFrame.tsx`](../frontend/src/components/DevicePreviewFrame.tsx)** — 미리보기를 **iframe** 안에 렌더한다. iframe 은 자기 뷰포트를 가지므로 폭 375px 을 주면 미디어쿼리가 실제 폰과 똑같이 평가된다.
> - 부모 문서의 스타일시트를 iframe 으로 복사(공개 랜딩과 같은 룩) + 내용은 `createPortal` 로 iframe body 에 렌더
> - **PC(1280px)는 실제 폭으로 렌더한 뒤 `transform: scale()` 로 축소** — 폭을 줄이는 게 아니라 축소하는 것이라 미디어쿼리 기준은 1280px 그대로
> - `fitHeight` 프롭 = 화면에서 차지할 높이. 기기 높이는 `fitHeight/scale` 로 잡아 축소 후에도 같은 높이로 보인다
> - 덤: `position:fixed` 플로팅 헤더가 **미리보기 화면 기준**으로 붙어 관리자 UI 를 덮지 않고, 블록 스크립트의 `document` 가 iframe 문서라 관리자 화면과 완전히 분리된다(id 충돌도 미리보기에선 사라짐)
>
> **⚠️ `HtmlBlock` 을 iframe 대응으로 고쳤다** — iframe 은 문서·`window`·**CSSOM 클래스가 전부 다른 객체**다. 전역 `document` 로 script 를 만들면 엉뚱한 문서에 붙고 `rule instanceof CSSStyleRule` 판정도 실패한다. 이제 전부 `host.ownerDocument` / 그 창 기준으로 동작한다. **iframe 안에서 DOM 을 다루는 코드를 새로 쓸 때 같은 함정에 주의.**
>
> **회귀 1건 만들고 고침**(`0424bbd`): 바깥 스테이지(`max-height:74vh; overflow-y:auto`)와 iframe 내부 스크롤이 겹쳐 **스크롤바가 두 겹**으로 보였다 → 스테이지 `overflow:hidden`, 스크롤은 iframe 안에서만.
>
> **실앱 검증**(`/landings/3/edit`): 모바일 = iframe 뷰포트 **375px** · `matchMedia('(max-width:768px)')` **true**(예전엔 false) · 가로 넘침 없음 · **스크롤 가능 영역 1개**(iframe 내부만). PC = iframe 뷰포트 **1280px** · `scale(0.41)` · `matchMedia(768)` **false**(데스크톱 스타일) · 화면상 높이 모바일과 동일. 폼·HTML 블록 모두 정상 렌더(포털 작동).
>
> #### 👉 이어받는 사람은 여기부터 (다음에 할 일, 우선순위 순)
> 1. **[검증] 실앱에서 리드 화면 눈으로 확인** — ⚠️ 로그인이 필요해 U1~U3 모두 **실앱 화면을 못 봤다**(정적 프리뷰·DOM 실측까지만). **로그인해서** ①`/inbox` 리드·rail 카운트 ②사이드패널 상태변경·태그·메모 ③체크박스 일괄 상태변경/휴지통 ④**폼별 리드 목록이 한 줄씩** 나오고 줄 클릭 → 우측 서랍이 목록을 가리지 않는지(휴지통·모바일 포함) ⑤**답변 1줄 요약이 실제 데이터에서 쓸 만한지**(빈약하면 요약 규칙 조정 — `lib/leadDisplay.ts`) ⑥**기존 화면들(대시보드·리드폼·랜딩·동의문서·요소·IP차단·광고주) 표·배지 안 깨졌는지** 회귀. 깨진 곳은 해당 feature CSS 에서 수정.
> 2. **[U4 내비게이션 정리]** — 상단바 9개+ 그룹핑/정돈(사이드바 여부 재검토). UIUX-PLAN.md U4. **착수 전 사용자에게 물을 것**: 상단바 유지 vs 좌측 사이드바 전환(리드 인박스가 이미 3-pane이라 사이드바와 겹칠 수 있음).
> 3. 이후 U5(빈화면/로딩/에러/토스트)·U6(광고주 포털 Task-First+모바일)·U7(비주얼 컨셉 확정 — 남은 화면의 `--fs-*` 토큰 적용도 여기서). 컨셉 4선/인박스 프리뷰는 아래 "참고 링크".
>
> #### ❓ 사용자 확인 대기 (U3 결과물에 대한 판단 — 1번 검증하면서 같이)
> - **답변 1줄 요약이 실제로 쓸 만한가**: 지금 규칙 = 이름·연락처 항목을 뺀 나머지 답변 값을 " · " 로 이어 붙이고 넘치면 말줄임(`lib/leadDisplay.ts` `summarizeAnswers`). 항목이 많으면 잘리고 적으면 빈약할 수 있음 → 별로면 **"목록에 보일 항목"을 리드폼 설정에 추가**하는 쪽으로 바꾼다(백엔드 `settings_config` 확장, 마이그레이션 없음).
> - **목록의 연락처 마스킹**(`010-1234-··`): UIUX-PLAN 확정사항("목록 마스킹·상세 전체")대로 적용했지만, 마케터가 목록에서 번호를 훑어야 한다면 해제/토글로 바꿀 수 있다.
> - **일괄작업을 폼별 목록에도 넣을지**: U2에서 인박스에만 두기로 판단(기록 = UIUX-PLAN §U2). 폼별도 이제 행 목록이 됐으니 넣기 쉬워짐 — 필요하면 체크박스 열만 추가.
>
> #### ⚙️ 이어받을 때 알아둘 것
> - **로컬 실행**(PC별 경로 다름 — wincube PC 예시): JDK21=`C:\Users\wincube\.jdks\ms-21.0.11`, 백엔드 `cd backend && JAVA_HOME=<위경로> ./gradlew.bat bootRun`(⚠️ `application-local.properties`=Neon 접속정보, gitignore·PC마다 별도). 프론트 `cd frontend && npm run dev`. **로컬 백엔드는 실데이터(Neon 공유) 건드림 주의.**
> - **CSS 구조**: `frontend/src/styles/README.md` 먼저 읽기(U3에서 ink 토큰·상태색 단일화·`card-table` 규칙 추가됨). 새 스타일은 알맞은 레이어에. 리드 화면 스타일은 `features/leads.css`.
> - **로그인 없이 화면 확인하는 법**(U3에서 쓴 방법): `cd frontend && npm run build` → `npx vite preview` → `dist/` 에 임시 html 을 넣고 빌드된 `assets/index-*.css` 를 `<link>` 로 붙여 마크업만 렌더 → 브라우저 DOM 실측(열 정렬·대비·오버플로). `npm run build` 는 `dist` 를 비우므로 임시 html 은 빌드 후에 만든다.
> - **배포**: `main` push → CI 자동배포(프론트 rsync 즉시 / 백엔드 재빌드 ~2~4분, 그 사이 API 502 순단 정상). `gh` CLI 없어 CI상태는 GitHub Actions 페이지 or `curl api.github.com/repos/gooinsung/Leadpot/actions/runs`.
> - **참고 링크(이 세션 산출물)**: 디자인 컨셉 4선 `claude.ai/code/artifact/a2a7625e-...` · 인박스 와이어프레임 `.../5ce77b6e-...` · 인박스 실스타일 프리뷰(U1+U2) `.../b5da78c9-...`
>
> ### 🎉 광고주 포털 **A1~A7 전부 완료** (2026-07-31)
>
> **광고주 포털이 끝났다.** 남은 것은 오픈 전 챙길 것(개발/운영 DB 분리·백업 등, 아래 "🚧 오픈 전 챙길 것" 참고)과, 후속 기능(구독 리포트 메일발송·광고주 팀계정·외부 CRM 웹훅 등, 계획서 §후속) — **무엇을 다음으로 할지는 사용자와 상의해서 정한다.**
>
> #### ✅ 2026-07-31 세션 완료 — **A7 광고주 화면 미리보기(impersonate)** (브랜치 `feature/a7-preview`)
>
> - **마케터측 읽기 전용 미리보기**: `GET /api/advertisers/{id}/preview`(폼·대시보드)·`/preview/leads`·`/preview/leads/{leadId}`(상세+메모)·`POST /preview/exit`. 쓰기 매핑을 **아예 만들지 않아 구조적으로 읽기 전용**.
> - **§5 증거 오염 방지**: 리드 상세는 `AdvertiserLeadService.leadReadOnly`(seen·VIEW_LEAD 미기록). 진입·이탈은 **IMPERSONATE 로그**(광고주 활동 이력에 남아 투명).
> - `AdvertiserService`에 `AdvertiserLeadService`+`AdvertiserAuditService` 주입(순환 없음). 모든 preview 메서드가 `loadOwned` 로 소유권 재확인.
> - **프론트**: `/advertisers/:id/preview`(`AdvertiserPreviewPage`) — "읽기 전용" 배너 + 폼 칩 + 리드 목록(상태 pill·확인 배지, 쓰기 UI 없음) + 읽기 전용 상세 모달(답변·메모). `/advertisers` 목록에 **'미리보기' 버튼**.
> - **검증**: `AdvertiserPreviewTest` 4개(**미리보기해도 seen 미기록**·진입 IMPERSONATE·이탈 로그·타마케터 404) + 백엔드 전체 통과 · 프론트 빌드.
>
> #### ✅ 2026-07-31 세션 완료 — **A7 마케터측 처리속도 리포트** (병합됨 `7e06fff`)
>
> - **`GET /api/advertisers/{id}/reports/response-time`** — 광고주에게 배정된 **모든 유효 폼의 리드를 합산**(마케터 소유 재확인). 지표 계산은 `AdvertiserReportResponse.from(leads, formId, name, from, to)` **정적 팩토리로 추출 → 광고주(폼1개)·마케터(합산) 공용**(중복 제거).
> - **프론트**: `/advertisers` 목록의 **'리포트' 버튼 → 모달**(KPI 카드 4개 + 상태 분포 pill). `AdvertiserService`에 `LeadRepository` 주입 + KST 기간 필터.
> - **검증**: `AdvertiserReportTest` +2개(마케터 폼 합산·타마케터 404) = 총 4개, 백엔드 전체 통과 · 프론트 빌드.
> - **다음**: A7 마지막 = 광고주 화면 미리보기(impersonate, 읽기전용 강제·IMPERSONATE 로그) → 그러면 **광고주 포털 A1~A7 전부 완료**.
>
> #### ✅ 2026-07-31 세션 완료 — **A7 처리속도 리포트(광고주 화면)** (병합됨 `cb621c3`)
>
> - **`GET /api/advertiser/reports?formId=&from=&to=`** — `AdvertiserReportResponse`: 총 접수·미확인율·**접수→최초열람 평균**(초, `advertiser_seen_at`)·**접수→상태변경 평균**(초, `advertiser_status_at`)·상태 분포(6개). `filterLeads` 재사용, grant 검증.
>   - ⚠️ "접수→첫 상태변경"은 `advertiser_status_at`(광고주 전용·**최근** 변경)으로 근사 — 대부분 1회라 실질 동일. 정직하게 "상태 변경"으로 라벨.
> - **프론트 `/client/report`**(`AdvertiserReportPage`): 리드폼·기간 선택 + KPI 카드 4개(총 접수·미확인율·평균 확인까지·평균 처리까지) + 상태 분포 막대 + **`@media print` 인쇄(PDF 저장)**. `AdvertiserTopBar`에 '리포트' 내비 추가.
> - **검증**: `AdvertiserReportTest` 2개(응답시간 정확 집계·빈 데이터 안전) + 백엔드 전체 통과 · 프론트 tsc+prod 빌드.
> - **다음**: 마케터측 리포트(`GET /api/advertisers/{id}/reports/response-time`, 광고주별 집계) + 광고주 화면 미리보기(impersonate, 읽기전용) → A7 마감.
>
> #### ✅ 2026-07-31 세션 완료 — **A7 화이트라벨 UI** (병합됨 `78ba936`)
>
> - **`GET/PUT /api/advertisers/brand`** — 마케터가 자기 로고 URL·색상 저장/조회(`BrandSettings` DTO, 색상 `#RRGGBB` 검증·빈값이면 해제). 컬럼(`users.brand_logo_url`·`brand_color`)·광고주 화면 읽기(`AdvertiserMeResponse`·`AdvertiserTopBar`)는 이미 있었음 → **설정 API+UI만 추가, 마이그레이션 없음**.
> - **프론트 `BrandSettingsCard`**(`/advertisers` 상단, 접기/펼치기): 로고 파일 업로드(기존 `uploadImage`)·URL 직접입력·로고 제거 / 색상 피커+hex 입력 / **실시간 미리보기**(광고주 상단바 모습) / 저장.
> - **검증**: `AdvertiserBrandTest` 4개(저장·조회, **광고주 me 반영**, 색상형식 거부, 빈값 해제) + 백엔드 전체 통과 · 프론트 tsc+prod 빌드.
> - **다음**: A7 남은 2조각(리포트·미리보기). 각각 독립적이라 나눠서 진행 가능.
>
> #### ✅ 2026-07-31 세션 완료 — **A6 실시간 폴링** (브랜치 `feature/a6-advertiser-realtime`)
>
> - **`GET /api/advertiser/leads/updates?formId=&since=`** — grant 검증 후 `since` 이후 새 리드 수(count 쿼리, `LeadRepository.countByFormIdAndDeletedAtIsNullAndCreatedAtAfter`). `{newCount, serverTime}` 반환, serverTime 을 다음 since 로 써서 시계 오차 방지. since 없으면 기준선만.
> - **프론트 30초 폴링**(`AdvertiserLeadsPage`): 유휴 상태(1페이지·필터 없음·상세 닫힘)면 **자동 reload**, 아니면 **'새 리드 N건 · 새로고침' 배너**(unseen-banner 재사용) — 모바일에서 스크롤·입력 중 화면이 안 튐. 기준선(since)은 formId 바뀔 때만 리셋(ref 기반, stale closure 방지).
> - **검증**: `AdvertiserUpdatesTest` 4개(기준선·새리드 카운트·미래 since 0·미부여 404) + 백엔드 전체 통과 · 프론트 tsc+prod 빌드.
> - **다음**: `main` 병합·푸시(=CI 자동배포).
>
> #### ✅ 2026-07-31 세션 완료 — **A4 내보내기·감사이력** (병합됨 `c40bbf8`)
>
> - **광고주 엑셀/CSV 내보내기** `POST /api/advertiser/leads/export` — 화면 필터(status·q·from·to) 반영. **화이트리스트 컬럼(접수일시·광고주상태·답변)만, IP·UTM·기기 제외**(마케터 exportMatrix 재사용 안 하고 광고주 전용 매트릭스 신설). `LeadExcelService.dataXlsx`/CSV·BOM 재사용.
> - **워터마크**: 파일 맨 아래 `다운로드: {광고주 이메일} / {일시}` 행.
> - **일일 상한**: `app.advertiser.export-daily-max`(기본 **20회**, `APP_ADVERTISER_EXPORT_DAILY_MAX`). `advertiser_access_logs` EXPORT 카운트로 판정 → **스키마 변경 없음**. 초과 시 `PlanLimitExceededException`(409). **건수 제한은 생략(사용자 결정)**.
> - **EXPORT 감사 로그** 기록(권한 can_export 없으면 404 차단).
> - **마케터 활동이력**: `GET /api/advertisers/{id}/logs` + `/advertisers` 목록의 **'활동 이력' 버튼 → 모달**(일시·활동·상세·IP). LOGIN·VIEW_LEAD·STATUS·MEMO·EXPORT.
> - **검증**: `AdvertiserExportTest` 5개(화이트리스트 컬럼·워터마크·EXPORT 로그·권한없음 차단·일일상한) + 백엔드 전체 통과 · 프론트 tsc+prod 빌드.
> - **다음**: `main` 병합·푸시(=CI 자동배포).
>
> #### (직전) A1~A3 · A3-B · A5 완료 — 아래 기록 참조
>
> **정본 문서 = [ADVERTISER-PORTAL-PLAN.md](ADVERTISER-PORTAL-PLAN.md)** — 착수 전 먼저 읽는다.
> **진행상황 정본 = [§9-B 실행 체크리스트](ADVERTISER-PORTAL-PLAN.md#9-b-실행-체크리스트--이어받기용--여기가-진행상황-정본)**
> → `git pull` 후 그 체크리스트에서 **체크 안 된 첫 항목**부터 이어서 하면 된다. 시작·중단·완료마다 갱신·커밋.
> 보고 형식은 §9-A 참고(**쉬운 말 요약 + 확인항목 + URL** 3종 세트).
>
> #### ✅ 2026-07-31 세션 완료 — **A5 광고주 텔레그램 알림** (브랜치 `feature/a5-advertiser-notify`)
>
> - **발송 대상 목록화**: `NotificationService.planDispatches()`(순수 조회로 분리 → 테스트 가능) — ① 폼 소유 마케터(기존 텔레그램·구글시트 그대로) ② 그 폼을 부여받은 광고주(유효 grant·활성 계정·본인 텔레그램 채널). 마케터 폼별 토글과 광고주 계정 토글은 **독립**.
> - **광고주 메시지 정제**: `display_name` 사용 · IP·UTM 없음 · 중복 의심 문구 없음 · **리드 상세 딥링크**(`/client?form=&lead=`, base=`app.public-base-url`).
> - **`notification_logs` 기록**: `NotificationLog` 엔티티 + `NotificationLogRepository` + `NotificationLogWriter`(REQUIRES_NEW, 비동기 스레드에서 채널·수신자·성공여부 저장). 테이블은 V18에 이미 있음 → **마이그레이션 없음**.
> - **광고주 연동 화면 `/client/integrations`**: 텔레그램 토큰·채팅ID + 계정 단위 on/off + 테스트 발송. `AdvertiserPortalController`에 `GET/PUT/POST /api/advertiser/integrations`(기존 `IntegrationService` 재사용, 계정당 1행이라 스키마 변경 없음). `AdvertiserTopBar`에 내비(리드/알림 설정) 추가.
> - **결정(사용자 확정)**: 폼별 세분화 = **계정 단위**로 단순화(V20 미생성). 딥링크 base 프로퍼티 `APP_PUBLIC_BASE_URL`(기본 `https://app.lead-pot.com`) 신규.
> - **검증**: `AdvertiserNotificationDispatchTest` 7개(양쪽 수신·만료 grant 제외·정지 광고주 제외·폼토글 독립·메시지 정제/IP·UTM·중복 미포함·마케터 중복문구 유지) + **백엔드 전체 테스트 통과** · 프론트 `tsc -b`+prod(embed) 빌드 통과.
> - **⚠️ 미검증**: 텔레그램 **실제 수신**은 사용자 봇 토큰·채팅ID 필요 → 광고주가 `/client/integrations`에서 설정·테스트로 확인. (발송 로직·로그·정제·설정저장은 테스트/빌드로 검증됨)
> - **다음**: `main` 병합·푸시(= CI 자동배포) — 사용자 확인 대기.
>
> #### ✅ 2026-07-30~31 세션 완료 (전부 `main` 병합·푸시됨, 최신 `cad8a73`)
>
> | 단계 | 내용 | 상태 |
> |---|---|---|
> | **A1** | 기반·보안 골격 — Role에 ADVERTISER, Flyway **V18**, 역할별 경로 화이트리스트, JWT `role`→authority 컨버터, active 즉시차단, 광고주 토큰 15분 | ✅ |
> | **A2** | 마케터측 광고주 관리 — 초대링크(해시저장·재발급)·계정 CRUD·정지/삭제·**리드폼 권한 부여(1폼:1광고주)**·플랜 상한·`/advertisers` 화면 | ✅ |
> | **A3** | 광고주 포털 코어 — `requireGrant` 단일관문, `AdvertiserLeadResponse` 화이트리스트 DTO, 열람기록(seen_at), 상태변경, 메모 가시성, `/client` 화면, 마케터측 "👁 광고주 확인" 배지·필터 | ✅ |
> | **A3-B** | 광고주 전용 로그인 `/client/login`(회원가입 링크 제거) + **비밀번호 재설정**(Flyway **V19**) + 화이트라벨 1단계(마케터명 기억) | ✅ |
> | 추가 | 광고주 리드 목록을 **마케터 목록과 같은 구조**로 개편(답변 인라인·검색·상태/기간 필터·페이징) | ✅ |
> | 추가 | 광고주 상태에 **'전환'(실제 판매) 추가 → 6개** + 상태별 색상(`.st-*` 한 벌, 브랜드 그린은 전환 전용, `--violet` 토큰 신규) | ✅ |
>
> - **테스트 62개 통과** (광고주 관련 45개 신설: 인가경계 6 · 권한규칙 11 · 로그인감사 3 · 리드격리 17 · 비번재설정 8)
> - **Flyway V19 까지 Neon 적용 완료** → 다음 마이그레이션은 **V20**
>
> #### 👉 다음 = **A7 (부가 기능, 마지막)** ← A6 완료 후. **코어(A1~A6) 전부 완료**
>
> - **A7** 처리속도 리포트(접수→최초열람, 접수→첫 상태변경, 미확인율) / 리포트 엑셀·인쇄PDF(`@media print`) / **화이트라벨 완성**(마케터가 로고·색상 설정하는 UI만 남음 — DB컬럼·광고주 화면 읽기는 준비됨) / 광고주 화면 미리보기(impersonate, 읽기전용 강제·IMPERSONATE 로그).
> · ⚠️ A5 관찰: 폼 1건 제출에 발송이 N+1건이 된다(마케터+광고주). `NotificationService` 스레드풀이 2개라 광고주가 아주 많으면 지연 가능(지금은 문제 없음, 인지만)
> - **A6** 실시간 갱신(30초 폴링) · 참고: 대시보드 API·미확인 배너는 **A3에서 이미 완료**
> - **A7** 처리속도 리포트 / 리포트 엑셀·인쇄PDF / **화이트라벨 완성** / 광고주 화면 미리보기(읽기전용)
>   · 화이트라벨: DB컬럼(`users.brand_logo_url`·`brand_color`)과 광고주 화면 읽기는 준비됨.
>     **마케터가 로고·색상을 설정하는 UI가 아직 없다** → 그것만 만들면 완성
>
> #### 🚧 오픈 전 챙길 것 (기능 외)
>
> - **개발/운영 DB 분리** — 지금은 로컬에서 서버만 켜도 실데이터가 바뀐다(Neon 1대 공유). Neon 브랜치 권장. 상세 = 계획서 §9-C
> - **Neon 백업·복구 설정 확인** (사용자 계정 영역 — 실고객 리드가 쌓이기 전에)
> - 비밀번호 변경 시 기존 리프레시 토큰 무효화(현재 최대 14일 유지) — `token_version` 필드 필요, 지금은 보류
>
> #### ⚙️ 이 세션 작업 PC(gooin) 환경 메모 — 다른 PC에서는 아래 준비물 확인
>
> - 경로 `C:\Users\gooin\git\Leadpot` / JDK21 · Node OK / `C:\Temp` 존재
> - ❗ **`backend/src/main/resources/application-local.properties`** (gitignore·커밋금지, Neon 접속정보) 가 있어야 로컬 기동 가능.
>   **새 PC에는 이 파일이 없으므로 별도로 옮겨야 한다.**
> - 실행: 백엔드 `cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun` (→ :8080) /
>   프론트 `cd frontend && npm run dev` (→ :5173). `frontend/.env` 는 `.env.example` 복사본
> - ⚠️ **이 PC의 Docker Desktop 은 응답하지 않는다**(12분 대기 후 포기). 로컬 Postgres 대안 불가 → Neon 직접 사용
> - Neon 에 이 세션 테스트 데이터 남아 있음(`a2-marketer-*`·`a2-adv*`·`smoke-*`·`audit-*` @test.local, 리드폼 22·23 등).
>   개발 DB로 취급하기로 했으므로 그대로 둠
>
> ### (완료) 이전 순서 (사용자 확정 2026-07-27)
> **1) 배포 = ✅ 완료(2026-07-28)** → **2) 다음 작업 = 광고주 페이지** (→ 위 계획으로 구체화됨)
>
> - **① 배포 — ✅ 완료(2026-07-28, wincube PC에서 진행)**. **실서비스 라이브**: 프론트 https://app.lead-pot.com / 백엔드 https://api.lead-pot.com (헬스 UP). 도메인 `lead-pot.com` 구매·Cloudflare 등록 완료.
>   - **최종 구성**: 백엔드=**Oracle Always Free AMD `VM.Standard.E2.1.Micro`**(공인IP **129.225.198.2**, Ubuntu 22.04, 서울 AD-1) — ARM은 out-of-capacity로 AMD 전환. DB=**Neon 유지**(V17, 재배포 시 마이그레이션 없음). **프론트=같은 VM의 Nginx가 정적 서빙**(`/var/www/leadpot`) — ⚠️ **Cloudflare Pages는 와일드카드(`*.lead-pot.com`) 커스텀 도메인 미지원**이라 서브도메인 랜딩이 안 됨 → Pages 접고 **VM Nginx 일원화**로 결정(사용자 확정). (Pages 프로젝트 `leadpot`는 미사용으로 남음 — 삭제 가능)
>   - **서버 세팅 내역**: 스왑 2GB(`/swapfile`, fstab 등록) · Docker(get.docker.com) · `~/Leadpot` clone · **`.env`**(gitignore, 서버에만): 새 `APP_JWT_SECRET`, Neon 접속(`SPRING_DATASOURCE_*`), `APP_UPLOADS_DIR=/app/uploads`, **`JAVA_TOOL_OPTIONS=-Xmx512m`**(1GB 대응) · `docker compose -f docker-compose.prod.yml up -d --build`(기동 ~60초).
>   - **네트워크/HTTPS**: VCN 보안목록 Ingress **22·80·443** 허용 + **VM iptables**에도 80·443 ACCEPT(REJECT 앞) netfilter-persistent 저장(⚠️ Oracle Ubuntu는 보안목록만으론 안 됨, 호스트 iptables도 열어야 함). 인터넷 게이트웨이+라우트(0.0.0.0/0) 추가(초기 누락으로 SSH 타임아웃났던 지점). **Cloudflare SSL 모드=Full (Strict)**(전구간 암호화), **Origin 인증서**(`/etc/nginx/ssl/lead-pot.pem`·`.key`, SAN=`*.lead-pot.com`·`lead-pot.com`). **DNS(전부 A→129.225.198.2, proxied)**: `api`·`app`·`*`(와일드카드). **Nginx conf 2개**: `leadpot-api.conf`(api.lead-pot.com→127.0.0.1:8080), `leadpot-front.conf`(app·*·apex→`/var/www/leadpot` 정적 + `/assets` 장기캐시 + SPA 폴백 try_files→index.html). 서브도메인/딥링크/embed.js 200 검증.
>   - **CORS**: 서버 `.env` `APP_CORS_ALLOWED_ORIGINS=https://app.lead-pot.com,https://leadpot.pages.dev`(pages.dev는 이제 미사용, 정리 가능). 검증: app 오리진 허용 O, 미등록 차단 O, 콘솔 에러 0.
>   - **🔁 프론트 재배포법(VM 서빙)**: 로컬 `cd frontend && VITE_API_BASE_URL=https://api.lead-pot.com npm run build` → `scp -r dist/* ubuntu@129.225.198.2:/tmp/…` 후 서버에서 `sudo cp -r … /var/www/leadpot/` (정적 교체, Nginx reload 불필요). **백엔드 재배포**: 서버 `cd ~/Leadpot && git pull && docker compose -f docker-compose.prod.yml up -d --build`.
>   - **SSH 키**: `G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key` → `ssh -i "<키>" ubuntu@129.225.198.2`. **Cloudflare**: Account ID `0adbaa51bdd245dea8529a244cc6dcc3`, zone `lead-pot.com`. (배포용 API 토큰은 발급했었음 — 필요없으면 대시보드에서 Revoke 권장)
>   - **✅ CI/CD(GitHub Actions) 완료**: `.github/workflows/deploy-frontend.yml`(frontend/** push→빌드→VM `/var/www/leadpot` rsync **무중단**: 새 자산 먼저 업로드 후 index.html 교체, --delete 안 씀), `deploy-backend.yml`(backend/**·compose push→VM `git pull`+재빌드+헬스체크). 시크릿(저장소): `VM_SSH_KEY`(**CI 전용 ed25519 배포키** — VM `~/.ssh/authorized_keys`에 `leadpot-ci-deploy`로 등록, 폐기하려면 그 줄 삭제), `VM_HOST=129.225.198.2`, `VM_USER=ubuntu`. 첫 자동배포 프론트·백엔드 모두 success. **push만 하면 자동배포됨.** (⚠️ 배포 직후 짧게 화면 빈 현상은 --delete 경합이었고 무중단 방식으로 수정함)
>   - **🔒 보안 마무리(사용자 조치 권장)**: 배포 중 채팅으로 공유된 **Cloudflare API 토큰**(Pages/DNS Edit)은 이제 불필요(CI는 SSH키 사용) → **대시보드에서 Revoke 권장**. Neon 비번·Origin 인증서키는 서버에만 보관(정상).
>   - **남은 배포 후속(선택)**: 실스모크(가입→로그인→폼→공개제출, 특히 **실제 서브도메인 랜딩** 열림 확인) · Cloudflare "Always Use HTTPS" 토글 · apex `lead-pot.com`(A레코드 미설정) 필요 시 추가 · 미사용 Pages 프로젝트 `leadpot` 삭제 · `.env` CORS에서 미사용 `leadpot.pages.dev` 제거.
> - **② 다음 작업(배포 후) = 멀티 포털**: 마케터(기존)/광고주/관리자 3포털로 확장(리드 공급·거래 플랫폼화). **상세 설계 = [MULTI-PORTAL-PLAN.md](MULTI-PORTAL-PLAN.md)** — 착수 전 그 문서 재정독 + §9 결정필요 항목(정산 포함여부·광고주 계정생성·배정단위 등) 사용자 확정부터. 아키텍처 추천=모노레포·단일 백엔드(역할 기반, users.role=MARKETER/ADVERTISER/ADMIN)·프론트 3앱.
>
> **✅ 이번 세션(2026-07-27) 추가 완료 — 전부 `main` 푸시(최신 `e13b890`)**:
>   - **구글시트를 리드폼별 설정으로 이동**(사용자 결정): 시트 URL/시크릿/on-off 를 `form.settingsConfig`(sheetsEnabled/sheetsWebhookUrl/sheetsSecret)에 저장. 텔레그램은 계정 채널 유지 + 리드폼별 `notifyEnabled` 토글('텔레그램 알림 받기'). 폼별 시트 테스트 `POST /api/integrations/test-sheets?formId=`. 계정 연동 화면=텔레그램 전용 + 시트 Apps Script 안내만. (account integration_settings.sheets_* 컬럼은 미사용으로 남김)
>   - **구글시트 시크릿 키**(개인정보 보호): 웹훅 payload 에 secret 담아 보내고 Apps Script 가 검증(`var SECRET`). Flyway V17(계정용, 현재는 폼설정 사용).
>   - **대시보드 정리**: '곧 추가될 기능' 카드 제거, '오늘 유입'·'랜딩페이지' KPI 실제 값 연결.
>   - Neon 검증 완료(계정=텔레그램만, 폼 시트설정 저장, test-sheets 동작, 404). Flyway **V17** 까지 적용(다음 V18).
>   - **미결(사용자 결정 대기)**: "중복/형식오류 거부 제출 로그"(스팸 시도 기록) — 붙일지 배포 후 할지 미정.
> 2. **I5 노출 임프레션 추적** — 요소가 화면에 보인 횟수(IntersectionObserver). 현재는 클릭만.
> 3. **기타 BACKLOG 미완 항목** — F 팀 CRM(후기), G 파티 등은 규모 큼.
>
> **✅ 이번 세션(2026-07-27) 완료 — 브랜치 `feature/lead-crm-integrations` (main 병합 예정)**:
>   - **리드 관리 고도화**: ① 리드 상세 모달(전체 답변·방문자정보) + **메모/이력**(사용자 MEMO + 상태변경 자동 SYSTEM 이력) ② **리드별 태그**(칩 표시·추가/삭제, 목록 태그 필터). 백엔드 `lead_notes` 테이블 + `leads.tags`(jsonb), `GET/POST/DELETE /api/leads/{id}/notes`·`PUT /api/leads/{id}/tags`·`GET /api/leads/{id}`. 상태변경 시 SYSTEM 이력 자동 기록.
>   - **외부 연동(계정 설정)**: `com.leadpot.integration` — 텔레그램 봇 + 구글시트 **Apps Script 웹훅**(OAuth 불필요·무료, 사용자 결정). `integration_settings` 테이블(계정당 1행), `GET/PUT /api/integrations` + `POST /api/integrations/test`(각 채널 동기 테스트 발송). 연동 설정 페이지 `/integrations`(TopBar '연동') — 봇 토큰/채팅ID·웹훅URL 입력 + 얻는 방법 안내 + Apps Script 코드 복사.
>   - **알림 발송**: `NotificationService` — 새 리드 접수 시 **커밋 후 비동기 best-effort**로 텔레그램 메시지 + 구글시트 JSON POST. 메시지=리드폼 이름+주요 답변+접수일시, **중복 의심이면 표시**(신원 항목=연락처/이메일/중복불허 값이 기존 리드와 겹치면). HttpClient(JDK), 의존성 없는 소형 JSON 직렬화(Spring Boot 4 webmvc가 Jackson을 컴파일 클래스패스에 노출 안 함). 리드 접수를 절대 방해하지 않음(모든 예외 삼킴).
>   - **리드폼별 알림 on/off**: 폼 편집 '옵션'에 '새 리드 알림 받기' 토글 → `settingsConfig.notifyEnabled`(기본 on, 마이그레이션 불필요). NotificationService가 이 값 확인.
>   - **참고**: "불량접수(SPAM)"는 접수 후 **수동 지정** 상태라 접수 시점 알림엔 담기지 않음(사용자에게 안내). 필요 시 '상태 불량 변경 시 알림'은 후속.
>   - **Flyway V16**(lead_notes·leads.tags·integration_settings) — **Neon 적용·validate 통과**. 다음 **V17**.
>   - **검증(Neon 실측)**: 백엔드 컴파일·test(H2 컨텍스트) 통과 / 프론트 `tsc -b`+prod(embed 포함) 빌드 통과 / bootRun(local) 기동 → E2E: 가입→폼생성→공개제출→리드 상세(tags null)→태그 PUT(중복제거)→메모 추가→상태변경 SYSTEM 이력 자동 생성(한글 정상)→메모 삭제→연동 GET/PUT/영속/test(더미 텔레그램 실제 API 호출→401 정상 처리) 모두 확인.
>

> **✅ 이번 세션(2026-07-26) 완료 — 전부 `main` 병합·푸시됨** (커밋 `970942a` 최신):
>   - **랜딩 slug 한글 허용**: `LandingService.resolveSlug` 검증을 한글(가-힣)+영소문자+숫자+하이픈, 2~120자로 확장. URL 조회는 이미 encode/decode 되어 동작. 편집기 placeholder 갱신. (커밋 `46585af`)
>   - **픽셀을 리드폼 단일 출처로 정리(사용자 결정)**: 랜딩 픽셀 개념 제거. 랜딩에 포함된 리드폼의 픽셀이 랜딩에서도 잡히도록 변경 — `PublicSitePage`는 포함 폼들의 픽셀을 병합(`mergeFormPixels`)해 PageView 1회, `LandingView`는 인라인/오버레이 폼 모두 `form.trackingConfig`로 Lead 발사. `LandingEditPage`의 '광고 픽셀' UI 제거. (커밋 `cbd1afb`) ※백엔드 `landing_pages.tracking` 컬럼은 남지만 미사용.
>   - **당근 픽셀 버그 수정**: 스크립트 URL이 `web-pixel.business.daangn.com/0.0`(미존재)이라 SDK 미로드 → `window.karrotPixel` 미정의로 전부 미발사였음. 공식 `karrot-pixel.business.daangn.com/0.2`로 교정, 전환 이벤트 `SubmitApplication`→표준 `CompleteRegistration`. (커밋 `d7728c0`)
>   - **구글 Ads 전환(conversion) 지원**: 기존엔 `generate_lead`(GA4)만 쏴서 Google Ads 전환이 미집계. 리드폼 광고픽셀에 '구글 Ads 전환' 필드(`send_to`=`AW-전환ID/라벨`) 추가 — 스니펫 통째로 붙여넣어도 `parseSendTo`로 추출, google 필드 비어도 AW-ID로 gtag 로드·config, 리드 제출 시 `gtag('event','conversion',{send_to})` 발사. (커밋 `970942a`)
>   - **DB 접속**: Neon 접속정보를 이 PC의 `backend/application-local.properties`에 직접 채움(gitignore·커밋금지). Flyway는 V15까지 이미 Neon 반영됨(신규 마이그레이션 없음). 백엔드는 `local` 프로필로 기동.
>   - **검증**: 프론트 `tsc -b` + prod(embed 포함) 빌드 통과 / 백엔드 `local` 기동·헬스 UP. 픽셀 실동작은 사용자 실데이터(Neon)라 브라우저 실측 자제 — **Google Tag Assistant**로 확인 권장.
>
> **배포 후로 미룬 것**: **I3 SEO**(메타·OG·사이트맵) — 실제 도메인+엣지렌더 없이는 효과 없음(사용자와 합의, 2026-07-25).
> **✅ 2026-07-25 세션에서 K2·M8(정적+동적)·M6·I4·I5·E3(중복) 완료 — 전부 `main` 병합·푸시. Flyway V15까지.**
>   - **M8 동적 요소**: 랜딩 HTML 블록 '동적 요소 삽입' 셀렉트(`DynamicSnippetPicker`, `lib/dynamicSnippets.ts`) → 실시간 신청수·남은자리·최근신청자 토스트·플로팅 헤더/푸터. 공개 `LandingView`가 `data-lp-live` 마커를 `GET /api/public/landings/{id}/live`(연결폼 활성 리드 수 + 최근 마스킹 이름)로 하이드레이션 + 우측상단 토스트. 브라우저 검증(count 3·slots 47·토스트 l**).
>   - **E3 중복 리드**: 리드폼 항목별 allowDuplicate=false 필드 기준, 값 겹치는 리드에 '중복' 배지 + '중복만 보기'(LeadsListPage, 프론트 계산).
>   - **I5 자동 클릭**: 공개 랜딩 이미지·버튼·링크 클릭 자동 수집(LandingView 위임 핸들러, 폼 내부·CTA 제외).
> **작업 방식(사용자 지시 2026-07-25)**: 작업 하나 끝날 때마다 **`main` 병합+푸시**가 기본. (memory: merge-push-after-each-task)
> **사용자 리소스 필요(나중)**: 구글시트/텔레그램/카톡 연동, SMS 본인인증, 클라우드 배포·도메인·와일드카드 SSL, 결제.
> ✅ Flyway 현재 **V15(interaction_events)** 까지 적용됨(다음 **V16**). DB=Neon 공유. `main`=I4·I5까지 포함 최신.
>
> **✅ 이번 세션(2026-07-25) I4·I5 완료 — `main` 병합·푸시됨**:
>   - **I4 전환 퍼널 + I5 요소 클릭(경량)**. 결정: I4+I5 먼저·I3는 배포 때 / 경량 추적.
>     - 백엔드 `com.leadpot.event`: InteractionEvent 엔티티·Repo·Service + `POST /api/public/events`(best-effort 204, IP 해시), Flyway **V15**(interaction_events). StatsService/Response 확장: `funnel`(순방문→폼열기(고유)→접수, 단계 %) + `byEvent`(대상별 총 클릭 상위 20).
>     - 프론트: `recordEvent` api, 공개 랜딩 오버레이 CTA 클릭 시 `form_open` 발사(LandingView), StatsPage에 전환 퍼널 카드 + 요소 클릭 BarCard.
>     - **검증(Neon)**: V15 적용 / 방문4·폼열기2(고유)·접수1 → funnel openRate 50%·submitRate 50% / byEvent 총 클릭 집계 정확 / 백엔드 test·build + 프론트 tsc·prod빌드 통과. (참고: curl 인라인 한글은 Git Bash 인코딩으로 깨짐 → 테스트는 ASCII로.)
>
> **✅ 이번 세션(2026-07-25) 완료 — 전부 `main` 병합·푸시됨**:
>   - **K2 IP차단** · **M8 HTML 요소 라이브러리(정적)** · **M6 폼 외부 임베드**.
>   - **M6 상세**: 방식=script 직접 주입 + **Shadow DOM**(iframe 아님, 사용자 결정). `frontend/src/embed/embed.tsx`(자립 IIFE, `vite.embed.config.ts`로 별도 빌드→`dist/embed.js`, `npm run build`에 포함)가 `[data-leadpot-form]` 컨테이너에 Shadow root 만들고 기존 `PublicFormView` 마운트(tokens+base+App CSS를 :root→:host로 주입해 격리). 백엔드 `SecurityConfig`: `/api/public/**` CORS 모든 오리진 허용(무자격증명). 퍼가기 코드 복사 UI는 `LeadsListPage`("임베드 코드" 버튼). **검증**: 가짜 외부 오리진(:4173) 페이지에 임베드→교차출처 GET 렌더·적대적 host CSS로부터 Shadow 격리·교차출처 POST 제출→리드 저장까지 브라우저로 확인. tsc·양쪽 빌드 통과.
>
> **✅ 이번 세션(2026-07-25) 완료**:
>   - **IP 차단(K2)** — `feature/d3-subdomain` → **`main` 병합·푸시 완료**. (리드폼별·CIDR·사유메모·차단 접속 로그. `com.leadpot.ipblock`, Flyway V13, `IpMatcherTest` 16개. `LeadService.submit`의 `checkIpBlocked`, 로그는 `recordHit` REQUIRES_NEW로 롤백에도 저장.)
>   - **M8 HTML 요소 라이브러리(정적 1단계)** — 브랜치 `feature/html-components`(**미병합**).
>     - 백엔드 `com.leadpot.htmlcomponent`: HtmlComponent 엔티티·Repo·Service(K5)·Controller(`/api/html-components` CRUD)·DTO(Request/Response/Summary), Flyway **V14**(html_components). 동의문서 패턴.
>     - 프론트: 관리 페이지 `/html-components`(목록/편집, 원본 HTML textarea+미리보기, 분류 HEADER/FOOTER/CTA/CONTENT/ETC) + TopBar "요소" 내비 + `HtmlComponentPicker`(랜딩·폼 HTML 블록 편집기 "저장된 요소 불러오기" 셀렉트 → 복사 삽입=스냅샷, 기존 내용 뒤에 이어붙임).
>     - 결정(사용자 §0): 삽입=복사 스냅샷 / 위치=랜딩+폼 둘 다 / 편집=원본 HTML textarea. 고정·플로팅은 요소 HTML의 style position.
>     - **검증(Neon)**: V14 적용 / 생성201·목록(summary·html제외)·상세(html)·수정200·검증400(이름공백)·K5 404·삭제204→조회404 / 백엔드 test·build + 프론트 tsc·prod빌드 통과.
>     - **남음**: `feature/html-components` → `main` 병합 / 브라우저 시각 확인(선택) / M8 2단계(동적 요소).
>   - **Neon 테스트 데이터**: 스모크로 쌓인 테스트 계정·폼·리드·차단·요소는 사용자 지시로 **일단 유지**(공유DB, 나중 정리).
>
> **✅ 이번 세션(2026-07-24~25) 완료 — 전부 브랜치 `feature/d3-subdomain`(미병합)**:
>   - **D3 서브도메인**: 가입 시 랜덤 부여·변경(예약어/중복 검증)·공개 해석(`/api/public/sites/{sub}/{id|slug}`)·소유자 미리보기(`/p/{slug}`). 결정: 루트=404 / 식별자=번호+슬러그 / DB=Neon 공유. 검증 완료.
>   - **폼 입력 유효성**(이메일/전화/숫자, 프론트+백엔드) — 연락처 문자 통과 버그 수정
>   - **랜딩 slug 직접 지정**(형식·중복 검증)
>   - **'폼'→'리드폼' 전면 리네임** · 로그인/회원가입 확대 · **전체 폭 확대**(`--maxw` 1680, 인증카드 720)
>   - **리드 관리 E4**: 검색·상태필터·휴지통(soft delete)·복원·영구삭제 (Flyway V11)
>   - **엑셀/CSV 양식 다운로드 + 일괄 가져오기**(Apache POI, 행별 필수·형식 검증)
>   - **광고 픽셀 I1**: 리드폼/랜딩별 구글·메타·틱톡·카카오·당근, PageView+Lead 발사 (Flyway V12)
>   - 대시보드 서브도메인 입력 30자 제한 + URL 예시 정리
- **플랜에 추가된 항목(지금 X, 나중에)**:
  - 📱 **모바일 퍼스트(최상위 원칙, CLAUDE.md §0)**: 공개 화면은 99% 모바일 → 모바일 최적화 최우선. 공개 폼은 1차 적용 완료, **랜딩(Phase 3)·기타 공개 화면도 모바일 우선으로 만들 것**.
  - 🌐 **사용자별 서브도메인(D3)**: `bali.lead-pot.com` + `.../landing/{landingId}`. 와일드카드 DNS/SSL + 서브도메인 라우팅. (D2 커스텀도메인과 연계, 배포·도메인 준비 후)
  - 🔌 **구글시트 자동연동 + 텔레그램/카톡 알림**(선택형 on/off): 리드 저장 훅 자리 마련됨(`LeadService.submit` TODO). 텔레그램·구글시트 무료, 카톡 알림톡은 사업자+유료. M5 본인인증은 SMS OTP 수준(장난번호 거르기).
  - 🧩 **재사용 HTML 요소 라이브러리(M8, 요소 생성기)**: 플로팅/고정 헤더·푸터·CTA·신청현황 등을 미리 만들어 저장 → 랜딩·폼 HTML 블록에 꺼내 삽입. `html_components` 엔티티 + 관리 페이지(동의문서 패턴). 정적 요소 먼저, 동적(신청현황=실시간 리드 수 등)은 2단계. 상세는 BACKLOG M8.
  - 📣 **Meta 광고 기능(보류, 2026-07-28 리서치·판단 완료)** — 상세 [META-ADS-PLAN.md](META-ADS-PLAN.md): ① 경쟁사 광고 분석 = **공식 광고라이브러리 API로는 한국 상업광고 조회 불가**(EU/정치만) → 보류(유료 제3자 데이터 도입 시에만 가능). ② 광고 관리+자동 on/off = **마케팅 API·네이티브 자동룰로 기술적 가능**하나 앱심사·비즈니스 인증·Full 접근등급 승인(2~6주)이 관문 → 일단 패스. 재개 시 멀티포털(광고주 포털)과 연계 검토.
- **프로젝트 위치(중요)**: PC마다 다름 — 현재 작업 PC(gooinsung/insung-book)는 **`C:\Users\gooinsung\git\Leadpot`**. 동기화는 **GitHub가 정본**(코드), **DB는 Neon 공유**라 어느 PC에서 켜도 같은 데이터.
  - ⚠️ 새 PC 세팅 시: JDK21 설치 + `npm install` + `C:\Temp` 생성 + 사용자 env `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\Temp` + `backend/application-local.properties`(Neon 접속정보, gitignore됨—별도 공유 필요). 상세는 위 "지금 위치" 참고.
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
