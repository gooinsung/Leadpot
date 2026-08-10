# docs/HOSTING-MIGRATION-PLAN.md — 호스팅 이전 계획 (Oracle VM → Railway + Cloudflare Pages)

> **작성 2026-08-07 (gooin PC). 상태: 🔄 진행 중 — Phase A(백엔드 → Railway) 컷오버 완료 2026-08-09(`611d3eb`).**
> **남은 것: A5~C (프론트 → Cloudflare Pages, VM 종료).** 아래 본문의 Phase A 절차는 이미 끝난 내용이다.
> 기준 커밋 `61adf17` · **Flyway V28** · 백엔드 테스트 212개 통과.
> 이어받는 세션은 이 문서 하나만 읽으면 처음부터 끝까지 실행할 수 있다.
> 관련: [CLAUDE.md](../CLAUDE.md) §6(배포법) · [DEPLOY.md](DEPLOY.md) 부록 C · [PROGRESS.md](PROGRESS.md)

---

## 0. 왜 옮기는가

### P1. 응답시간의 **74%가 Neon 싱가포르 왕복**이다 ⭐ 유일한 진짜 병목

2026-08-05 실측(PROGRESS.md "예열 효과 실측" 절):

| 호출 | 값 |
|---|---|
| `/api/health` (**DB 안 탐**) | 115~150ms |
| `/api/public/landings/11/live` (웜, **DB 탐**) | **541ms** |
| 같은 경로 첫 호출(콜드) | 1,992ms |

**541 − 115 = 426ms 가 순수 DB 왕복이다.** PROGRESS.md 의 결론을 그대로 옮기면:

> "응답시간의 약 74%가 Neon 싱가포르 왕복이다. **앱 최적화로는 안 줄어든다. DB 이전이 유일한 해법임이 수치로 확인됐다.**"

이미 시도해서 **안 통한 것들**: HikariCP 커넥션 풀 튜닝(`d19e908`) → 재수립 비용만 없앴고 왕복은 그대로.
예열(`86e3f84`) → 6.8초를 2.0초로 줄였지만 **목표 1초 미달**. 남은 2.0초의 대부분도 DB 왕복이다.

### P2. 배포 다운타임 **약 2분**

> ⚠️ **정정**: "배포 10~17분" 문제는 **이미 해결됐다**(`f1a7683`, 2026-08-05 — jar 을 GitHub Actions 러너에서 빌드).
> 지금 남은 건 **다운타임뿐**이다: 2026-08-05 **1분 52초**, 2026-08-06 **1분 55초** 실측.

컨테이너를 내리고 새로 띄우는 구조라 그 사이 서비스가 죽는다. **공개 리드폼이 2분간 죽는다**는 뜻이고,
광고를 돌리는 중이라면 그대로 리드 손실이다. Railway 는 **새 인스턴스가 헬스체크를 통과한 뒤 트래픽을 넘기는 롤링 배포**라 이게 0 이 된다.

### P3. 시크릿을 바꾸려면 **SSH 접속 → 파일 직접 편집 → 재기동** 해야 한다

VM `~/Leadpot/.env` 는 자동 배포 대상이 아니다. 값 하나를 바꾸려면 SSH 로 들어가 `vi` 로 고치고
컨테이너를 재기동해야 하고, 그동안 **서비스가 끊긴다**(P2 와 같은 이유). 손이 많이 가고 실수하기 쉽다.

> ✅ **SSH 개인키는 보유 중이다** (2026-08-07 사용자 확인). **블로커가 아니라 불편함**이다.
> 키는 **구글드라이브**에 있다 (PROGRESS.md 2026-07-27 최종구성 절):
> ```bash
> ssh -i "G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key" ubuntu@129.225.198.2
> ```
> ⚠️ 작업 PC 에 **G: 드라이브가 마운트돼 있어야** 한다. `~/.ssh` 에는 없다(`known_hosts` 만).
> 키 파일 권한 때문에 막히면 로컬로 복사한 뒤 권한을 좁혀서 쓴다.

