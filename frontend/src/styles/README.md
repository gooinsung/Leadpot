# Leadpot 스타일 구조 (styles/)

> 이 폴더만 보면 "어떤 스타일이 어디 있는지" 알 수 있게 정리한 지도다.
> **플레인 CSS + CSS 변수(디자인 토큰)** 방식이다. Tailwind/CSS-in-JS 를 쓰지 않는다.

## 진입점

`src/main.tsx` 는 `src/index.css` 하나만 import 한다. `index.css` 가 아래 파일들을
**레이어 순서대로 `@import`** 한다. 개별 컴포넌트(.tsx)에서 별도 `.css` 를 import 하지 않는다.

## 레이어 (로드 순서 = 캐스케이드 순서)

아래로 갈수록 나중에 로드되어 **같은 특정도에서 이긴다**. 새 규칙은 "가장 알맞은 레이어"에 넣는다.

| 순서 | 파일 | 역할 | 예시 클래스 |
|---|---|---|---|
| 1 | `tokens.css` | 디자인 토큰(값만, 규칙 없음). 색·간격·타이포·그림자. 라이트/다크. | `--indigo` `--radius` `--shadow` |
| 2 | `base.css` | 리셋 + 요소 기본값 + **공통 프리미티브**(단일 UI). | `.btn` `.card` `.input` `.badge` `.pill` `.wrap` |
| 3 | `components.css` | **여러 화면이 공유하는 복합 컴포넌트**. | `.lead-modal` 테이블 `.seg` 리드 상태색 `.st-*` |
| 4 | `layout.css` | 앱 셸(전역 뼈대). | `.app-shell` `.topbar-*` `.nav-link` `.dash-*` |
| 5 | `features/*.css` | **페이지·기능별** 스타일. 서로 네임스페이스가 겹치지 않는다. | 아래 표 |

### features/

| 파일 | 담당 화면 | 대표 클래스 |
|---|---|---|
| `auth.css` | 로그인·회원가입(마케터·광고주) | `.auth-*` |
| `stats.css` | 통계 대시보드(차트·필터·엔티티 표) | `.stat-*` `.chart-*` |
| `form-builder.css` | 리드폼 빌더(편집기·렌더러·스텝·색상) | `.builder-*` `.step-*` |
| `landing.css` | 랜딩 빌더·공개 랜딩(`/p/:slug`) | `.lp-*` (landing) |
| `public.css` | 공개 폼(`/f/:id`)·동의·완료 — **임베드에서도 사용** | `.public-form-*` |
| `leads.css` | 마케터 리드 목록 | `.lead-list-*` |
| `advertiser.css` | 광고주 관리(A2)·광고주 포털(A3) | `.client-*` `.adv-*` |

## 규칙 (컨벤션)

- **토큰 우선**: 색·간격·그림자는 하드코딩하지 말고 `var(--token)` 을 쓴다. 새 색이 필요하면 먼저 `tokens.css` 에 토큰을 추가한다.
- **레이어 존중**: 공통으로 재사용될 UI → `base`(단일) 또는 `components`(복합). 특정 화면 전용 → 해당 `features/*`. 애매하면 features 에 두고, 두 번째 화면이 쓰기 시작하면 components 로 올린다.
- **네임스페이스**: feature 클래스는 화면을 알 수 있는 접두어를 쓴다(`.client-*`, `.stat-*` …). 전역 오염을 막는다.
- **다크 모드**: 색은 토큰으로만 다룬다. `tokens.css` 가 라이트/다크(+ `data-theme` 수동 지정)를 모두 정의하므로, 컴포넌트는 토큰만 쓰면 자동 대응된다.
- **접근성**: 포커스 링(`:focus-visible`)을 지우지 않는다. `prefers-reduced-motion` 은 `base.css` 에서 전역 처리한다.

## 임베드(공개 폼) 주의

`src/embed/embed.tsx` 는 외부 사이트에 공개 폼을 Shadow DOM 으로 주입한다. Shadow 안에는
`index.css` 가 닿지 않으므로 **이 레이어 파일들을 개별 `?inline` 으로 가져와** 직접 주입한다.
스타일 파일을 추가/이름변경하면 `embed.tsx` 의 import 목록도 함께 갱신할 것.
(`tokens.css` 만 `:root`→`:host` 로 치환해서 넣는다.)
