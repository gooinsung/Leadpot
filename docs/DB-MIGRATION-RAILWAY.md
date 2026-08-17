# docs/DB-MIGRATION-RAILWAY.md — DB 이전 런북 (Neon → Railway Postgres)

> **작성 2026-08-17 (gooin PC). 상태: ✅ 전환 완료 2026-08-18 01:10 KST — 관찰 기간 중.**
>
> ## ✅ 전환 완료 (2026-08-18 01:00~01:15 KST)
>
> **프로덕션 DB 가 Neon → Railway Postgres 로 넘어갔다.** 실행 순서와 결과:
>
> | # | 단계 | 결과 |
> |---|---|---|
> | 1 | VM 백엔드 정지(쓰기 동결) | `docker compose down` 성공. VM `/api/health` → **502**(nginx 만 살아있음) |
> | 2 | Neon 최종 덤프 | `leadpot-neon-FINAL-20260818-0100.dump` · **CUTOFF `2026-08-17 16:00:20.860766+00`** |
> | 3 | Railway DB 초기화 + 복원 | `--single-transaction` **에러 0건** |
> | 4 | 환경변수 3개 교체 | Railway 변수 참조로 설정(비번 회전 시 자동 추종) |
> | 5 | 델타 확인 | **리드·메시지·사용자 유실 0건** (아래) |
> | 6 | 자동 승인 인수 | `APP_LEAD_AUTO_APPROVE_ENABLED` `false` → **`true`** ⭐ |
>
> ### 데이터 일치 검증
>
> ```
> CUTOFF 시점  Neon : users=44 leads=78 visits=1110  msg=84 notif=38 events=679
> 복원 결과 Railway : users=44 leads=78 visits=1110  Flyway=V33  실패=0   ✅ 완전 일치
> ```
>
> **전환이 실제로 일어났다는 결정적 증거** (전환 8분 후 실측):
>
> | | Neon(구) | Railway(신) |
> |---|---|---|
> | visits | 1,111 | **1,115** |
> | 마지막 visit | 16:00:44 (**멈춤**) | **16:05:02** (계속 유입) |
>
> 해석된 접속 문자열: `jdbc:postgresql://postgres.railway.internal:5432/railway` (내부망)
>
> ### 델타 (CUTOFF 이후 Neon 에 남은 것)
>
> `created_at` 있는 **23개 테이블 전수 조회 결과 `visits` 1건만**, 나머지 전부 0.
> `updated_at` 있는 5개 테이블도 전부 0 → **UPDATE 유실도 없다.**
>
> 그 1건: `id=1111` / `landing_page_id=17` / **`form_id`=NULL(폼 제출 아닌 단순 페이지뷰)**.
> ⚠️ Railway 는 이미 `id=1111` 을 다른 방문에 사용했으므로 그대로 이전할 수 없다.
> **익명 조회 1건이라 이전하지 않고 종결한다**(사용자 확인).
>
> ### ⭐ 지연 개선 실측 — P1 해결
>
> [HOSTING-MIGRATION-PLAN.md:13-25](HOSTING-MIGRATION-PLAN.md:13) 의 *"응답시간 74%가 Neon 왕복,
> DB 이전이 유일한 해법"* 이 목표였다.
>
> | 경로 | 응답시간(gooin PC 기준) |
> |---|---|
> | `api/health`(DB 안 탐) | 0.368~0.375s |
> | `landing/17/live`(DB 탐) | 0.388~0.403s |
> | `public/forms/24`(DB 탐) | 0.386~0.403s |
>
> ⚠️ 절대값은 한국 PC→Cloudflare→싱가포르 왕복이 포함돼 서버 성능이 아니다. **차이값**이 지표다:
>
> | 구간 | DB 왕복 기여분 |
> |---|---|
> | VM + Neon | **426ms** |
> | Railway + Neon | 약 100ms |
> | **Railway + Railway Postgres** | **약 20ms** |
>
> → **DB 왕복 약 5배 감소.** 목표 달성.
>
> ### 관찰 기간 중 확인할 것
>
> - [ ] **매시 10분 자동 승인 배치**가 Railway 에서 도는지 (VM 에서 인수한 직후라 첫 사이클 확인 필요)
> - [ ] 문자·알림톡 발송 정상 · 구글시트 연동 정상
> - [ ] Railway 요금 실측(Postgres 추가분이 예상대로 $1~2/월 수준인지)
>
> ### 🔒 Neon 은 아직 지우지 않는다 (판단 근거가 바뀌었다)
>
> 할당량을 태운 keepalive 가 이제 Neon 을 안 찌른다 → **5분 뒤 scale-to-zero** →
> 남는 건 스토리지 0.04GB × $0.35 = **월 약 $0.014(20원)**.
> **20원 아끼려고 살아있는 롤백 대상을 버릴 이유가 없다.** 관찰이 끝난 뒤 삭제한다.
>
> ### ⚠️ Oracle VM 은 지우면 안 된다 (2026-08-18 확인)
>
> `app.lead-pot.com` → **HTTP 200**. **프론트엔드가 아직 이 VM 의 nginx 에서 서비스된다.**
> 백엔드 컨테이너만 껐고 nginx 는 프론트 서빙용으로 계속 돈다.
> VM 을 없애려면 먼저 **프론트를 Cloudflare Pages 로** 옮겨야 한다([HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) Phase B).
>
> ### 롤백 방법
>
> `C:\Users\gooin\leadpot-backup\ROLLBACK-leadpot-env-20260818.txt` 의 값 3개를
> Railway `Leadpot` 서비스에 되돌리면 즉시 Neon 으로 복귀한다(롤링 재배포).
>
> ---
>
> ### (이하 이전 계획·경과 기록)
>
> ### ✅ 2026-08-17 14:51 KST — 서비스 복구 (사용자가 Neon Launch 로 전환)
>
> | | 장애 중 | 복구 후 |
> |---|---|---|
> | `/actuator/health` | DOWN | **UP** |
> | 로그인 API | **10.4초 뒤 실패** | **0.385초** 정상 응답(`INVALID_CREDENTIALS`) |
> | Neon 직접 접속 | `53000` 쿼터 초과 거절 | **886ms 접속 성공** |
>
> 데이터도 온전하다 — Flyway **V33 / 33건 / 실패 0건**, 행 수·시퀀스 스냅샷은 §6-1·6-2.
>
> ⏱️ **다만 미터가 돌고 있다.** Launch 는 $0.106/CU-hour 이고 우리 keepalive 설정이 DB 를
> 24시간 깨워두므로 **0.25 CU × 24h = 6 CU-hr = 약 $0.64/일(약 900원/일)** 이 계속 나간다.
> 급하진 않지만 미루면 그만큼 낸다 — 1주일 = 약 $4.5.
>
### ✅ 2026-08-18 00:05 KST — 백업 덤프 확보 + **복원 검증까지 완료**