Railway 로 옮기면 시크릿이 **웹 UI** 로 오고, 값 변경이 **롤링 재배포**라 다운타임도 없다.
덤으로 PROGRESS.md 에 걸려 있던 **"Neon 비밀번호 평문 노출 → 재발급"** 도 이전과 함께 정리된다 → §4-3

### 목표

| 지표 | 현재 | 목표 |
|---|---|---|
| 웜 응답(DB 탐) | 541ms | **약 200ms** |
| 배포 다운타임 | 1분 52초 | **0** |
| 시크릿 변경 | SSH → 파일 편집 → 재기동(다운타임) | **웹 UI + 롤링 재배포** |
| 비용 | 0원 | **월 2만원 안팎** (사용자 감수 확정, 2026-08-07) |

> ℹ️ **`/api/health` 는 오히려 115ms → 약 160ms 로 조금 느려진다.** 한국에서 싱가포르가 더 멀기 때문이고 **정상이다.**
> 놓치면 안 되는 건 DB 를 타는 실사용 경로가 541ms → 200ms 로 줄어든다는 것이다.

---

## 1. 확정된 목표 구성

```
[방문자 / 사용자]
   │
   ▼
Cloudflare DNS (무료 SSL)
   ├─ app.lead-pot.com  ──▶ Cloudflare Pages (프론트 정적)          $0
   └─ api.lead-pot.com  ──▶ Railway (싱가포르) Spring Boot          ~$12~17/월
                                │  같은 리전 = 쿼리 왕복 소멸
                                ▼
                             Neon Postgres (ap-southeast-1)          $0

        이미지 업로드 ──▶ Cloudflare R2                              ~$0

⛔ Oracle Cloud VM — 이전 완료 후 종료 (Nginx·Docker·certbot·SSH 부담 소멸)
```

| 항목 | 월 비용 |
|---|---|
| Railway (1GB RAM + 실사용 CPU) | **$12~17 ≈ 17,000~24,000원** |
| Cloudflare Pages | 0원 (무료 플랜 **상업적 사용 허용**) |
| Neon | 0원 |
| Cloudflare R2 | 0원 (10GB 무료) |
| Oracle VM | 0원 → **종료** |
| **합계** | **월 2만원 안팎** |

> Railway 는 **실사용량 과금**이다. RAM $10/GB·월 + CPU $20/vCPU·월인데 **CPU 는 실제 쓴 만큼만** 낸다.
> Spring 앱은 평소 CPU 를 거의 안 쓰므로 RAM 값이 대부분이다. **Usage Limit 을 반드시 걸어라**(Step A1).

---

## 2. 검토 후 탈락한 후보

| 후보 | 월 비용 | 왜 탈락했나 |
|---|---|---|
| **Vercel** | $20 (Pro) | **Spring Boot 가 아예 안 올라간다** — JVM 런타임 없음, 컨테이너 불가. 프론트만 옮기면 P1·P2·P3 가 하나도 안 풀린다. **Hobby(무료)는 상업적 사용 금지** |
| **Fly.io** | $6~8 | Docker 그대로 되고 싱가포르(`sin`)·도쿄(`nrt`) 다 있다. **차선책으로 유효**(§8). Railway 보다 손이 더 간다 |
| **Render** | $25~ | Starter($7)는 512MB 라 JVM 에 부족 → 사실상 Standard $25. 같은 돈이면 Railway 가 낫다 |
| **Hetzner** | €6~9 | 성능/가격 최강이지만 **순수 VPS** — Docker·Nginx·certbot·SSH 를 계속 직접 관리. **P3 가 그대로 남는다** |
| **오라클 VM 유지** | 0원 | **P1 이 안 풀린다.** 이미 풀 튜닝·예열로 두 번 시도해서 안 됐다 |

---

## 3. ⚠️ 리전 결정 — 반드시 읽을 것

**Neon 은 서울·도쿄 리전이 없다** (2026-08-07 확인: US 3, EU 2, 싱가포르, 시드니, 상파울루). **유료도 동일**하고
**기존 프로젝트의 리전은 변경 불가**(새 프로젝트에 덤프/복원해야 함).

