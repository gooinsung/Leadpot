# Phase 5 인수인계 — Cloudflare 배포 실행 (다른 Claude Code 세션용)

> 이 문서는 **로컬(또는 아웃바운드 네트워크 제한이 없는) Claude Code 세션에게 그대로 시킬 수 있게**
> 쓴 실행 가이드다. 지금 이 작업을 진행 중인 세션(클라우드 원격 실행 환경)은 조직 정책상
> `api.cloudflare.com` 에 아웃바운드 접근이 막혀 있어(화이트리스트 방식 방화벽 — API 토큰 유무와
> 무관하게 요청 자체가 프록시 단계에서 403으로 막힘) 여기서부터는 직접 실행할 수 없다.
>
> 배경·설계 근거는 [`docs/SSR-LANDING-PLAN.md`](SSR-LANDING-PLAN.md) 참고(특히 §5 설계·§6 함정·
> §7 Phase 5·§9 검증 시나리오). 이 문서는 그중 Phase 5 를 **바로 실행 가능한 순서**로 풀어썼다.

---

## 0. 지금까지 된 것 (코드는 이미 준비 끝)

- `renderer/` — Next.js + OpenNext Cloudflare 어댑터로 만든 SSR 렌더러. Worker 이름은
  `renderer/wrangler.jsonc` 의 `leadpot-renderer`.
- `frontend/` — 기존 CSR 관리 앱(Vite). 빌드 출력 `frontend/dist`, SPA 폴백용
  `_redirects` 이미 포함.
- `packages/public-ui/` — 둘이 공유하는 공개 렌더링 컴포넌트(공유 패키지).
- GitHub Actions 워크플로 2개가 이미 `main` 에 있다(`.github/workflows/`):
  - `deploy-renderer.yml` — `renderer/**` 변경 시 `npm run deploy`(OpenNext 빌드 + `wrangler deploy`)
  - `deploy-frontend-cloudflare.yml` — `frontend/**` 변경 시 빌드 후 `cloudflare/pages-action` 으로
    Cloudflare Pages 배포(프로젝트 이름 `leadpot-app`)
  - 둘 다 GitHub 저장소 시크릿 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID` 가 있어야 동작한다.
  - 기존 `deploy-frontend.yml`(Oracle VM 배포)·`deploy-backend.yml`(Railway 는 자동 배포라 무관)은
    그대로 살아있고, 이 두 신규 워크플로와 **나란히** 돈다 — 실제 도메인을 옮기기 전까진 서로 영향 없음.

**⚠️ 이 문서를 실행하는 세션이 준비해야 하는 것**: Cloudflare API 토큰(아래 권한) + Account ID.
사용자가 이미 하나 발급해뒀을 수 있다 — 없으면 새로 만들어 달라고 요청할 것.

| 권한(Permission) | 범위 |
|---|---|
| Account → Workers Scripts → Edit | Account |
| Account → Cloudflare Pages → Edit | Account |
| Account → Account Settings → Read | Account |
| Zone → DNS → Edit | Zone: `lead-pot.com` |
| Zone → Workers Routes → Edit | Zone: `lead-pot.com` |
| Zone → Zone → Read | Zone: `lead-pot.com` |

---

## 1. GitHub 저장소 시크릿 등록 — ✅ 완료(2026-09-07, 웹 UI 로 등록됨)

`CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID` 둘 다 이미 등록돼 있고 정상 동작 확인됨
(아래 2번의 두 워크플로가 이미 성공한 적 있음). **`gh` CLI 는 이 단계에 필요 없다** — 인증이
안 돼 있어도 신경 쓰지 말 것. 혹시 나중에 시크릿을 다시 등록해야 하면 GitHub 저장소 →
Settings → Secrets and variables → Actions 에서 웹으로 하면 된다(`gh secret set` 은 대안일 뿐
필수가 아니다).

## 2. 워크플로 실행 → `*.workers.dev` / `*.pages.dev` 임시 배포 확인 — ✅ 완료(2026-09-07)

`deploy-renderer.yml`·`deploy-frontend-cloudflare.yml` 둘 다 이미 `workflow_dispatch` 로 성공
확인됨. **이 단계도 `gh` CLI 가 필요 없다** — 확인만 하려면 GitHub 저장소 → Actions 탭에서
초록 체크만 보면 된다(웹 UI). 코드가 바뀌면 이제 push 할 때마다 알아서 다시 돈다.

**렌더러 검증(아직 안 했으면)** — Worker 이름이 `leadpot-renderer` 이므로 배포 URL은
`https://leadpot-renderer.<계정의 workers.dev 서브도메인>.workers.dev` 형태다(정확한 서브도메인은
Cloudflare 대시보드 → Workers & Pages → leadpot-renderer 에서 확인).