```
C:\Users\gooin\leadpot-backup\
  ├─ leadpot-neon-full-20260818.dump   198 KB  (스키마+데이터+flyway 이력)
  ├─ leadpot-neon-data-20260818.dump   130 KB  (데이터만, flyway 이력 제외)
  └─ verify.sql                                (행 수·시퀀스 대조 쿼리 — 실제 이전 때 재사용)
```

⚠️ **레포 밖**에 둔다(실수로 커밋되면 안 된다). `git status` 깨끗함 확인됨.

**덤프를 믿을 수 있는지 실제로 검증했다** — 추측이 아니다:

1. `pg_dump` 18.6 로 Neon 18.4 에서 추출 (버전 불일치 원천 차단)
2. 목차 확인: 전체 덤프에 **테이블 26개 + 시퀀스 24개** 전부 포함
3. **로컬 `postgres:18` 컨테이너에 실제로 복원** → `--exit-on-error` 로 **에러 0건**
4. 복원본 vs 살아있는 Neon 을 50개 항목(테이블 26 + 시퀀스 24) 전수 대조:

| 결과 | 건수 |
|---|---|
| **완전 일치** | **48** |
| 덤프 후 증가(`visits` 1066→1071, `visits_id_seq` 동일) | 2 |
| **문제** | **0** |

유일한 차이는 `visits` 가 5건 늘어난 것 = **덤프 이후 들어온 실제 트래픽**이다(서비스가 살아있으니 정상).
⭐ 가장 위험했던 시퀀스도 전부 일치했다 — `leads_id_seq`=169, `form_blocks_id_seq`=383 포함.

> 💡 **이 검증으로 경로 A(전체 덤프)가 PG18 에서 깨끗하게 동작함이 증명됐다.**
> Railway Postgres 가 18 이면 경로 A 를 쓴다. 16/17 이면 경로 B(데이터만 + `--disable-triggers`)로 간다.
> ⚠️ 경로 B 는 `users` 의 **순환 FK**(`parent_user_id` 자기참조) 때문에 `--disable-triggers` 가 **필수**다
> — `pg_dump` 가 직접 경고했고, 그래서 가능하면 경로 A 가 낫다.

> ⚠️ **이 덤프는 안전용 백업이다.** 실제 이전 때는 쓰기를 멈춘 뒤(Step 3) **새로 덤프를 떠서** 쓴다.

### 🛑 2026-08-18 00:30 KST — **복원 중단.** 블로커 2개 (방향 재검토 필요)

Railway Postgres 를 만들고 복원하려다 두 가지가 걸려서 **의도적으로 멈췄다.**
서비스는 Neon Launch 로 정상 동작 중이고 검증된 백업도 있으니 급하지 않다.

#### 블로커 1 — Postgres 가 **백엔드와 다른 프로젝트**에 생성됐다 → ✅ **해결 (00:35, 사용자)**

> 사용자가 잘못 만든 것을 삭제하고 **프로젝트 `Leadpot` 안에 새로 생성**했다.
> → 이제 `Cost by Service` 에 **백엔드와 Postgres 가 함께** 보이므로,
> 블로커 2(RAM)의 진짜 원인과 **백엔드 실제 비용**을 동시에 확인할 수 있게 됐다.
> ⚠️ 접속정보도 새로 받아야 한다(`railway-db.txt.txt` 의 값은 삭제된 DB 것이다).

Railway 에서 **프로젝트 = 내부망의 경계**다. 백엔드와 DB 가 서로 보려면
**같은 프로젝트 안의 서비스 두 개**여야 한다(새 프로젝트를 만드는 게 아니다).