| | **A안 (채택)** | B안 |
|---|---|---|
| 구성 | **앱을 싱가포르로** (Neon 유지) | DB 를 서울로 (Neon 버림, 예: Supabase) |
| DB 왕복 426ms | **→ 0** | **→ 0** |
| 한국 사용자 왕복 | +40~60ms (요청당 1회) | +0ms |
| 작업량 | **DB 손 안 댐. 리스크 0** | DB 이전 + 벤더 교체 + 검증 |
| 되돌리기 | DNS 되돌리면 끝 | 어려움 |

**A안인 이유**: 요청 하나가 쿼리를 여러 번 돈다. A안은 **426ms 를 없애고 50ms 를 한 번 더 낸다.** 순이득이 압도적이고, **DB 를 건드리지 않으니 데이터 리스크가 0** 이다.

> 📌 **PROGRESS.md "사용자가 직접 처리하기로 한 것 — DB 서울 이전" 항목을 이 계획이 대체한다.**
> 나중에 한국 사용자 체감 50ms 까지 깎고 싶으면 그때 B안을 별건으로 본다 (**DB 9.6MB** 라 언제 해도 가볍다).
>
> 📌 **VM 리전이 서울인지 오사카인지 기록이 상충하는 건(PROGRESS.md) 이 결정에 영향 없다.**
> 핵심은 "서울이냐"가 아니라 **앱과 DB 를 같은 곳에 두는 것**이다.

---

## 4. 사전 준비

### 4-1. 🔴 R2 가 실제로 켜져 있는지 확인

Railway 는 **재배포 때 컨테이너 디스크가 날아간다.** 업로드가 로컬 디스크면 이전 즉시 이미지가 전부 깨진다.

코드는 준비돼 있다([R2FileStorage.java](../backend/src/main/java/com/leadpot/common/upload/R2FileStorage.java), `app.storage.type=r2` 로 스위치).
PROGRESS.md 에 **"이미지 업로드 R2 연동 ✅"** 로 적혀 있어 이미 켜져 있을 가능성이 높지만, `.env` 가 git 에 없으니 확인해야 한다.

```bash
ssh -i "G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key" ubuntu@129.225.198.2 "grep APP_STORAGE ~/Leadpot/.env"
```

| 결과 | 판정 | 해야 할 일 |
|---|---|---|
| `APP_STORAGE_TYPE=r2` | ✅ **r2** | 없음. R2 값 5개를 Railway 로 그대로 |
| 없음 또는 `local` | ❌ **local** | **이전 전에 R2 전환 선행** |

> 💡 **SSH 없이도 판정 가능** — 이미지가 들어간 공개 랜딩을 열고 이미지 URL 을 본다.
> R2 공개 도메인(`...r2.dev/...` 또는 전용 도메인)이면 r2, `https://api.lead-pot.com/uploads/...` 면 local.

`local` 이면: R2 버킷 생성 → 환경변수 주입 → 재배포 → **기존 업로드 파일을 도커 볼륨에서 R2 로 복사**
(파일명이 UUID 라 덮어쓰기 충돌 없음).

### 4-2. 시크릿 조달 — **VM `.env` 를 통째로 가져온다**

✅ **SSH 개인키를 사용자가 보유 중이므로**(§P3) 현재 운영값을 그대로 옮길 수 있다. **이게 가장 안전한 경로다.**

```bash
ssh -i "G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key" ubuntu@129.225.198.2 "cat ~/Leadpot/.env"
```

- → **안전한 곳(비밀번호 관리자 등)에 보관.** git 에 절대 커밋 금지. 이 값들이 §6 표의 Railway 환경변수가 된다.
- ⚠️ 출력에 시크릿이 그대로 찍힌다. **채팅·이슈·로그에 붙여넣지 말 것** (Neon 비번이 평문 노출된 전례가 있다 → §4-3).

> #### ✅ `APP_JWT_SECRET` 을 그대로 옮기면 로그인 세션이 유지된다
> 이 값만은 어느 콘솔에서도 얻을 수 없는 **VM 에만 있는 값**이다. 그대로 옮기면 마케터·광고주 모두 **재로그인 불필요**.
>
> **만약 값을 못 가져오는 상황이 되면**: 32바이트 이상 랜덤으로 새로 만든다 → **전원 로그아웃**(비밀번호는 안 바뀌고
> 재로그인만 하면 된다). 공개 회원가입이 닫혀 있어 계정 수가 적으니 감당은 되지만 **광고주에게 사전 공지 필요.**
> SSH 가 있는 지금은 **이 경로로 갈 이유가 없다.**