```bash
# {sub}.lead-pot.com/{id} 형태를 흉내내려면 Host 헤더로 서브도메인을 실어 보낸다.
# 실제 서브도메인·랜딩 id 는 살아있는 사용자 계정 걸로 바꿔서 테스트할 것(운영 DB 의 실제 값).
curl -s -H "Host: <실제서브도메인>.lead-pot.com" \
  "https://leadpot-renderer.<계정서브도메인>.workers.dev/<랜딩식별자>" | head -50
```

확인할 것(SSR-LANDING-PLAN.md §9-A 그대로):
- JS 없이도 본문 텍스트가 그대로 보인다
- `data-lp-live="count"` 같은 실시간 마커에 **실제 숫자**가 이미 박혀 있다(0이 아님)
- `<title>` 이 랜딩 제목으로 나온다

**Pages(관리 앱) 검증(아직 안 했으면)** — `https://leadpot-app.pages.dev` 로 접속해 로그인·대시보드가
정상 뜨는지 확인. (`VITE_API_BASE_URL=https://api.lead-pot.com` 로 빌드되므로 실제 운영 백엔드에
붙는다 — 로그인하면 실제 데이터가 보인다. 읽기만 하고 되도록 실제 데이터를 건드리는 조작은 하지 말 것.)

둘 다 문제없으면 3번으로. 문제가 있으면 GitHub 저장소 Actions 탭에서 실패한 런을 열어 로그를
확인(이 시점까지는 실제 도메인을 안 건드렸으므로 실패해도 서비스에 영향 없다 — 편하게 반복 시도 가능).

## 3. 기존 DNS 레코드 확인 — ✅ 완료(2026-09-07)

확인된 현재 레코드(아무것도 건드리지 않았음):

| 이름 | 타입 | 값 | 비고 |
|---|---|---|---|
| `app.lead-pot.com` | A | `129.225.198.2` (Oracle VM) | proxied |
| `*.lead-pot.com` | A | `129.225.198.2` (Oracle VM) | proxied — **이미 존재함, D3 서브도메인 작업 때 만든 것으로 추정** |
| `api.lead-pot.com` | CNAME | `09g4ey7v.up.railway.app` | Railway — **절대 건드리지 말 것** |
| `_railway-verify.api.lead-pot.com` | TXT | (Railway 도메인 검증용) | **절대 건드리지 말 것** |

**`api`·`_railway-verify` 는 이번 작업과 무관 — 그대로 둔다.** `app`·와일드카드(`*`)만 4·5번에서 바뀐다.

## 4. Workers 라우트 연결 — ✅ 완료(2026-09-07 15:52 UTC, 4-1 의 해결책 1번으로 최종 성공)

> 최종 결과만 보려면 이 헤딩만 읽어도 된다: `renderer/src/proxy.ts` 에 `proxyToAdminApp()` 을
> 구현(커밋 `bfdaed2`)한 뒤 와일드카드 라우트(`*.lead-pot.com/*` → `leadpot-renderer`)를 다시 걸었고,
> `app.lead-pot.com`(ETag 비교로 실제 Pages 콘텐츠 확인)·실사용 랜딩 `the-law.lead-pot.com/30`
> (JS 없이도 본문까지 SSR) 둘 다 정상 확인했다. 아래 4-1 은 **처음 시도 때 겪은 실제 장애 기록**이고
> 앞으로 이 라우트를 다시 만지거나 다른 서비스에 같은 패턴을 적용할 때 참고용으로 남겨둔다.

### 4-1. 🚨 실제로 겪은 장애 — 이 라우트를 그냥 걸면 `app.lead-pot.com` 이 즉시 깨진다 (2026-09-07 실측)

### 4-1. 🚨 실제로 겪은 장애 — 이 라우트를 그냥 걸면 `app.lead-pot.com` 이 즉시 깨진다 (2026-09-07 실측)