```
프로젝트 "Leadpot"
  ├─ 서비스: Leadpot (백엔드)      ← 이미 있음
  └─ 서비스: Postgres              ← 여기에 추가해야 함
       └─ postgres.railway.internal 로 서로 통함
```

- 증거: `Cost by Service` 화면에 **Postgres 와 "deleted services" 만** 있고 백엔드가 없다.
  그런데 백엔드는 살아있다(`/api/health` UP, `/actuator/health` UP).
- 받은 접속정보도 **내부 주소**(`postgres.railway.internal`)여서 내 PC 에서 복원할 수 없었다.
  복원에는 **`DATABASE_PUBLIC_URL`**(`*.proxy.rlwy.net:포트`)이 필요하다.
- 다른 프로젝트에 두면 공개 인터넷을 타야 하므로 **이전의 이득 3개(저지연·egress 무과금·비공개)가 전부 사라진다.**

#### 블로커 2 — "RAM 4.66GB → 월 $50" → ❌ **오독이었다. 블로커 아님 (00:40 해소)**

> ⚠️ **정정: Railway 요금 화면의 숫자는 "순간 사용량"이 아니라 "청구 주기 누적 GB-분"이다.**
> 나는 4.66 을 순간 GB 로 읽고 "월 $50, 이전하면 2.5배 비싸진다"고 잘못 경고해 복원을 멈췄다.
> 실제로는 **누적 4.66 GB-분**(생성 직후 몇십 분치)이었다.

**결정적 증거**: 백엔드 RAM 이 **7085.04 GB** 로 표시된다. 순간값이면 7TB 라 불가능하다 → 누적 GB-분이다.
검산도 맞는다:

| 항목 | 누적량 | × 분당 단가 | 표시 금액 |
|---|---|---|---|
| RAM | 7085.04 GB-분 | × $0.000231 | $1.6366 ≈ **$1.6401** ✅ |
| CPU | 43.32 vCPU-분 | × $0.000463 | **$0.0201** ✅ |
| Egress | 0.10 GB | × $0.05 | **$0.0050** ✅ |

#### ⭐ 그래서 확인된 실제 비용 (2026-08-18 `Cost by Service` 실측)

백엔드는 컷오버(2026-08-09)부터 **9일** 가동 → 평균 RAM = 7,085 ÷ (9 × 1,440) = **약 0.55 GB**.
Spring Boot 로 정상 수치다. **"JVM 힙 폭주"는 없었다**(이것도 내 잘못된 가설이었다).

| 서비스 | 실측 | 월 환산 | 앞서 적었던 값 |
|---|---|---:|---|
| **백엔드(Leadpot)** | $1.67 / 9일 · 평균 RAM 0.55GB | **~$5.5** | $12~17(계획 단계 추정) — **과대평가였다** |
| **Postgres** | RAM 0.10GB · CPU 0.01 | **~$1~2** | $2~4 → $50 ❌ |
| 볼륨 0.35GB | | ~$0.05 | |
| **합계** | | **약 $7/월** | $15~21 → $50 ❌ |

**Hobby 크레딧 $5 가 대부분을 덮는다.** 초과분은 월 $2 수준이다.

#### 결론: 이전 결정이 더 명확해졌다

| | 월 비용 |
|---|---:|
| **Railway Postgres (이전 후)** | **~$1~2** |
| Neon Launch 유지(keepalive 24시간) | ~$19 |

**Railway 가 10배 이상 싸고 내부망이라 지연도 최소다.** 예정대로 진행한다.

#### Usage Limit 값도 이 실측으로 확정할 수 있다

앞서 "$25 는 위험하다 → 실제 지출 확인 후 정하자"고 했다. 실제가 **월 ~$7** 이므로:

| 항목 | 권장값 | 근거 |
|---|---|---|
| Soft Limit | **$15** | 실제의 약 2배. 이상 징후를 이메일로 먼저 받는다 |
| Hard Limit | **$40** | 실제의 5배 이상. 요금 폭탄은 막고 정상 변동으로는 서비스가 죽지 않는다 |

⚠️ Hard Limit 은 **초과 시 서비스를 정지**시킨다. 실제 지출에 가깝게 잡으면 스스로 장애를 만든다
(Neon 한도 사고의 재현). 넉넉하게 잡는 것이 맞다.

#### 남은 확인 (사소)

- [ ] `deleted services` 의 **Volume 0.13GB** — 고아 볼륨. 금액은 $0 이라 급하지 않다
- [ ] **새 Postgres 의 `DATABASE_PUBLIC_URL`** — `railway-db.txt.txt` 의 값은 삭제된 DB 것이다.
      ⚠️ Windows 확장자 숨김 때문에 `railway-db.txt` 가 `railway-db.txt.txt` 로 저장된다(실제로 그랬다)
> 계기: **Neon 무료 한도(월 100 CU-hrs) 초과로 DB 컴퓨트가 정지**해 서비스가 다운됐다(2026-08-17).
> 이 이전은 원래 [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) 남은 일 **6번**에 있던 항목이다
> (*"DB → Railway Postgres 교체 검토(Neon 무료 100 CU-h/월 한도 → keepalive 24시간이면 초과 가능)"* — 2026-08-09 조사 결론).
> **예측했던 리스크가 그대로 터진 것이므로, 검토가 아니라 실행으로 승격한다.**
> 관련: [CLAUDE.md](../CLAUDE.md) §6 · [PROGRESS.md](PROGRESS.md)