> 💡 나머지 값(Neon·R2·Solapi)은 각 서비스 콘솔에서 **재발급도 가능**하다. 이전을 계기로 키를 새로 돌리고 싶다면 그렇게 해도 된다.

### 4-3. Neon 비밀번호 재발급 — **이전이 끝난 뒤에** 한다

PROGRESS.md 의 미해결 보안 과제(**"Neon 비밀번호가 대화에 평문 노출됐다. 재발급 필요"**)를 이번에 함께 정리한다.

> ⚠️ **Neon 은 롤 단위로 비번을 바꾼다 → 재발급 즉시 옛 비번이 무효**다.
> 이전 도중에 돌리면 **VM 백엔드가 그 자리에서 죽어 롤백 경로가 사라진다.**

**권장 순서 — 이전 자체는 기존 비번으로 진행한다:**

1. Step A1~A5 를 **기존 비번 그대로** 진행 (VM 은 롤백용으로 계속 살아 있음)
2. Step A5 관찰 완료 → VM 백엔드 중지
3. **그때 Neon 콘솔에서 재발급** → **Railway 환경변수만** 갱신 → 롤링 재배포
4. VM 은 이미 내려가 있으므로 `.env` 를 고칠 필요도 없다

> SSH 가 있으니 급하면 이전 전에 먼저 돌려도 된다(양쪽 `.env`·Railway 를 함께 갱신).
> 다만 **한 번에 한 가지만 바꾸는 게 사고 추적에 유리**하므로 위 순서를 권한다.

### 4-4. Neon 무료 플랜 컴퓨트 사용량 확인

HikariCP `keepalive-time=2분` 이 Neon 을 계속 깨워둔다. 월 컴퓨트 한도를 넘기는지 콘솔에서 확인할 것.
(싱가포르로 옮기면 커넥션 재수립이 싸져서 **keepalive 를 느슨하게 해도 된다** → `APP_DB_KEEPALIVE_MS` 상향 검토)

### 4-5. ⛔ 이전 기간 중 금지 사항

DNS 전환 기간에는 **VM 과 Railway 두 백엔드가 같은 Neon DB 를 동시에 본다.** 따라서:

1. **Flyway 마이그레이션(V29 이상)을 추가하지 말 것.** 현재 **V28**. 두 인스턴스가 다른 스키마를 기대하면 깨진다.
2. **🔴 `@Scheduled` 자동 승인이 이중 실행된다.** [LeadAutoApproveRunner.java:78](../backend/src/main/java/com/leadpot/lead/LeadAutoApproveRunner.java) 이
   **매시 10분(Asia/Seoul)** 에 리드 상태를 실제로 완료 처리한다. 두 인스턴스가 동시에 돌면 **같은 리드에 이력이 두 번 남는다.**
   → **Railway 에는 컷오버 전까지 `APP_LEAD_AUTO_APPROVE_ENABLED=false`** 로 두고, VM 을 내린 뒤에 켠다.
3. **🔴 예열이 운영 DB 에 리드 INSERT(롤백)를 시도한다.** 검증 단계에서는 **`APP_WARMUP_ENABLED=false`** 로 시작해
   기능 검증을 마친 뒤 켠다. (PROGRESS.md 의 "로컬을 운영 DB 에 붙일 때 반드시 끌 것" 경고와 같은 이유)

---

## 5. 실행 단계

> **원칙: 되돌릴 수 있는 순서로 쪼갠다.** Phase A(백엔드)가 안정된 걸 확인한 뒤 Phase B(프론트)로 간다.
> VM 은 **전부 끝나고 며칠 지켜본 뒤에** 끈다.

### Phase A — 백엔드를 Railway 로 (핵심. 여기까지만 해도 P1·P2·P3 가 전부 풀린다)