`*.lead-pot.com/*` 와일드카드는 **서브도메인을 가리지 않고 모든 `*.lead-pot.com` 프록시 트래픽을
가로챈다.** `app.lead-pot.com` 도 `*.lead-pot.com` 패턴에 매치되고, 3번에서 확인했듯 이미 proxied
A 레코드다 → 이 라우트를 걸면 `app.lead-pot.com` 요청도 전부 `leadpot-renderer` Worker 로 간다.
렌더러의 `proxy.ts` 는 예약 호스트(`app`·`api`·`www`)를 감지하면 **그냥 통과시키기만** 하는데
(`NextResponse.next()`), 이 렌더러 앱엔 관리자 앱 콘텐츠가 없으니 실제로는 Next 기본 placeholder
(`<title>Leadpot</title>`, 빈 페이지)가 뜬다 — **로그인 화면 대신 빈 페이지가 뜨는 실제 장애**다.
(실측: 라우트 생성 직후 `curl https://app.lead-pot.com/` → VM 의 실제 React 앱이 아니라 렌더러
placeholder 응답 확인. 라우트 삭제로 즉시 복구됨.)

**추가로**: 이 라우트가 존재하는 동안은 5번(`app.lead-pot.com` 을 Pages 커스텀 도메인으로 연결)도
`POST .../pages/projects/leadpot-app/domains` 가 `"You have already added this custom domain"`
(code 8000018) 로 **실패한다** — Cloudflare 가 같은 호스트에 Workers 라우트와 Pages 커스텀 도메인이
동시에 걸리는 걸 막기 때문. 즉 **4번과 5번은 지금 코드 상태로는 순서 문제가 아니라 구조적으로
동시에 성립할 수 없다.**

**해결책 (아직 미구현 — 이 문서를 이어받는 세션이 사용자와 상의해서 고를 것, CLAUDE.md §0)**:
1. **(권장)** 렌더러의 `proxy.ts` 를 고쳐서 예약 호스트 `app`(`www` 도 최종적으로는 같은 목적지)을
   그냥 통과시키지 말고, **Worker 안에서 실제 Pages 배포 콘텐츠를 fetch 해서 그대로 반환**하도록
   만든다(서버사이드 리버스 프록시). 이러면 Worker 하나가 `*.lead-pot.com` 전체의 진입점이 되고,
   Pages 커스텀 도메인은 아예 안 걸어도 된다(Worker → Pages 프로젝트로 내부 fetch만 하면 됨).
   코드 수정 + 배포 + 검증이 필요하니 실제 도메인을 다시 건드리기 전에 **로컬/workers.dev 에서
   충분히 검증**할 것.
2. 아니면 프론트 이전(VM→Cloudflare) 자체를 이번 범위에서 빼고, 이번엔 렌더러(서브도메인 랜딩)만
   연결한다 — `app.lead-pot.com` 은 계속 VM에 남겨둔다. 이러면 5번은 무기한 보류.

**어느 쪽이든 라우트를 다시 걸기 전에 반드시 사용자에게 계획을 먼저 확인할 것** — 이미 한 번
실제 장애를 낸 적이 있는 지점이다.

### 4-2. 준비되면(위 문제 해결 후) 라우트 생성

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"pattern":"*.lead-pot.com/*","script":"leadpot-renderer"}'
```

생성 직후 **가장 먼저 `curl -s -o /dev/null -w "%{http_code}" https://app.lead-pot.com/` 로
관리자 앱이 살아있는지부터 확인**(200 이면서 실제 React 앱 HTML인지 `<title>` 등으로 확인 — 렌더러
placeholder 의 `<title>Leadpot</title>` 과 실제 앱의 `<title>Leadpot · 리드팟</title>` 이 다르다).
그 다음 실제 사용자 서브도메인으로 `https://{sub}.lead-pot.com/{id}` 도 확인.
**문제가 생기면 이 라우트만 삭제(`DELETE /zones/$ZONE_ID/workers/routes/{route_id}`)하면 즉시
이전 상태로 복구된다** — VM 은 이 시점까지 그대로 켜져 있으므로 위험 부담이 적다.

## 5. `app.lead-pot.com` → Cloudflare Pages 커스텀 도메인 — ✅ 완료(2026-09-07)