---

## 0. 왜 옮기는가 (2줄)

1. **Neon 무료 플랜은 우리 사용 패턴과 구조적으로 안 맞는다.** 컴퓨트 시간(CU-hrs) 과금인데 우리는 DB를 24시간 깨워둔다.
2. **응답시간의 대부분이 여전히 외부 DB 왕복이다.** Railway 내부망으로 붙이면 이게 거의 0이 된다.

Railway Postgres에는 **컴퓨트 시간 개념이 없다** → 상시 가동이 정상이고, 월 한도 초과로 DB가 멈추는 사고가 **구조적으로 불가능**해진다.

---

## 1. 현재 상태 (2026-08-17 실측)

| 항목 | 값 | 확인 방법 |
|---|---|---|
| Neon 컴퓨트 | **110.6 / 100 CU-hrs → 정지** | Neon 대시보드 |
| Neon Postgres 버전 | **18** | Neon 대시보드 Project settings |
| Neon 리전 | AWS ap-southeast-1 (싱가포르) | 동상 |
| **데이터 크기** | **0.04 GB** ⭐ 매우 작다 | Neon 대시보드 Storage |
| Flyway 최신 | **V33** (`V33__advertiser_default_notify_phone.sql`, 총 33개) | `backend/src/main/resources/db/migration/` |
| 스키마 소유자 | **Flyway** (`spring.flyway.enabled=true`, `ddl-auto=validate`) | [application.properties:69-74](../backend/src/main/resources/application.properties:69) |
| 테이블 수 | 25개 | 마이그레이션 파일 |
| 로컬 개발 DB | postgres:**16** | [docker-compose.yml:7](../docker-compose.yml) |
| Railway 플랜 | Hobby ($5/월, 크레딧 $5 포함) | [HOSTING-MIGRATION-PLAN.md:222](HOSTING-MIGRATION-PLAN.md:222) |

### 증상 (원인 진단 근거)

| 확인 | 결과 | 의미 |
|---|---|---|
| `/api/health` | UP (0.7초) | 앱은 정상. DB를 안 탄다 |
| `/actuator/health` | **DOWN** | DB 포함 헬스 실패 |
| DB 타는 엔드포인트 | **10.4초 뒤 실패** | `connection-timeout=10000ms`와 초 단위 일치 → 커넥션 자체를 못 맺음 |

### ⚠️ 백엔드가 2개 살아있다 (이전의 최대 위험)

```
api.lead-pot.com  ──▶ Railway (싱가포르)  ─┐
                                           ├──▶ 같은 Neon DB
https://129.225.198.2  ──▶ Oracle VM      ─┘   ← 아직 UP! (2026-08-17 확인)
```

VM 백엔드는 `APP_LEAD_AUTO_APPROVE_ENABLED=true`로 **매시 10분 자동 승인 배치**를 돌린다
([application.properties:62-65](../backend/src/main/java/../resources/application.properties:62)).
→ **덤프를 뜬 뒤 VM이 Neon에 쓰면 그 데이터는 유실된다.** Step 3에서 반드시 먼저 멈춘다.

---

## 2. 넘을 수 없는 제약 (순서가 여기서 결정된다)

> **Neon 컴퓨트가 정지된 상태에서는 `pg_dump`도 안 된다.** 2026-08-17 JDBC 로 직접 찔러 확인:
>
> ```
> SQLState : 53000
> ERROR: Your account or project has exceeded the compute time quota.
>        Upgrade your plan to increase limits.
> ```
>
> **844ms 즉시 거절** — 타임아웃이 아니라 명시적 하드 차단이다(`53000` = 표준 `insufficient_resources`).
> 에러가 **인증 실패가 아니라 쿼터**이므로 `application-local.properties` 의 자격증명은 아직 유효하다
> → 플랜만 올리면 그 값으로 바로 덤프할 수 있다.
>
> 데이터 자체는 안전하게 남아 있다(Storage 0.04GB로 표시됨).

### 데이터를 빼내는 비용 (2026-08-17 Neon Change plan 화면 실측)

⚠️ **Neon Launch 는 정액 $19/월이 아니다. 순수 사용량 과금이다:**

| Launch 플랜 | 단가 |
|---|---|
| 컴퓨트 | **$0.106 / CU-hour** |
| 스토리지 | $0.35 / GB·월 |
| Instant restore | $0.20 / GB·월 |
| 기타 | Free 한도 제거 · 16 CU 오토스케일 · **5분 후 scale to zero** |

→ **덤프만 하는 비용은 사실상 공짜다.** 0.25 CU 로 30분 = 0.125 CU-hr × $0.106 = **약 $0.013 (20원)**.
→ 하루 종일 켜둬도 0.25 × 24 = 6 CU-hr = **$0.64**.
→ *(참고: 24시간 × 30일 = 180 CU-hr × $0.106 ≈ **$19/월**. 앞서 "$19 정액"이라 적었던 값이
   우연히 우리 사용 패턴의 월 비용과 같았을 뿐, 정액제라는 설명은 틀렸다.)*