#### Step A1. Railway 프로젝트 생성
- [ ] Railway 가입 → **Hobby 플랜**($5/월, 크레딧 $5 포함) — 계정·결제는 **사용자가 직접**
- [ ] New Project → Deploy from GitHub repo → `gooinsung/Leadpot`
- [ ] Settings → **Root Directory = `backend`**
- [ ] Settings → **Region = `Southeast Asia (Singapore)`** ⭐ **이게 P1 해결의 전부다. 틀리면 이전할 이유가 없다**
- [ ] Settings → **Watch Paths = `backend/**`** (프론트 커밋에 재배포 안 되게)
- [ ] Settings → Networking → **Target Port = `8080`** (우리 앱은 `server.port=8080` 고정)
- [ ] ⚠️ **Usage Limit = $25 하드 리밋** — 트래픽 폭주 시 요금 폭탄 방지
- [ ] ❓ **Dockerfile 확인 필요** — 러너 빌드 이전(`f1a7683`) 후 `backend/Dockerfile`(소스 빌드)과
      `backend/Dockerfile.runtime`(jar 만 COPY) **두 개가 있다.** Railway 는 **소스에서 빌드**하므로
      **`Dockerfile`(멀티스테이지) 쪽을 써야 한다.** Railway 가 어느 걸 잡는지 확인하고, 필요하면 빌드 설정에서 지정할 것

#### Step A2. 환경변수 주입 (§6)
- [ ] §6 필수 표를 전부 입력
- [ ] **검증 단계 한정 안전장치** — §4-5 대로:
      `APP_LEAD_AUTO_APPROVE_ENABLED=false` · `APP_WARMUP_ENABLED=false`
- [ ] `JAVA_TOOL_OPTIONS` 는 **넣지 않는다** (`-Xmx512m` 은 1GB 오라클용 제약이었다)

#### Step A3. 첫 배포 + 스모크 (임시 도메인. **DNS 는 아직 안 건드린다**)
- [ ] 빌드 성공 확인 (러너 빌드라 몇 분)
- [ ] 로그에 `leadpot-pool` 확인 (HikariCP 설정 반영)
- [ ] `curl https://xxx.up.railway.app/api/health` → `UP` (= **Flyway V28 정상 적용**. 실패하면 기동 자체가 안 된다)
- [ ] **📏 성적표 — 이 숫자가 이번 이전의 전부다:**
  ```bash
  curl -o /dev/null -s -w "%{time_total}\n" https://xxx.up.railway.app/api/public/landings/11/live
  ```
  | 항목 | 현재(VM) | **목표(Railway 싱가포르)** |
  |---|---|---|
  | 웜, DB 탐 | 541ms | **200ms 이하** |
  | `/api/health` (DB 안 탐) | 115~150ms | 160ms 내외 (**조금 느려지는 게 정상**) |
  | 콜드 첫 호출 | 1,992ms | 재측정 후 판단 |
  - ❗ **목표 미달이면 DNS 전환하지 말고 멈춘다.** 리전 설정을 먼저 의심할 것
- [ ] 로그인 → 리드 목록 → **공개 폼 제출** → 이미지 업로드(R2 URL 로 저장되는지) → 문자 발송
  - ⚠️ 임시 도메인은 CORS 목록에 없다. `APP_CORS_ALLOWED_ORIGINS` 에 임시 추가하거나 curl 로 검증

#### Step A4. `api.lead-pot.com` 전환
- [ ] Cloudflare DNS 에서 `api` 레코드 **TTL 을 60초로** 미리 낮춘다 (롤백 속도)
- [ ] Railway → Custom Domain `api.lead-pot.com` → CNAME 값 받기
- [ ] Cloudflare DNS: `api` 를 **A(VM IP) → CNAME(Railway)** 로 변경
- [ ] ⚠️ **프록시는 DNS-only(회색 구름)로 시작.** Railway 인증서 발급을 Cloudflare 프록시가 막을 수 있다. 발급 확인 후 필요하면 켠다
- [ ] 전파 후 재검증: 헬스 / 로그인 / **공개 폼 실제 제출** / 텔레그램·구글시트 알림 수신 / 문자 도착
- [ ] ✅ 이상 없으면 **`APP_WARMUP_ENABLED=true`** 로 되돌린다