> ⚠️ 4-1 의 해결책 1번(렌더러가 Pages 를 내부 fetch 로 프록시)을 골랐다면 **이 단계 자체가
> 필요 없어진다** — Worker 하나가 이미 app 트래픽까지 처리하기 때문. 해결책 2번(프론트 이전
> 보류)을 골랐다면 이 단계는 통째로 스킵.

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/leadpot-app/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"name":"app.lead-pot.com"}'
```

⚠️ **실제로 겪은 함정**: 이 POST 가 `"You have already added this custom domain"`(code 8000018)로
실패할 수 있다 — 4번의 와일드카드 라우트 때문이 아니라(라우트가 없어도 재현됨), **예전에 다른
이름의 Pages 프로젝트(우리 경우 `leadpot`, 최종 이름은 `leadpot-app`)에 같은 도메인이 이미
바인딩된 잔여 등록**이 원인이었다. 확인·정리 방법:
```bash
# 계정의 모든 Pages 프로젝트와 각 프로젝트의 domains 를 확인해 어디 걸려있는지 찾는다
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result[] | {name, domains}'
# 찾은 프로젝트에서 삭제(DNS 레코드가 아니라 Pages 커스텀 도메인 "바인딩"만 지움 — /dns_records/ 아님)
curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/{그_프로젝트}/domains/app.lead-pot.com" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```
지운 뒤 곧바로 `curl -s -o /dev/null -w '%{http_code}' https://app.lead-pot.com/` 로 기존 서비스가
안 깨졌는지 확인(이 삭제는 DNS 레코드를 안 건드리므로 원래 안전해야 한다), 그다음 POST 재시도.

**두 번째 함정**: POST 가 성공(`status: initializing`)해도 곧장 안 넘어간다 — 도메인 검증이
`"error_message": "CNAME record not set"` 로 멈춘다. 문서·Cloudflare 안내와 달리 **DNS 레코드를
자동으로 안 바꿔준다** — 기존 A 레코드(VM IP)를 **직접 CNAME 으로 바꿔야** 한다:
```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/{app_레코드_id}" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"app.lead-pot.com","content":"leadpot-app.pages.dev","proxied":true}'
```
바꾼 뒤 도메인 상태가 `pending`→(verification `active`)→(validation `active`, SSL 인증서 발급)까지
가는 데 실측 **약 1~2분** 걸렸다. `status: active` 확인 후 `curl https://app.lead-pot.com/` 로
Pages 콘텐츠가 나오는지 확인(같은 자산을 VM 도 서빙하고 있어서 `<title>`·파일명만으로는 구분 안 될
수 있다 — **ETag 비교**가 확실하다: `curl -sI https://app.lead-pot.com/assets/{파일}.js` 와
`curl -sI https://leadpot-app.pages.dev/assets/{같은파일}.js` 의 `ETag` 헤더가 같으면 진짜 Pages 가
서빙 중인 것). 문제가 생기면 `app` DNS 레코드를 원래 A(VM IP) 로 되돌리면 복구된다
(3번에서 확인해둔 원래 값: `A 129.225.198.2`).

## 6. 마무리 확인 (SSR-LANDING-PLAN.md §9 전체)

- [ ] `api`·`www` 등 나머지 레코드가 안 바뀌었는지 다시 확인(3번과 동일 명령으로 diff)
- [ ] §9-A 크롤러 관점 체크리스트 전부
- [ ] §9-B 기존 기능(리드 제출·스텝폼·계산기·동의문서·오버레이·픽셀·**IP 차단**·방문통계) 회귀 확인
- [ ] §9-C `/f/{id}`·임베드(`embed.js`) 정상
- [ ] 2~3일 관찰 — 리드 유실 없는지, 통계 정상인지

## 7. 안정화 후 정리

- Oracle VM 종료
- `.github/workflows/deploy-frontend.yml`(VM 배포) 삭제
- `docs/HOSTING-MIGRATION-PLAN.md` 를 "완료"로 갱신
- `docs/SSR-LANDING-PLAN.md` §7 Phase 5·Phase 7 체크리스트 갱신, `docs/PROGRESS.md` 갱신
- 이 문서(`docs/PHASE5-CLOUDFLARE-HANDOFF.md`)는 다 끝나면 지워도 된다(일회성 실행 가이드)

---

## 막히면

- Cloudflare API 에러 메시지를 그대로 들고 `docs/SSR-LANDING-PLAN.md` §6(함정)·§8(사용자 작업 표)을
  다시 확인.
- 애매하거나 되돌리기 어려운 판단(특히 4·5번의 실제 도메인 전환)은 **사용자에게 먼저 확인** —
  CLAUDE.md §0 최상위 지침.
