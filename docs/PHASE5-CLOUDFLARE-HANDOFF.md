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

## 1. GitHub 저장소 시크릿 등록 (아직 안 됐으면)

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo gooinsung/Leadpot --body "<토큰>"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo gooinsung/Leadpot --body "<계정ID>"
```

`gh` 가 없거나 인증이 안 돼 있으면 GitHub 저장소 → Settings → Secrets and variables → Actions 에서
같은 이름으로 수동 등록해도 된다.

## 2. 워크플로 실행 → `*.workers.dev` / `*.pages.dev` 임시 배포 확인

시크릿을 등록한 뒤 수동으로 한 번 실행(코드 변경 없이 바로 검증하려면 `workflow_dispatch` 사용):

```bash
gh workflow run deploy-renderer.yml --repo gooinsung/Leadpot
gh workflow run deploy-frontend-cloudflare.yml --repo gooinsung/Leadpot
gh run watch --repo gooinsung/Leadpot   # 둘 다 성공(✓)할 때까지
```

**렌더러 검증** — Worker 이름이 `leadpot-renderer` 이므로 배포 URL은
`https://leadpot-renderer.<계정의 workers.dev 서브도메인>.workers.dev` 형태다(정확한 서브도메인은
`wrangler deploy` 출력이나 Cloudflare 대시보드 → Workers & Pages → leadpot-renderer 에서 확인).

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

**Pages(관리 앱) 검증** — `https://leadpot-app.pages.dev` 로 접속해 로그인·대시보드가 정상 뜨는지 확인.
(`VITE_API_BASE_URL=https://api.lead-pot.com` 로 빌드되므로 실제 운영 백엔드에 붙는다 — 로그인하면
실제 데이터가 보인다. 읽기만 하고 되도록 실제 데이터를 건드리는 조작은 하지 말 것.)

둘 다 문제없으면 3번으로. 문제가 있으면 `gh run view --log-failed` 로 로그를 보고 원인부터 고칠 것
(이 시점까지는 실제 도메인을 안 건드렸으므로 실패해도 서비스에 영향 없다 — 편하게 반복 시도 가능).

## 3. 기존 DNS 레코드 확인 (건드리면 안 되는 것부터 확인)

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=lead-pot.com" | jq '.result[0].id'
# 위에서 나온 zone id 를 ZONE_ID 라 하면:
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" | jq '.result[] | {name,type,content,proxied}'
```

**`api.lead-pot.com`(Railway 백엔드)·`www` 등 기존 레코드는 그대로 두고 절대 지우거나 바꾸지 말 것.**
이번 작업은 `app`·와일드카드(`*`)만 새로 추가/변경한다.

## 4. 와일드카드 DNS + Workers 라우트 (⭐ 되돌리기 지점 1)

와일드카드 `*.lead-pot.com` 을 프록시(주황 구름) DNS 레코드로 추가하고, 그 위에 Workers 라우트를
`leadpot-renderer` 로 건다(더미 IP 로 A 레코드를 만들어도 된다 — Workers Route 가 실제 라우팅을
가로채므로 레코드 내용 자체는 의미가 크지 않다. 이미 `*` 레코드가 있으면 이 단계는 건너뛴다).

```bash
# 1) 와일드카드 DNS 레코드 (없으면 생성)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"*","content":"192.0.2.1","proxied":true,"comment":"Leadpot SSR 렌더러(Workers Route 가 실제 라우팅) — SSR-LANDING-PLAN.md Phase 5"}'

# 2) Workers 라우트 연결
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"pattern":"*.lead-pot.com/*","script":"leadpot-renderer"}'
```

배포 후 실제 사용자 서브도메인으로 `https://{sub}.lead-pot.com/{id}` 를 브라우저로 열어 확인.
**문제가 생기면 이 라우트만 삭제(`DELETE /zones/$ZONE_ID/workers/routes/{route_id}`)하면 즉시
이전 상태로 복구된다** — VM 은 이 시점까지 그대로 켜져 있으므로 위험 부담이 적다.

## 5. `app.lead-pot.com` → Cloudflare Pages 커스텀 도메인 (⭐ 되돌리기 지점 2)

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/leadpot-app/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"name":"app.lead-pot.com"}'
```

Cloudflare 가 필요한 DNS 레코드(CNAME)를 자동으로 만들거나 안내한다. 기존 `app` 레코드가 VM 을
가리키고 있었다면 이 단계에서 Pages 쪽으로 바뀐다 — **여기가 실제 트래픽이 VM 에서 Cloudflare 로
넘어가는 순간**이니 브라우저로 로그인·대시보드·랜딩 빌더가 다 정상인지 바로 확인할 것.
문제가 생기면 `app` DNS 레코드를 원래 VM IP 로 되돌리면 복구된다(3번에서 확인해둔 원래 값 참고).

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