> **🔙 롤백**: Cloudflare 에서 `api` 를 VM IP(A 레코드)로 되돌리면 끝. **VM 백엔드는 계속 켜둔다.**

#### Step A5. 관찰 (2~3일)
- [ ] 리드 유실 없는지 · 알림/문자 정상인지 · Railway 요금이 예상 범위인지
- [ ] ⚠️ **이 기간에도 자동 승인은 VM 쪽에서만 돈다**(Railway 는 `false`). 정상이다
- [ ] 이상 없으면 **VM 백엔드 컨테이너만 중지** → `docker compose -f docker-compose.prod.yml down`
- [ ] 그 직후 **Railway 에서 `APP_LEAD_AUTO_APPROVE_ENABLED=true`** 로 전환 ⭐ 잊으면 자동 승인이 조용히 멈춘다

#### Step A6. Neon 비밀번호 재발급 (§4-3) — **VM 백엔드를 내린 뒤에**
- [ ] Neon 콘솔에서 `neondb_owner` 비번 재발급
- [ ] **Railway 환경변수 `SPRING_DATASOURCE_PASSWORD` 만** 갱신 → 롤링 재배포 → 헬스 확인
- [ ] ⚠️ 이 시점부터 **VM 으로의 롤백은 불가**하다(옛 비번 무효). A5 관찰을 충분히 하고 넘어올 것

---

### Phase B — 프론트를 Cloudflare Pages 로

> 백엔드가 Railway 로 가면 VM 에 남는 건 **정적 파일 서빙뿐**이다. 그거 하나로 VM 을 유지할 이유가 없다.
> Cloudflare Pages 는 **무료 + 상업적 사용 허용**이고 DNS 도 이미 Cloudflare 에 있다. (Vercel 은 같은 일에 Pro $20/월)
> 참고: 현재 프론트 배포는 **다운타임이 없고 1분**이라 급하지 않다. **VM 을 끄기 위한 마무리 단계다.**

- [ ] Pages 프로젝트 → GitHub `main` 연결 / **Root `frontend` · 빌드 `npm run build` · 출력 `dist`**
- [ ] 환경변수: `VITE_API_BASE_URL=https://api.lead-pot.com` · `VITE_APP_BASE_URL=https://app.lead-pot.com`
      (현재 [deploy-frontend.yml](../.github/workflows/deploy-frontend.yml) 이 주입하는 값 그대로)
- [ ] SPA 폴백은 `frontend/public/_redirects` 에 **이미 있다** → 추가 작업 없음
- [ ] `*.pages.dev` 로 먼저 검증: 딥링크 새로고침 / `embed.js` 200 / 공개 폼 제출
- [ ] Custom Domain `app.lead-pot.com` 연결 → DNS 전환
- [ ] ❓ **D3 서브도메인(`*.lead-pot.com`)**: Pages 에 **와일드카드 커스텀 도메인**을 붙일 수 있는지 확인 필요.
      안 되면 Worker 라우팅 등 대안 검토.
      ⚠️ **와일드카드 DNS·SSL 은 지금도 미구성**(PROGRESS.md D3 "남은 것")이라 **이전의 블로커는 아니다**

---

### Phase C — 정리

- [ ] `.github/workflows/deploy-backend.yml` 삭제 (Railway 가 대체)
- [ ] `.github/workflows/deploy-frontend.yml` 삭제 (Pages 가 대체)
- [ ] `backend/Dockerfile.runtime` 삭제 (jar 전송 방식 전용이라 쓸모 없어짐) · `docker-compose.prod.yml` 처리 결정
- [ ] `deploy/nginx-leadpot-api.conf` — 기록용으로 남기고 "구 구성" 주석
- [ ] **[CLAUDE.md](../CLAUDE.md) §2 표 · §3 아키텍처 · §6 배포법 전면 갱신** ← 잊지 말 것
- [ ] [DEPLOY.md](DEPLOY.md) 부록 D 신설, 부록 C 는 "구 구성" 표기
- [ ] **Oracle VM 종료** (마지막. Phase A·B 가 최소 1주 안정된 뒤)
- [ ] 복귀할 작업: **예열 경로별 3~5회 반복**(단, DB 왕복이 사라진 뒤 **재측정하고 필요한지 다시 판단**) · **V29 이후 작업**