⚠️ **결제 확인 화면에서 반드시 볼 것 2가지**:
1. **기본료/최소 청구액**이 따로 있는지 (이 다이얼로그에는 표시되지 않는다)
2. **이번 달 이미 쓴 110.6 CU-hrs 가 소급 청구되는지** — 최악의 경우 110.6 × $0.106 ≈ **$11.7**

### 선택지 재정리

| 방안 | 월 비용 | 지연 | 비고 |
|---|---|---|---|
| Neon Launch + keepalive 유지(24시간 가동) | ~$19 | 현재와 동일 | 가장 비쌈 |
| Neon Launch + scale-to-zero 허용 | ~$4~8 | ❌ **콜드스타트 740ms~2초** | 공개 폼이 모바일이라 치명적 |
| **Railway Postgres 이전 (선택됨)** | **~$2~4** | ✅ **가장 빠름**(내부망) | 컴퓨트 시간 개념 없음 |

→ **결론은 그대로 Railway 이전이다.** 비용·지연 둘 다 유리하다.
바뀐 것은 **여기까지 가는 비용이 $19 → 몇십 원으로 떨어졌다**는 점뿐이다:
Launch 로 잠깐 올려 덤프 → 이전 → **Neon 프로젝트 삭제**(스토리지 과금까지 끊는다).

---

## 3. 비용 (이전 후)

| 항목 | 월 비용 |
|---|---|
| Railway 백엔드 | 계획 문서 추정 $12~17 — **실측은 Railway Usage 화면에서 확인 필요** |
| **Railway Postgres (추가분)** | **약 $2~4** (RAM 100~250MB 가정 · 아래 근거) |
| Neon | **$0** (해지) |
| 합계 | 약 $15~21 |

Railway 단가: **RAM $10/GB·월 + CPU $20/vCPU·월(실사용분) + 볼륨 ~$0.15/GB·월 + 내부망 트래픽 $0**
([HOSTING-MIGRATION-PLAN.md:95](HOSTING-MIGRATION-PLAN.md:95)).

Postgres가 100~250MB로 예상되는 근거: 데이터가 0.04GB뿐이고, 메모리는 기본 `shared_buffers` 128MB +
커넥션 몇 개가 거의 전부다(`maximum-pool-size=10`, `minimum-idle=3`).

⚠️ **Hobby $5 크레딧은 백엔드가 이미 다 쓰고 초과한 상태**라, Postgres 비용은 크레딧에 흡수되지 않고 전액 추가된다.
⚠️ **Usage Limit 하드 캡을 걸어둘 것** (권장 $25 — [HOSTING-MIGRATION-PLAN.md:228](HOSTING-MIGRATION-PLAN.md:228)).

---

## 4. 사용자가 직접 해야 하는 것 (2개)

결제·계정 작업은 대신 할 수 없다.

- [ ] **S1. Neon Launch 결제** — Neon 콘솔 → Billing → Launch. 결제되면 컴퓨트가 다시 깨어난다
- [ ] **S2. Railway에 Postgres 추가** — Railway 프로젝트 → `+ New` → Database → **PostgreSQL**
  - [ ] 리전이 기존 백엔드와 **같은 싱가포르**인지 확인
  - [ ] ⭐ **Postgres 버전 확인** — 아래 경로 분기의 기준이다

### 버전에 따른 경로 분기

| Railway Postgres 버전 | 경로 | 이유 |
|---|---|---|
| **18** (Neon과 동일) | **경로 A — 전체 덤프** (권장) | 완전 복제. flyway 이력·시퀀스까지 그대로 |
| 16 또는 17 | **경로 B — Flyway 스키마 + 데이터만** | PG18 덤프를 하위 버전에 복원하면 깨질 수 있다 |

---

## 5. 절차

### Step 1. 백업 먼저 (되돌릴 수 있게)

현재 Railway 환경변수 3개를 적어둔다. 롤백은 이 값을 되돌리는 것으로 끝난다.

```
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
```

기존 시크릿 백업 위치: `C:\Users\gooinsung\leadpot-backup\` (`railway-env` — [PROGRESS.md:604](PROGRESS.md:604))

### Step 2. Neon 접속 정보 확보

Neon 콘솔 → Connection string. 형태:
`postgresql://neondb_owner:PASS@ep-xxx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### Step 3. ⚠️ 쓰기를 멈춘다 (VM 백엔드 정지)

**이 단계를 빼먹으면 데이터가 유실된다.**

```bash
ssh -i "G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key" ubuntu@129.225.198.2
```

```bash
cd ~/Leadpot && docker compose -f docker-compose.prod.yml down
```

- [ ] `https://129.225.198.2/api/health` 가 이제 실패하는지 확인
- Railway 백엔드는 이 시점부터 잠시 리드를 못 받는다(공개 폼 다운). **데이터가 0.04GB라 복원은 수 분이면 끝난다.**

### Step 4. 덤프 (Docker로 — 아무것도 설치하지 않는다)

로컬에 `pg_dump`를 깔지 않는다. **Neon과 같은 버전(18) 이미지**로 돌려서 버전 불일치를 원천 차단한다.

**경로 A (Railway가 PG18)** — 전체 덤프:

```bash
docker run --rm -v "${PWD}:/backup" postgres:18 pg_dump "<NEON_CONNECTION_STRING>" --no-owner --no-privileges -Fc -f /backup/leadpot-neon.dump
```

**경로 B (Railway가 PG16/17)** — 데이터만 (스키마는 Flyway가 만든다):

```bash
docker run --rm -v "${PWD}:/backup" postgres:18 pg_dump "<NEON_CONNECTION_STRING>" --data-only --exclude-table=flyway_schema_history --no-owner --no-privileges -Fc -f /backup/leadpot-data.dump
```

- [ ] 덤프 파일이 생겼고 크기가 0이 아닌지 확인 (수십 MB 예상)
- PowerShell은 `${PWD}`, Git Bash는 `$(pwd)`

### Step 5. Railway Postgres 접속 정보 확보

Railway → Postgres 서비스 → **Variables** 탭. 두 종류를 구분한다:

| 용도 | 변수 | 비고 |
|---|---|---|
| **복원용**(내 PC에서 붙음) | `DATABASE_PUBLIC_URL` | 공개 TCP 프록시. 내부 도메인은 내 PC에서 안 열린다 |
| **앱 연결용**(Railway 내부) | `RAILWAY_PRIVATE_DOMAIN` · `PGDATABASE` · `PGUSER` · 비밀번호 변수 | 내부망 = 무과금·저지연 |

### Step 6. 복원

**경로 A** — 앱이 한 번도 붙지 않은 빈 DB에 그대로 복원 (flyway 이력이 같이 들어가서 Flyway가 no-op 처리):

```bash
docker run --rm -v "${PWD}:/backup" postgres:18 pg_restore -d "<RAILWAY_DATABASE_PUBLIC_URL>" --no-owner --no-privileges /backup/leadpot-neon.dump
```

**경로 B** — 먼저 Step 7로 앱을 붙여 Flyway가 V1~V33을 적용하게 하고(스키마 생성), 그 다음 데이터만 넣는다:

```bash
docker run --rm -v "${PWD}:/backup" postgres:18 pg_restore -d "<RAILWAY_DATABASE_PUBLIC_URL>" --data-only --disable-triggers --no-owner --no-privileges /backup/leadpot-data.dump
```

> `--disable-triggers`는 FK 순서 문제를 피하려는 것이다. Railway 기본 유저는 권한이 충분하다.

### Step 7. 백엔드를 새 DB로 전환

Railway → **백엔드 서비스** → Variables. 3개를 교체한다 (Railway 변수 참조 문법 `${{Postgres.VAR}}` 사용 권장):

| 변수 | 값 |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.PGDATABASE}}` |
| `SPRING_DATASOURCE_USERNAME` | `${{Postgres.PGUSER}}` |
| `SPRING_DATASOURCE_PASSWORD` | Postgres 서비스의 비밀번호 변수 참조 |

- ⚠️ **`?sslmode=require`를 붙이지 않는다.** Neon 때문에 필요했던 것이고, 내부망에서는 불필요하다
- ⚠️ 서비스명이 `Postgres`가 아니면 참조 이름을 맞춘다
- 저장하면 **롤링 재배포**된다(다운타임 없음)

---

## 6. 검증

- [ ] `curl https://api.lead-pot.com/api/health` → `UP`
- [ ] `curl https://api.lead-pot.com/actuator/health` → **`UP`** ⭐ 이게 DOWN이면 DB 연결 실패
- [ ] **Flyway 검증 통과** — Railway 백엔드 Deploy Logs에 `Successfully validated 33 migrations` 류 로그, `ddl-auto=validate`라 스키마가 어긋나면 **기동 자체가 실패**한다 (= 좋은 안전망)
- [ ] **행 수 대조** — 아래 §6-1 기준값과 대조 (덤프 직전에 한 번 더 떠서 최신값으로 갱신할 것)

### 6-1. 기준값 스냅샷 (2026-08-17 14:51 KST · Neon 복구 직후 실측)

> Neon `PostgreSQL 18.4` · DB 크기 **11MB** · Flyway **V33 / 33건 적용 / 실패 0건** · public 테이블 **26개**(= 25 + `flyway_schema_history`)

| 테이블 | 행 수 | 테이블 | 행 수 |
|---|---:|---|---:|
| admin_audit_logs | 31 | ip_blocks | 1 |
| advertiser_access_logs | 58 | landing_pages | 22 |
| advertiser_form_grants | 3 | lead_as_requests | 1 |
| advertiser_invites | 6 | lead_notes | 37 |
| advertiser_ledger | 4 | lead_statuses | 4 |
| advertiser_password_resets | 4 | **leads** | **76** |
| consent_documents | 3 | message_logs | 83 |
| flyway_schema_history | 33 | notification_logs | 37 |
| form_blocks | 55 | site_ip_block_hits | 0 |
| forms | 30 | site_ip_blocks | 0 |
| html_components | 1 | **users** | **44** |
| integration_settings | 3 | visits | 1063 |
| interaction_events | 679 | ip_block_hits | 0 |

### 6-2. ⭐ 시퀀스 대조 (여기가 가장 깨지기 쉽다)