---

## 6. Railway 환경변수 전체 목록

> 값 조달은 §4-2. **여기에 실제 값을 적지 말 것.**
> Spring Boot 완화 바인딩(relaxed binding)으로 `APP_SMS_SOLAPI_API_KEY` → `app.sms.solapi.api-key` 로 매핑된다.

### 필수

| 환경변수 | 비고 |
|---|---|
| `SPRING_DATASOURCE_URL` | Neon. **`?sslmode=require` 필수** |
| `SPRING_DATASOURCE_USERNAME` | |
| `SPRING_DATASOURCE_PASSWORD` | §4-3 재발급과 연계 |
| `APP_JWT_SECRET` | ⚠️ **VM `.env` 의 기존 값을 그대로 옮긴다** → 로그인 세션 유지. 새로 만들면 전원 로그아웃 — §4-2 |
| `APP_CORS_ALLOWED_ORIGINS` | `https://app.lead-pot.com,https://*.lead-pot.com` |
| `APP_PUBLIC_BASE_URL` | `https://app.lead-pot.com` (알림 메시지의 리드 딥링크) |
| `APP_STORAGE_TYPE` | **`r2`** ⭐ §4-1 확인 결과 반영 |
| `APP_STORAGE_R2_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` / `_BUCKET` / `_PUBLIC_BASE_URL` | 5개 세트 |

### 운영 동작 제어 — ⚠️ 이전 중 값이 달라진다 (§4-5)

| 환경변수 | 기본 | 이전 중 | 컷오버 후 |
|---|---|---|---|
| `APP_LEAD_AUTO_APPROVE_ENABLED` | `true` | **`false`** | `true` (Step A5) |
| `APP_WARMUP_ENABLED` | `true` | **`false`** | `true` (Step A4 끝) |
| `APP_AUTH_SIGNUP_ENABLED` | `false` | `false` | `false` (공개 가입 닫힘 유지) |
| `APP_LEAD_AUTO_APPROVE_CRON` | `0 10 * * * *` | 그대로 | 그대로 |
| `APP_ADMIN_BOOTSTRAP_EMAIL` | 빈값 | **빈값 유지** | 빈값 (운영자 승격용 일회성 도구) |

### 문자 발송 (Solapi — 없으면 문자 기능만 죽는다)

`APP_SMS_SOLAPI_API_KEY` · `APP_SMS_SOLAPI_API_SECRET` · `APP_SMS_SOLAPI_SENDER_PHONE`

### 선택 (기본값 있음)

`APP_UPLOADS_DIR`(r2 면 불필요) · `APP_DB_KEEPALIVE_MS` · `APP_DB_MIN_IDLE` · `APP_DB_MAX_POOL` ·
`APP_DB_MAX_LIFETIME_MS` · `APP_DB_CONNECTION_TIMEOUT_MS` · `APP_JWT_ACCESS_TTL` ·
`APP_JWT_ADVERTISER_ACCESS_TTL` · `APP_JWT_REFRESH_TTL` · `APP_ADVERTISER_MAX_FREE`(현재 기본 0=무제한) ·
`APP_ADVERTISER_MAX_PRO` · `APP_ADVERTISER_INVITE_TTL_HOURS` · `APP_ADVERTISER_PASSWORD_RESET_TTL_HOURS` ·
`APP_ADVERTISER_EXPORT_DAILY_MAX`

> **텔레그램·구글시트 연동 값은 환경변수가 아니다.** 사용자별 설정으로 **DB(`IntegrationSettings`)에 저장**돼 자동으로 따라온다.
> 아웃바운드 443(`api.telegram.org`·`script.google.com`)은 Railway 기본 허용이라 문제 없다.

---