**시퀀스 값이 행 수보다 큰 테이블이 여러 개다** — 삭제된 행이 있었다는 뜻이고 정상이다.
문제는 **복원 시 시퀀스를 안 옮기면 다음 INSERT 가 기존 PK 와 충돌**한다는 것이다.
예: `leads` 는 76행인데 시퀀스는 **169** → 시퀀스를 놓치면 다음 리드가 77번을 받아 터진다.

| 시퀀스 | 값 | 시퀀스 | 값 |
|---|---:|---|---:|
| admin_audit_logs_id_seq | 31 | landing_pages_id_seq | 23 |
| advertiser_access_logs_id_seq | 58 | lead_as_requests_id_seq | 1 |
| advertiser_form_grants_id_seq | 7 | lead_notes_id_seq | 56 |
| advertiser_invites_id_seq | 7 | lead_statuses_id_seq | 4 |
| advertiser_ledger_id_seq | 4 | **leads_id_seq** | **169** ⭐ |
| advertiser_password_resets_id_seq | 4 | message_logs_id_seq | 83 |
| consent_documents_id_seq | 3 | notification_logs_id_seq | 37 |
| **form_blocks_id_seq** | **383** ⭐ | site_ip_block_hits_id_seq | (미사용) |
| forms_id_seq | 35 | site_ip_blocks_id_seq | 1 |
| html_components_id_seq | 3 | users_id_seq | 45 |
| interaction_events_id_seq | 679 | visits_id_seq | 1063 |
| ip_block_hits_id_seq | 2 | | |

복원 후 이 쿼리로 대조한다:

```sql
SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;
```

- [ ] **로그인** — 기존 계정으로 성공 (users·비밀번호 해시 정상)
- [ ] **공개 폼 제출** → 리드 1건 생성 확인 (⭐ **시퀀스가 제대로 넘어왔는지**를 보는 테스트. 여기서 PK 충돌이 나면 시퀀스 문제)
- [ ] 알림(문자·텔레그램) 정상 발송
- [ ] 리드 목록·엑셀 내보내기 정상
- [ ] **응답시간 실측** — 랜딩 API가 220~246ms에서 얼마로 줄었는지 기록 (이전의 핵심 목적)

### 롤백

환경변수 3개를 Neon 값으로 되돌리고 롤링 재배포. Neon은 검증이 끝날 때까지 **해지하지 않는다.**

---

## 6-3. 🔒 보안 조이기 (사용자 요청 2026-08-18)

> ⚠️ **먼저 용어 정리: Railway 에는 AWS 식 "보안그룹"이 없다.** IP 단위 방화벽 규칙을 쓰는 구조가 아니다.
> Neon 의 `IP Allow` 도 **Scale 플랜 전용**이었다(Change plan 화면 확인). 그래서 Railway 에서 실제로
> 조일 수 있는 수단은 **① 공개 엔드포인트 자체를 없애기 ② Postgres 권한 ③ 자격증명 관리** 세 가지다.

### 🔴 필수 1 — 복원이 끝나면 **공개 엔드포인트(TCP Proxy)를 제거**한다 ⭐ 가장 큰 효과

Railway Postgres 는 기본으로 **공개 TCP Proxy** 가 붙어 인터넷에서 접근 가능하다
(`DATABASE_PUBLIC_URL` 이 그것이다). 이게 사실상 유일한 외부 공격면이다.

- 복원할 때는 **필요하다**(내 PC 에서 붙어야 하므로)
- **복원·검증이 끝나면 즉시 제거**: Postgres 서비스 → Settings → Networking → TCP Proxy 삭제
- 그러면 DB 는 **내부망(`*.railway.internal`)에서만** 접근 가능해진다 = 보안그룹을 닫는 것과 동일한 효과
- ⚠️ 앱은 내부 주소로 붙으므로 **영향 없다**(§5 Step 7 에서 이미 내부 주소로 설정)

**이후 관리 접근이 필요할 때**는 공개 프록시를 다시 열지 말고 CLI 터널을 쓴다:

```bash
railway connect
```

### 🔴 필수 2 — **로컬 개발이 프로덕션 DB 를 공유하는 구조를 끝낸다** ⭐ 실질적으로 가장 위험

현재 구조([PROGRESS.md:12](PROGRESS.md:12)): *"모든 환경 공유 DB 한 대"*
→ **모든 개발 PC 의 `application-local.properties` 에 실 프로덕션 DB 비밀번호가 있다.**

| 위험 | 결과 |
|---|---|
| 개발 PC 한 대가 털린다 | **실 고객 리드 전체 노출**(개인정보) |
| 로컬에서 실수로 `DELETE`·`TRUNCATE` | **프로덕션 데이터 소실** |
| 마이그레이션 실험 | 프로덕션 스키마에 바로 반영 |

공개 엔드포인트를 닫아도 **이건 그대로 남는다.** 네트워크가 아니라 자격증명 배포 문제이기 때문이다.

**해결책은 이미 레포에 있다** — [docker-compose.yml](../docker-compose.yml) 에 `postgres:16` 컨테이너가 있다.
이전을 계기로 **로컬 개발은 로컬 컨테이너를 쓰고, 프로덕션 자격증명은 어느 PC 에도 두지 않는다.**
Flyway 가 스키마를 소유하므로 빈 로컬 DB 에서 `V1~V33` 이 자동 적용된다 — 준비 비용이 거의 없다.