## 7. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| **업로드 이미지 유실** (R2 아니었을 경우) | §4-1 을 **착수 전에** 확인. `local` 이면 R2 전환이 선행 작업 |
| **전원 로그아웃** (JWT 시크릿 실수) | §4-2 — VM `.env` 의 기존 값을 **정확히 복사**. Step A3 에서 로그인으로 검증 |
| **Neon 비번 재발급이 롤백 경로를 끊음** | §4-3 — 재발급은 **VM 을 내린 뒤**에 |
| **자동 승인 이중 실행** | §4-5-2 — Railway 는 컷오버까지 `false` |
| **예열이 운영 DB 에 INSERT** | §4-5-3 — 검증 중 `false` |
| **Flyway 버전 충돌** | §4-5-1 — 이전 기간 중 V29 이상 추가 금지 (현재 **V28**) |
| **DNS 전환 중 리드 유실** | VM 백엔드를 **켜둔 채로** 전환. 어느 쪽으로 가든 **같은 Neon DB** 에 쌓이므로 실제 유실 없음 |
| **Railway 요금 폭주** | Step A1 의 Usage Limit(하드 $25) |
| **한국 사용자 체감이 오히려 나빠짐** | Step A3 에서 **숫자로 측정**(200ms 목표). 미달이면 DNS 전환 전에 멈춤 |
| **Railway 장애/정책 변경** | Dockerfile 기반이라 Fly·Render 로 며칠 안에 이동 가능. **락인 없음** (CLAUDE.md §2 이식성 원칙 유지) |

---

## 8. 차선책

**Fly.io 싱가포르(`sin`)** — 월 $6~8 로 더 싸고 Dockerfile 그대로. `fly.toml`·CLI 학습이 유일한 비용.
⚠️ **스케일투제로는 절대 켜지 마라.** JVM 콜드스타트가 길어 공개 리드폼이 죽는다(현재도 콜드 2.0초). 항상 켜둬도 월 1만원이다.

한국 사용자 지연까지 0 으로 만들고 싶어지면 → **Fly 도쿄(`nrt`) + DB 를 Supabase 서울로**(§3 B안).

---

## 9. 착수 전 사용자 확인 필요 (❓)

1. **Railway 계정·결제수단** — 사용자가 직접 (Claude 는 계정 생성·결제정보 입력을 하지 않는다)
2. **Phase B 를 같이 갈지, Phase A 만 먼저 할지** — **A 만 해도 P1·P2·P3 는 전부 해결된다.** B 는 VM 을 끄기 위한 마무리

> ✅ **해소됨**: SSH 키는 사용자가 보유 중(2026-08-07 확인) → JWT 시크릿을 그대로 옮겨 **로그인 세션 유지**.
> **§4-1 R2 판정**도 SSH 로 바로 확인하면 되므로 별도 사전 질문이 아니라 **Step 0 작업**이 됐다.

---

## 10. 진행 체크리스트 (이어받는 세션용)

```
[ ] 0-a SSH 키를 작업 PC 의 ~/.ssh 에 배치 (없으면 아래가 전부 막힌다)
[ ] 0-b §4-2 VM ~/Leadpot/.env 통째로 백업 → APP_JWT_SECRET 확보 (세션 유지의 핵심)
[ ] 0-c §4-1 R2 판정 (grep APP_STORAGE ~/Leadpot/.env)
[ ] A1  Railway 프로젝트 + 싱가포르 리전 + Usage Limit + Dockerfile 확인
[ ] A2  환경변수 주입 (자동승인·예열 false 로 시작)
[ ] A3  임시 도메인 스모크 + 응답시간 측정 (541ms → 200ms 목표)
[ ] A4  api.lead-pot.com DNS 전환 → 예열 true 로 복귀
[ ] A5  2~3일 관찰 → VM 백엔드 중지 → 자동승인 true 로 복귀 ⭐
[ ] A6  §4-3 Neon 비번 재발급 → Railway 환경변수만 갱신 (VM 내린 뒤에!)
[ ] B   프론트 → Cloudflare Pages
[ ] C   워크플로 삭제 · CLAUDE.md/DEPLOY.md 갱신 · VM 종료
[ ] →   V29 이후 작업 재개 / 예열 필요성 재판단
```