- [ ] 로컬 `postgres:18` 로 버전 통일(운영과 맞춤) 후 `docker compose up` 으로 개발
- [ ] `application-local.properties` 에서 프로덕션 접속정보 제거 → 로컬 컨테이너 주소로
- [ ] 각 PC 의 기존 파일에 남은 프로덕션 비번 삭제
- [ ] [PROGRESS.md:12](PROGRESS.md:12) 의 "모든 환경 공유 DB 한 대" 전제를 폐기 기록

### 🟡 권장 3 — 앱 전용 **최소 권한 계정**

Railway 가 주는 기본 유저는 **superuser** 다. 앱은 superuser 가 필요 없다.
Flyway 가 DDL 을 하므로 **스키마 소유권은 필요**하지만, superuser 는 아니어도 된다.

복원을 끝낸 뒤 `postgres` 로 접속해 실행한다:

```sql
CREATE ROLE leadpot_app LOGIN PASSWORD '<강한 비밀번호>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER SCHEMA public OWNER TO leadpot_app;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO leadpot_app', r.tablename); END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO leadpot_app', r.sequencename); END LOOP;
END $$;
```

그 뒤 `SPRING_DATASOURCE_USERNAME`·`PASSWORD` 를 이 계정으로 바꾼다.
superuser 비번은 관리용으로만 보관한다.

> ⚠️ **트레이드오프**: 나중에 `--data-only` 복원(경로 B)을 할 일이 생기면 `--disable-triggers` 가
> superuser 를 요구한다. 그때는 관리용 `postgres` 계정으로 하면 된다.

### 🟡 권장 4 — 이전 후 **비밀번호 회전**

복원 과정에서 공개 URL 을 노트북에서 사용했다. 이전·검증이 끝나면 회전한다.
Railway 는 변수만 바꾸면 **롤링 재배포**라 다운타임이 없다.

### 🟡 권장 5 — **Neon 프로젝트 완전 삭제**

Neon 비번은 여러 PC 의 로컬 파일·백업에 남아 있다. 프로젝트를 삭제하면 그 자격증명이 전부 무의미해진다.
플랜만 Free 로 내리면 계정은 살아 있다 → **프로젝트 자체를 삭제**한다(스토리지 과금도 함께 끊긴다).

### 이미 잘 되어 있는 것 (확인함)

- `application-local.properties` 가 [.gitignore:43](../.gitignore) 에 등록돼 커밋되지 않는다 ✅
- 백업·덤프 파일을 레포 밖(`C:\Users\gooin\leadpot-backup\`)에 둔다 ✅
- Postgres 18 기본 인증이 `scram-sha-256` 이다 ✅
- 내부망 통신은 공개 인터넷을 타지 않는다(egress 과금도 없음) ✅

---

## 7. 이후 정리 (검증 통과 후)

- [ ] 2~3일 관찰 (리드 유실·알림·**Railway 요금 실측**)
- [ ] **Neon 프로젝트 삭제** — 관찰 끝난 뒤에만.
      ⚠️ 플랜만 Free 로 내리면 **스토리지 과금($0.35/GB·월)이 남을 수 있다** → 프로젝트 자체를 삭제한다.
      단, 삭제 전에 Step 4 의 덤프 파일을 안전한 곳에 보관해 둘 것(최후의 백업)
- [ ] [application.properties:20-26](../backend/src/main/resources/application.properties:20) Neon 전제 주석 갱신
      — "Neon 싱가포르 왕복이 비싸다", "keepalive가 무료 컴퓨트를 태운다" 전제가 전부 사라진다
- [ ] `APP_DB_KEEPALIVE_MS`·`APP_DB_MIN_IDLE` 재검토 — 내부망은 재수립 비용이 거의 없어 단순화 가능(급하지 않음)
- [ ] ⭐ **VM을 완전히 내리는 날 Railway에서 `APP_LEAD_AUTO_APPROVE_ENABLED=true`** (Step 3에서 VM을 껐으므로 **자동 승인이 지금 아무데서도 안 돈다**)
- [ ] 문서 갱신: 이 파일 상태 · [PROGRESS.md](PROGRESS.md) · [CLAUDE.md](../CLAUDE.md) §2·§6(DB=Neon → Railway) · [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) 남은 일 6번 완료 처리

---

## 8. 위험 요약

| 위험 | 대응 |
|---|---|
| **VM이 덤프 후에도 Neon에 쓴다 → 유실** | Step 3에서 먼저 정지 (필수) |
| PG18 덤프를 하위 버전에 복원 실패 | Step 4의 경로 A/B 분기 |
| 시퀀스가 안 넘어와 PK 충돌 | Step 6 "공개 폼 제출" 테스트로 검출 |
| 스키마 불일치 | `ddl-auto=validate`가 기동 시 자동 차단 |
| 복원 실패 / 성능 악화 | Neon 유지 상태로 환경변수만 롤백 |
| Railway 요금 폭주 | Usage Limit 하드 캡 $25 |
| ⚠️ Step 3~6 사이 공개 폼 다운 | 데이터 0.04GB라 수 분. 광고 트래픽 적은 시간대에 진행 |
