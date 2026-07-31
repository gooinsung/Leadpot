# docs/ADVERTISER-PORTAL-PLAN.md — 광고주 하위계정 포털 실행 계획

> **상태: 설계 확정 (2026-07-30). 착수 = A1부터.**
> 이 문서가 광고주 기능의 **정본**이다. [MULTI-PORTAL-PLAN.md](MULTI-PORTAL-PLAN.md)의 "리드 거래 플랫폼" 모델은 **검토 후 보류**로 전환됐다(이유는 §11).
> 착수 전 CLAUDE.md §0 "Phase 착수 전 필수 절차"대로 재검증한다.

---

## 1. 서비스 전체 그림 (사용자 확정 2026-07-30)

Leadpot을 **DB마케팅 종합 서비스**로 넓히고, 그 안에서 도메인별로 역할을 나눈다.

```
Leadpot = DB마케팅 종합 서비스
├─ app.lead-pot.com  (현재) 마케터 포털
│    ├─ 마케터: 랜딩·리드폼 제작, 광고 집행, 리드 수집·관리
│    └─ 광고주 하위계정(/client/*): 지정된 리드폼의 리드만 열람·간단관리·텔레그램 알림
└─ (추후, 별도 도메인) 광고주가 마케터를 모집하는 서비스   ← 이번 범위 아님
```

**이번 범위 = 위 트리의 "광고주 하위계정"**. 광고주는 리드팟의 독립 고객이 아니라 **마케터가 만들고 관리하는 게스트 계정**이다.

### 관계 구조 (확정)
- **1 마케터 : N 광고주**
- **1 광고주 : N 리드폼** (단, 소속 마케터 1명의 리드폼만)
- **1 리드폼 : 1 광고주** — DB UNIQUE 제약으로 강제

---

## 2. 확정 결정 표

| 항목 | 확정 내용 |
|---|---|
| 광고주 포털 주소 | **`app.lead-pot.com/client/*`** (같은 SPA에 라우트 추가. 배포 구조·CI/CD 그대로) |
| 계정 생성 방식 | **초대 링크** (마케터가 링크 발급 → 카톡 등으로 전달 → 광고주가 직접 비번 설정) |
| 광고주 권한 | 열람 · **상태변경** · 메모 · 엑셀 내보내기 |
| 광고주 **금지** | 삭제·휴지통·복원·영구삭제·가져오기·태그편집·폼/랜딩 조회·다른 광고주 존재 인지 |
| 공개 시점 제한 | **없음** (권한 부여 시 그 폼의 리드 전체 열람. `visible_from` 개념 폐기) |
| 광고주 상태값 | **고정 6개**: 신규 / 확인 / 통화완료 / 부재 / **전환** / 종료 (전환 = 실제 판매 성사) |
| 연락처 마스킹 | **없음 (전체 공개)** — 광고주 본업이 전화 영업. 유출 방어는 감사로그·다운로드추적·워터마크로 |
| 광고주 미노출 정보 | UTM · IP · 디바이스/OS/브라우저 · referer · 태그 · 마케터 status · 내부 폼명 |
| `lead_notes` | `visibility` 추가. **기존 메모 전부 `MARKETER_ONLY`로 백필**(과거 내부 메모 보호) |
| 폼 별칭 | `display_name` — 광고주에게 내부 폼명 대신 표시 |
| 광고주 계정 수 | **플랜(`users.plan`)에 연동** — 유료화 레버 |
| 확인 마크 | 광고주가 리드를 열면 마케터 목록에 "광고주 확인" 배지 |
| 미확인 리마인드 | 광고주 **대시보드 배너**로 표시 |
| 처리속도 리포트 | 포함 (접수→열람, 접수→상태변경) |
| 주간 리포트 | **1차: 화면 + 엑셀/PDF 다운로드** → **추후 구독 시 메일·문자 자동발송** |
| 실시간 갱신 | 포함 (폴링) |
| 화이트라벨 | 포함 (마케터 로고·색상을 광고주 화면에 적용) |
| 광고주 미리보기 | 포함 (**읽기 전용**) |
| 불량 리드 표시(반려) | **패스** (이번 범위 제외) |
| 보안 방침 | **최대 보수적** — §4 |

---

## 3. 데이터 모델 — Flyway **V18** (현재 V17까지 적용)

```sql
-- ① 계정 확장
-- Role enum: USER, ADMIN → USER, ADVERTISER, ADMIN   (USER = 마케터. 리네임 안 함: 백필·전면수정 대비 실익 없음)
ALTER TABLE users ALTER COLUMN subdomain DROP NOT NULL;            -- 광고주는 공개페이지 없음
ALTER TABLE users ADD COLUMN parent_user_id BIGINT REFERENCES users(id);  -- 소유 마케터(광고주만)
ALTER TABLE users ADD COLUMN company VARCHAR(120);
ALTER TABLE users ADD COLUMN memo    VARCHAR(500);                 -- 마케터 내부 메모
ALTER TABLE users ADD COLUMN active  BOOLEAN NOT NULL DEFAULT TRUE;
-- 화이트라벨(마케터 계정에 저장)
ALTER TABLE users ADD COLUMN brand_logo_url VARCHAR(500);
ALTER TABLE users ADD COLUMN brand_color    VARCHAR(20);
CREATE INDEX ix_users_parent ON users(parent_user_id);

-- ② 초대
CREATE TABLE advertiser_invites (
  id BIGSERIAL PRIMARY KEY,
  marketer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(120), company VARCHAR(120),
  token_hash VARCHAR(100) NOT NULL UNIQUE,      -- ⚠️ 토큰 원문 저장 금지(해시만)
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ, created_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ③ 권한 = 단일 출처
CREATE TABLE advertiser_form_grants (
  id BIGSERIAL PRIMARY KEY,
  advertiser_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  form_id       BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  display_name  VARCHAR(120),         -- 광고주에게 보일 폼 이름
  expires_at    TIMESTAMPTZ,          -- 계약 종료 시 자동 차단
  can_status BOOLEAN NOT NULL DEFAULT TRUE,
  can_memo   BOOLEAN NOT NULL DEFAULT TRUE,
  can_export BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_id)                    -- ⭐ 1 리드폼 : 1 광고주 강제
);
CREATE INDEX ix_grants_advertiser ON advertiser_form_grants(advertiser_id);

-- ④ 광고주 처리 상태 (마케터 status 와 분리 — 덮어쓰기 사고 방지)
ALTER TABLE leads ADD COLUMN advertiser_status    VARCHAR(30);
ALTER TABLE leads ADD COLUMN advertiser_status_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN advertiser_seen_at   TIMESTAMPTZ;   -- 확인 마크 + 처리속도 재료
CREATE INDEX ix_leads_adv_seen ON leads(form_id, advertiser_seen_at);

-- ⑤ 메모 가시성
ALTER TABLE lead_notes ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'MARKETER_ONLY';
UPDATE lead_notes SET visibility = 'MARKETER_ONLY';   -- 과거 마케터 내부 메모 보호
-- MARKETER_ONLY = 마케터만 / ALL = 마케터+광고주 공유

-- ⑥ 감사 로그
-- ⚠️ 일부러 FK 를 걸지 않는다: 감사 로그는 append-only 이력이라 광고주 계정을 삭제해도 남아야 한다
--    (cascade 로 함께 지워지면 감사 기능이 무의미해진다). 계정 삭제 후 식별용으로 이메일 스냅샷 보관.
CREATE TABLE advertiser_access_logs (
  id BIGSERIAL PRIMARY KEY,
  advertiser_id BIGINT NOT NULL, advertiser_email VARCHAR(255),
  form_id BIGINT, lead_id BIGINT,
  action VARCHAR(30) NOT NULL,   -- LOGIN|VIEW_LEAD|EXPORT|STATUS|MEMO|IMPERSONATE
  detail VARCHAR(300), ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_adv_logs ON advertiser_access_logs(advertiser_id, created_at DESC);

-- ⑦ 알림 발송 이력 (분쟁 방어 — §5 참고). 같은 이유로 FK 없음.
CREATE TABLE notification_logs (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT, form_id BIGINT, recipient_user_id BIGINT,
  channel VARCHAR(20) NOT NULL,  -- TELEGRAM|SHEETS
  success BOOLEAN NOT NULL, error_message VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_notif_logs_lead ON notification_logs(lead_id, created_at);
```

> **컬럼명 주의(실제 V18 기준)**: 로그 테이블 시각 컬럼은 `at` 이 아니라 **`created_at`**(나머지 테이블과 통일 +
> `at` 은 SQL 키워드와 혼동 여지). 오류 문자열은 `error` 대신 **`error_message`**.
> `advertiser_invites.created_user_id` 는 **`ON DELETE SET NULL`** — 지정하지 않으면 FK 가 광고주 삭제를 막는다.

---

## 4. 보안 설계 (사용자 지시: 최대 보수적)

### 원칙 = **화이트리스트 · 이중 차단 · 기능 부재**

**① 경로 화이트리스트 (deny by default)**
```java
.requestMatchers("/api/advertiser/**").hasAuthority("ROLE_ADVERTISER")
.requestMatchers("/api/**").hasAuthority("ROLE_USER")   // 광고주는 나머지 전부 차단
```
새 마케터 API가 추가돼도 광고주에게 자동 차단된다. 반대 방식(금지 목록 열거)은 API 추가마다 구멍이 생긴다.

**② 삭제 기능을 아예 구현하지 않는다**
`/api/advertiser/**`에 DELETE 엔드포인트를 **하나도 만들지 않는다.** 권한 플래그로 막는 게 아니라 **코드가 존재하지 않는 것**이 최강 방어. 휴지통·복원·영구삭제·리드 가져오기·태그 편집 동일.

**③ 응답 DTO를 별도 신설 — `AdvertiserLeadResponse`** ⭐
기존 `LeadResponse` 재사용 금지. 재사용하면 **나중에 필드가 추가될 때 자동으로 광고주에게 유출**된다. 필요한 필드만 명시적으로 나열한다.

| 포함 | 제외 (절대 노출 금지) |
|---|---|
| id, answers(공개항목만), createdAt, advertiserStatus, advertiserSeenAt, duplicate여부 | submitterIp, device, os, browser, language, referer, utm, tags, status(마케터용), landingPageId, 내부 폼명, deletedAt |

**④ 서비스 레이어 단일 관문 — `requireGrant(advertiserId, formId)`**
광고주의 모든 조회가 이 메서드를 통과한다. 여기서 한 번에 검증:
grant 존재 · `expires_at` 미경과 · 광고주 `active=true` · 소속 마케터 일치 · 폼 소유자 일치.
컨트롤러에서 우회 불가하게 서비스에서만 리포지토리를 호출한다.

**⑤ 토큰 즉시 무효화**
`role`은 JWT에 이미 포함되지만([JwtService](../backend/src/main/java/com/leadpot/common/security/JwtService.java)) `active=false`로 바꿔도 기존 액세스 토큰은 만료까지 유효하다.
→ refresh 시 DB의 `active`·`parent_user_id` 재확인. 광고주 액세스 토큰 수명은 마케터보다 짧게.

**⑥ 대량 유출 방어**
- 목록 조회 페이지 크기 **상한 강제**(예: 100)
- 엑셀 내보내기 **일일 횟수·건수 제한** + 전 건 감사 로그
- 내보내기 파일 하단에 `다운로드: {광고주 이메일} / {일시}` 워터마크 → 유출 시 출처 특정

**⑦ 미리보기(impersonate)는 읽기 전용**
마케터가 광고주 화면을 볼 때 상태변경·메모 차단. 안 그러면 감사 로그가 오염되어 §5의 증거 가치가 사라진다. 진입·이탈 모두 로그.

### ⚠️ 놓치기 쉬운 기술 함정 3개 (실제 코드 확인함)

1. **Spring Security는 `role` 클레임을 권한으로 자동 매핑하지 않는다.** 기본 `JwtAuthenticationConverter`는 `scope`/`scp`만 읽으므로 `hasAuthority("ROLE_ADVERTISER")`가 **조용히 항상 실패**한다. → 커스텀 컨버터 등록 필수.
2. **`users.subdomain`이 현재 NOT NULL UNIQUE** → 광고주 생성이 실패한다. `DROP NOT NULL` + `Subdomains`·`PublicSiteController`의 null 처리 확인 필요.
3. **초대 토큰은 해시로만 저장** — 평문 저장 시 DB 유출로 계정 탈취 가능.

### 참고: 기존 API는 이미 자동으로 안전하다
현재 리드 API는 모든 진입점이 `formService.get(ownerId, formId)`로 소유권을 검사한다([LeadService](../backend/src/main/java/com/leadpot/lead/LeadService.java)). 광고주 토큰으로 `/api/leads?formId=5`를 호출하면 소유자 불일치로 404가 난다. 그래도 ①의 role 차단을 **추가로** 둔다(이중 방어).

---

## 5. 분쟁 방어 — "근거 없이 흠 잡는" 상황 대비

사용자 우려: *"광고주가 우리 DB를 무단으로 지우거나 근거없이 흠을 잡을 수 있으니까."*

- **무단 삭제** → §4-② 기능 부재로 원천 차단.
- **근거 없는 클레임**("리드 안 왔다 / 알림 못 받았다 / 품질이 나쁘다") → 아래 3종 기록으로 반박한다.

| 기록 | 어디 |
|---|---|
| 리드 접수 시각 | `leads.created_at` (기존) |
| 알림 발송 시각·성공여부 | `notification_logs` (신규) |
| 광고주 최초 열람 시각 | `leads.advertiser_seen_at` + `advertiser_access_logs` (신규) |

현재 `NotificationService`는 발송 실패를 `log.warn`으로만 남겨 DB에 증거가 없다. `notification_logs`를 추가하면:

> "14:02 접수 → 14:02 텔레그램 발송 성공 → 14:47 열람 → 전화는 그 이후"

가 데이터로 증명된다. **마케터를 보호하는 가장 실질적인 장치**다.

---

## 6. API

### 6-A. 마케터용 `/api/advertisers`
```
GET    /api/advertisers                        광고주 목록(폼 수·마지막 로그인·미확인 건수)
POST   /api/advertisers/invites                초대 발급 → 링크 반환(전달용)
GET    /api/advertisers/invites                대기 중 초대 목록
DELETE /api/advertisers/invites/{id}           초대 취소
PUT    /api/advertisers/{id}                   정보 수정(이름·회사·내부메모)
PATCH  /api/advertisers/{id}/active            정지 / 해제
DELETE /api/advertisers/{id}                   광고주 삭제(grant 연쇄 삭제)
GET    /api/advertisers/{id}/grants            권한 현황
PUT    /api/advertisers/{id}/grants            권한 부여 / 회수
GET    /api/advertisers/{id}/logs              접속·열람·다운로드 이력
GET    /api/advertisers/{id}/preview-token     광고주 화면 미리보기(읽기전용) 진입
GET    /api/advertisers/reports/response-time  처리속도 리포트
GET/PUT /api/advertisers/brand                 화이트라벨(로고·색상)
```

### 6-B. 공개(초대 수락) `/api/public/advertiser-invites`
```
GET  /api/public/advertiser-invites/{token}    초대 유효성 + 회사명 확인
POST /api/public/advertiser-invites/{token}    비번 설정 → 계정 생성 → 로그인
```

### 6-C. 광고주용 `/api/advertiser/**` — 별도 컨트롤러, **DELETE 엔드포인트 없음**
```
GET   /api/advertiser/me                      프로필 + 소속 마케터 브랜드
GET   /api/advertiser/forms                   권한 받은 폼 목록(display_name)
GET   /api/advertiser/dashboard               미확인 건수·오늘 접수·상태 분포
GET   /api/advertiser/leads?formId=&...       목록(페이징 상한 강제)
GET   /api/advertiser/leads/updates?since=    실시간 폴링(신규분만)
GET   /api/advertiser/leads/{id}              상세 (+ seen_at 최초 1회 기록, VIEW_LEAD 로그)
PATCH /api/advertiser/leads/{id}/status       상태변경 (고정 6개)
GET   /api/advertiser/leads/{id}/notes        메모(visibility=ALL 만)
POST  /api/advertiser/leads/{id}/notes        메모 작성
POST  /api/advertiser/leads/export            엑셀/CSV (+ EXPORT 로그·워터마크)
GET/PUT /api/advertiser/integrations          텔레그램 설정
GET   /api/advertiser/reports                 기간 리포트(화면 + 엑셀)
```

### 재사용 자산
`LeadExcelService`(xlsx 전체 텍스트 서식 · CSV UTF-8 BOM), 내보내기 `columns`/`ids` 파라미터, 중복 판정 로직, `com.leadpot.stats` 집계 — **스코프만 교체해서 그대로 사용**.

---

## 7. 화면

### 7-A. 마케터 — `/advertisers` (신규)
- 광고주 목록: 회사·이메일·부여 폼 수·마지막 로그인·**미확인 리드 수**·상태
- **초대 발급 모달** → 링크 복사 카드(카톡 전달용)
- **권한 부여 화면**: 내 리드폼 체크박스 + 폼별 옵션(별칭·만료일·상태변경/메모/엑셀)
  - ⚠️ 이미 다른 광고주가 붙은 폼은 **선택 불가**(1:1 제약)
  - ⚖️ **제3자 제공 확인 문구**: 리드를 광고주에게 보여주는 것은 개인정보 **제3자 제공**이다. 해당 폼의 동의문서에 제공받는 자가 명시됐는지 확인시킨다(기존 동의문서 기능 연결)
- 활동 이력 탭 / 처리속도 리포트 탭
- **리드 목록에 "광고주 확인" 배지** + "광고주 미확인만 보기" 필터
- 플랜 상한 도달 시 초대 버튼 비활성 + 업그레이드 안내

### 7-B. 광고주 — `/client/*` (**모바일 퍼스트**, 마케터 내비 완전 은폐)
로그인 후 `role=ADVERTISER`면 `/client/dashboard`로 리다이렉트.

- **대시보드**: `⚠️ 확인하지 않은 리드 N건` 배너(탭 → 목록) · 오늘 접수 · 상태 분포
- **리드 목록**: 폼 선택 → 카드형, 검색·상태·기간 필터, 신규 배지, **폴링 자동 갱신**
- **리드 상세**: 답변 전체 + **`tel:` 전화 버튼**(핵심 동선) + 상태 변경 + 메모
- **엑셀 다운로드**: 기존 컬럼선택 UI 재사용
- **알림 설정**: 텔레그램 봇 토큰·채팅ID + 폼별 on/off
- **리포트**: 기간 선택 → 화면 표시 + 엑셀 / PDF 저장
- 상단에 소속 마케터 로고·색상(화이트라벨)

> 광고주 핵심 동선: **텔레그램 알림 → 탭 → 리드 상세 → 전화.** 이 4스텝을 모바일에서 최우선 최적화한다.

---

## 8. 알림 · 리포트

### 텔레그램 확장
`NotificationService.notifyNewLead()`의 발송 대상을 목록화한다:
```
1) 폼 소유 마케터            (기존 동작 유지)
2) 그 폼의 grant 광고주       (active + 미만료 + 본인 telegramEnabled)
```
`integration_settings`가 이미 **계정당 1행**이라 광고주 계정도 자기 행을 그대로 쓴다 → **구조 변경 불필요**.
커밋 후 비동기 · 예외 삼킴(best-effort) 패턴 유지. 결과는 `notification_logs`에 기록.

광고주용 메시지 차이:
- 내부 폼명 대신 `display_name`
- UTM·IP 제외
- "중복 의심" 문구 제외(마케터 내부 판단)
- 리드 상세 딥링크 첨부

⚠️ 폼 1건 제출에 발송이 N+1건이 된다. 현재 스레드풀 크기가 2이므로 광고주가 늘면 지연 가능 — 지금 규모에서는 문제없지만 인지해 둔다.

### 리포트 — PDF는 서버 생성 대신 **브라우저 인쇄** 권장
서버 PDF는 한글 폰트 임베딩이 필수이고, iText는 AGPL(상업용 유료), OpenPDF는 LGPL로 라이선스·의존성·폰트 파일이 모두 따라온다.
→ **프론트에서 HTML 리포트 렌더 → `@media print` CSS → 브라우저 인쇄로 PDF 저장.** 한글 문제 없음(Pretendard 사용 중), 의존성 0.
→ 엑셀은 기존 Apache POI로 즉시 가능.
→ 추후 **구독(메일·문자 자동발송)** 단계에서 서버 렌더가 필요해지면 그때 도입한다.

---

## 9. 단계 나누기 (실행 순서)

| 단계 | 내용 | 완료 검증 |
|---|---|---|
| **A1** 기반·보안 골격 | V18 마이그레이션 / Role 확장 / **role→authority 컨버터** / 경로 화이트리스트 / subdomain nullable / refresh 시 active 재확인 | 광고주 토큰으로 `/api/forms`·`/api/leads`·`/api/landings` **전부 403** · 마케터 기존 기능 회귀 없음 |
| **A2** 마케터 광고주 관리 | 초대 발급·수락·계정 생성 / 목록·수정·정지·삭제 / grant 부여(1:1 제약·별칭·만료) / 플랜 상한 | 초대→수락→로그인 성공 / 이미 붙은 폼 재부여 거부 / 플랜 상한 초과 거부 |
| **A3** 광고주 포털 코어 | `AdvertiserLeadResponse` / 폼·리드 목록·상세 / 상태변경(고정5) / 메모(visibility) / **seen_at + 확인 배지** / 모바일 | 부여 폼만 노출·미부여 404 / 응답에 IP·UTM **부재 확인** / 마케터 목록에 확인 배지 |
| **A4** 내보내기·감사 ✅ | 엑셀/CSV(배정분·화이트리스트 컬럼) / EXPORT 감사 로그 / 워터마크 / 일일 20회 상한 / 마케터 활동이력 모달 | `AdvertiserExportTest` 5개 통과 · 컬럼에 IP·UTM 없음 확인 |
| **A5** 알림 ✅ | 텔레그램 대상 확장 / 광고주 메시지 정제 / `notification_logs` / `/client/integrations`(계정 단위) | `planDispatches` 대상 선정 테스트 7개 통과 · 실수신은 사용자 봇 필요 |
| **A6** 대시보드·실시간 ✅ | 미확인 배너(A3) / **30초 폴링**(updates 엔드포인트) / 유휴 자동갱신·아니면 새로고침 배너 | `AdvertiserUpdatesTest` 4개 통과 · 화면 안 흔들고 새 리드 감지 |
| **A7** 부가 ✅ | 처리속도 리포트(양쪽·인쇄PDF) / 화이트라벨 UI / 미리보기(읽기전용·IMPERSONATE) | 리포트/브랜드/미리보기 테스트 통과 · 미리보기 seen 미기록 확인 |

- **A1이 가장 위험**하다(기존 인증·스키마 수정). 여기서 마케터 전체 기능 회귀 스모크를 충분히 하고 넘어간다.
- **A1~A5 = 사용자 요청 코어.** A6·A7은 부가라 중간에 멈춰도 서비스가 성립한다.
- 각 단계 완료 시 `main` 병합·푸시 + `PROGRESS.md` 갱신 (사용자 지시 2026-07-25).

---

## 9-A. 단계 완료 보고 형식 (사용자 확정 2026-07-30)

각 단계(A1~A7)를 끝낼 때마다 사용자에게 **아래 3종 세트**를 준다. 파일명·클래스명 나열은 금지(필요하면 맨 뒤에 짧게).

1. **무엇을 했는지 — 쉬운 말 요약** (기능·효과 중심)
2. **직접 확인할 항목** — "어디서 무엇을 눌러 무엇을 확인"
3. **확인할 URL** — 로컬 `http://localhost:5173/...` / 라이브 `https://app.lead-pot.com/...`

- 서버를 띄워야 확인 가능하면 **먼저 띄워두고 URL만 건넨다.**
- **화면이 없는 단계(백엔드 기반 작업)는 "눈에 보이는 게 없다"고 솔직히 말하고**, 대신 확인 가능한 것(기존 기능 회귀 여부 등)을 제시한다. 억지 확인거리를 만들지 않는다.

---

## 9-B. 실행 체크리스트 ⭐ (이어받기용 — 여기가 진행상황 정본)

> **규칙**: 작업을 시작·중단·완료할 때마다 **이 체크리스트를 갱신하고 커밋**한다.
> 다른 PC·다른 세션은 git pull 후 **이 표에서 체크 안 된 첫 항목**부터 이어서 하면 된다.
> 상태: `[ ]` 예정 · `[~]` 진행중 · `[x]` 완료 · `[-]` 건너뜀(이유 병기)

### A1. 기반 · 보안 골격  — 상태: ✅ 완료 (`main` 병합·푸시)
- [x] `Role` enum 에 `ADVERTISER` 추가 (USER=마케터 유지, 리네임 안 함)
- [x] `V18__advertiser_portal.sql` 작성 — §3 전체(users 확장 · invites · grants · leads 3컬럼 · lead_notes.visibility · access_logs · notification_logs)
- [x] `users.subdomain` NOT NULL 해제 (엔티티 nullable) + 예약어에 `client`/`advertiser`/`partner` 추가
- [x] 커스텀 `JwtAuthenticationConverter` — `role` 클레임 → `ROLE_*` authority (없으면 hasAuthority 가 항상 실패)
- [x] `SecurityConfig` 경로 화이트리스트 (`/api/advertiser/**`=ADVERTISER, `/api/**`=USER·ADMIN, `/api/auth/me`=공통)
- [x] refresh·login 시 DB `active` 재확인 (정지 계정 즉시 차단)
- [x] 광고주 액세스 토큰 수명 단축 (`app.jwt.advertiser-access-ttl-seconds`, 기본 900초)
- [x] `User` 엔티티 확장 + `User.advertiser(...)` 정적 팩터리
- [x] **인가 테스트 신설** `AdvertiserAccessControlTest` (6케이스: 광고주→마케터API 403 / 마케터→자기API 200 / `/me` 공통 / 마케터→광고주영역 403 / 광고주→서브도메인 403 / 익명 401)
- [x] 백엔드 `test`+`build` 통과(6/6) · 프론트 `tsc -b` 통과
- [x] V18 설계 리뷰 후 보완(감사로그 FK 제거·이메일 스냅샷, invites set null, `created_at`/`error_message` 개명)
- [x] **V18 Neon 적용 완료** — `now at version v18` (PostgreSQL 18.4). 사용자 결정: 아직 오픈 전이라 개발 DB로 취급
- [x] **스키마 실측 검증** — 신규 테이블 4개 / users 신규 컬럼 6개 + subdomain nullable / leads 광고주 3컬럼 /
      `lead_notes.visibility` 기존 5행 전부 `MARKETER_ONLY` 백필 / `uq_advertiser_form_grants_form` UNIQUE 존재 /
      감사로그 FK 0개(설계대로)
- [x] **회귀 스모크 통과** — 가입·로그인·`/me`·폼CRUD·공개폼조회·공개제출·리드목록·상세·상태변경(SYSTEM 이력 한글 정상)·
      태그·휴지통/복원·엑셀(3663B)·통계·연동·서브도메인 변경 전부 정상
- [x] **실서버 인가 검증** — 광고주 계정으로 마케터 API 10종 전부 403 / `/api/auth/me` 200 /
      서브도메인 변경 403 / `expiresIn=900`(광고주 단축 수명 적용)
- [x] **정지 즉시 차단 검증** — `active=false` 후 로그인 401 + 기존 리프레시 토큰 재발급 401
- [x] 테스트용 광고주 계정 삭제 정리(삭제가 FK 에 막히지 않는 것도 함께 확인)
- [x] `main` 병합·푸시 + `PROGRESS.md`·이 체크리스트 갱신

> **DB 운영 방식(사용자 확정 2026-07-30)**: 아직 서비스 오픈 전이므로 Neon 을 **개발 DB로 취급**한다.
> 로컬에서 마이그레이션·테스트를 그대로 적용해도 된다. 오픈 이후에는 개발/운영 분리(Neon 브랜치) 필요.
> 참고: 이 PC 는 Docker Desktop 이 응답하지 않는다(2026-07-30, 12분 대기 후 포기) — 로컬 Postgres 대안은 불가.

### A2. 마케터 — 광고주 관리  — 상태: ✅ 완료 (`main` 병합·푸시)
- [x] 패키지 `com.leadpot.advertiser` 생성 (엔티티 3·리포지토리 3·서비스 4·컨트롤러 2·DTO 8)
- [x] 초대 발급 `POST /api/advertisers/invites` (토큰 256비트 난수, **SHA-256 해시만 저장**, 기본 7일 만료)
- [x] 초대 목록·취소·**재발급**(링크 분실 대응, 이전 링크 즉시 무효) / 공개 수락 API 2개
- [x] 초대 수락 → 광고주 계정 생성(role=ADVERTISER, parent_user_id, active, subdomain=null) + 자동 로그인
- [x] 광고주 목록(부여 폼 수·마지막 접속)·수정·정지/해제·삭제
- [x] grant 부여/회수 `PUT /api/advertisers/{id}/grants` (전체 교체 방식) + **1폼:1광고주 위반 시 409**
- [x] 플랜별 광고주 수 상한 (`app.advertiser.max-free=1`, PRO=무제한). **대기 중 초대도 자리로 계산**(상한 우회 방지)
- [x] LOGIN 감사 로그 + `lastLoginAt` (열람·내보내기 기록은 A3·A4)
- [x] 프론트 `/advertisers` — 목록·초대모달(링크 1회 노출·복사)·대기 초대 표·정보 수정
- [x] `GrantEditor` — 내 리드폼 전체 + 폼별 별칭·만료일·권한 3종, **선점된 폼은 선택 불가(takenBy 표시)**
- [x] 권한부여 화면에 **제3자 제공 확인 문구**
- [x] 초대 수락 화면 `/invite/:token` (모바일 우선) + 역할별 라우팅(`/client`) + 광고주에겐 마케터 내비 숨김
- [x] TopBar 내비에 "광고주" 추가
- [x] **테스트 14개 신설** (`AdvertiserGrantRulesTest` 11 + `AdvertiserLoginAuditTest` 3) — 전체 37개 통과
- [x] **Neon 실측 E2E**: 초대→링크확인→수락(201·role=ADVERTISER·subdomain=null)→재사용 409 /
      FREE 상한 409 / 권한부여(별칭·canExport=false 반영)·grantCount / **1폼:1광고주 409(친절한 메시지)** /
      takenBy 표시 / 광고주 로그인 200·expiresIn=900·마케터 API 403 유지 / lastLoginAt 기록
- [x] `main` 병합·푸시 + 문서 갱신

> 🐛 **A2에서 잡은 버그(기록)**: 감사 로그를 같은 빈 안에서 `this.record()` 로 호출해
> `REQUIRES_NEW` 가 프록시를 거치지 않았다. 그 결과 INSERT 가 로그인의 `readOnly` 트랜잭션에 참여해
> "cannot execute INSERT in a read-only transaction" → 트랜잭션이 rollback-only 로 오염 →
> **광고주 로그인이 401로 실패**. `AdvertiserAuditWriter` 를 별도 빈으로 분리해 해결.
> 트랜잭션이 걸린 테스트에서는 재현되지 않아서, `AdvertiserLoginAuditTest` 는 **의도적으로
> `@Transactional` 을 붙이지 않는다**(붙이면 `readOnly` 가 무력화되어 회귀를 못 잡는다).

### A3. 광고주 포털 코어  — 상태: ✅ 완료 (`main` 병합·푸시)
- [x] `Lead` 엔티티에 V18 컬럼 매핑(`advertiserStatus`/`advertiserStatusAt`/`advertiserSeenAt`),
      `LeadNote` 에 `visibility` 매핑 + `VISIBILITY_MARKETER_ONLY`/`ALL` 상수
- [x] `requireGrant(advertiserId, formId)` **단일 관문** — grant 존재·만료·계정 active·소속 마케터 일치·폼 소유자 일치
- [x] `AdvertiserLeadResponse` 신설 — 6개 필드만(id·answers·createdAt·advertiserStatus·label·seenAt)
- [x] `AdvertiserLeadStatus` 고정 6개(NEW/CONFIRMED/CALLED/NO_ANSWER/**CONVERTED**/CLOSED) + 한글 라벨
      · 상태별 색상 구분(App.css `.st-*` 한 벌을 목록·상세·셀렉트가 공유).
      **브랜드 그린은 '전환'(실제 판매)에만** 사용 — 성과를 한눈에 구분. 통화완료는 신규 `--violet` 토큰
      · ⚠️ `LABELS` 는 `Map.copyOf` 가 아니라 `Collections.unmodifiableMap` 이어야 순서가 보존된다(copyOf 는 순서 미보장)
- [x] `/api/advertiser/me`(화이트라벨)·`/forms`(별칭·미확인수)·`/dashboard`·`/leads`(상한 100)·`/leads/{id}`·
      `/leads/{id}/status`·`/leads/{id}/notes`·`/lead-statuses`
- [x] 상세 조회 시 `advertiser_seen_at` **최초 1회만** 기록 + VIEW_LEAD/STATUS/MEMO 감사 로그
- [x] 메모: 광고주는 `visibility=ALL` 만 조회, 광고주 작성분·광고주 상태변경 이력은 ALL 로 저장
- [x] 프론트 `/client` = `AdvertiserLeadsPage`(A2 임시 홈 대체) + `AdvertiserTopBar`(마케터 내비 없음, 화이트라벨)
- [x] 리드 카드 목록(검색·상태필터·페이징·NEW 강조·**`tel:` 전화버튼**) / 상세 모달(큰 전화버튼·상태칩·메모) — **모바일 우선**
- [x] 미확인 경고 배너(대시보드 카운트 기반) + 폼 선택 칩(미확인 배지)
- [x] 마케터 리드 목록에 **"👁 광고주 확인" 배지** + **"광고주 미확인만"** 필터 + 메모 공유 여부(`sharedWithAdvertiser`)
- [x] **테스트 17개 신설** (`AdvertiserLeadAccessTest`) — 전체 **54개** 통과
- [x] **Neon 실측 E2E**: 부여 폼만 노출·미부여 폼 404 / 응답에 ip·utm·device·tags **부재 확인** /
      **마케터 내부 메모 광고주에게 미노출 확인**(INTERNAL_SECRET 누출 없음) / 상태 CALLED 반영·마케터 status(SPAM) 불변 /
      잘못된 상태값 400 / `DELETE /api/advertiser/leads/{id}` **405(부재)** · `DELETE /api/leads/{id}` **403** /
      최초 열람 시각 1회 고정 / 페이지 상한 100 강제
- [x] **브라우저 실측(375px)**: 마케터 내비 없음 · 별칭 표시 · `tel:` 링크 · 미확인 배너 · 상태칩 · 좌우 스크롤 없음 /
      마케터 화면에 배지·필터 정상
- [x] `main` 병합·푸시 + 문서 갱신

> **A3 설계 메모**
> - 광고주 응답에서 **`consents`(동의 내역)도 제외**했다. 광고주가 마케팅 수신동의 여부를 알면
>   영업에 유용할 수 있으나, 사용자 확정 범위에 없어 넣지 않았다 — 필요하면 별도 논의(동의 항목 단위 노출).
> - **중복 의심 표시도 광고주에게 미노출**(마케터 내부 판단). §8 텔레그램 메시지 규칙과 일관되게 유지.
> - 마케터가 자기 메모를 광고주와 공유하는 **토글은 아직 없다**(현재는 마케터 메모=MARKETER_ONLY 고정,
>   광고주 메모·상태이력만 ALL). 필요하면 후속.

### A3-B. 광고주 전용 로그인 · 비밀번호 복구  — 상태: ✅ 완료 (`main` 병합·푸시)
> A4 착수 전 사용자 요청으로 먼저 진행. **비밀번호 분실 시 복구 경로가 아예 없던 문제**를 함께 해결.

- [x] **`/client/login` 광고주 전용 로그인** — 회원가입 링크 **제거**(가장 큰 문제였음),
      "담당자에게 받은 계정으로 로그인" 문구, 분실 안내는 "담당 마케터에게 재설정 링크 요청"
- [x] 마케터가 실수로 들어와도 에러 없이 `/dashboard` 로 보낸다(`login()` 이 AuthUser 반환하도록 변경)
- [x] `ProtectedRoute` 가 역할별 로그인 화면으로 보낸다(`loginPathFor`) + 광고주 로그아웃 → `/client/login`
- [x] **V19 마이그레이션** `advertiser_password_resets`(토큰 해시만·1회용·기본 48시간)
- [x] 마케터: `POST /api/advertisers/{id}/password-reset` → 링크 1회 노출(모달·복사).
      새로 발급하면 이전 링크 즉시 무효
- [x] 공개: `GET/POST /api/public/advertiser-password-resets/{token}` → 광고주가 직접 새 비번 설정 + 자동 로그인
- [x] 초대 중복 이메일 에러 메시지에 "비밀번호 재설정" 안내 추가(막다른 길 제거)
- [x] **화이트라벨 1단계**: 초대 수락·재설정 시점에 담당 마케터를 기억(`rememberClientBrand`)해
      로그인 화면 제목·브랜드에 표시. 서버 조회 없이 동작(로그인 전에는 소속을 알 수 없으므로)
- [x] **테스트 8개 신설**(`AdvertiserPasswordResetTest`) — 전체 **62개** 통과
- [x] **Neon 실측**: V19 적용 / 발급→링크확인→새비번 설정 200 / 새 비번 로그인 200 · 이전 비번 401 /
      링크 재사용 409 / 광고주 토큰으로 발급 시도 403 / 남의 광고주·마케터 계정 대상 404
- [x] **브라우저 실측**: `/client/login` 회원가입 링크 없음 확인 · 재설정 화면 모바일(16px·좌우스크롤 없음) ·
      브랜드 기억 후 제목이 "A2Marketer 리드 확인" 으로 표시
- [x] `main` 병합·푸시

> **마케터가 임시 비밀번호를 정해주는 방식을 쓰지 않은 이유**: 마케터가 광고주 비밀번호를 알게 되면
> "내가 안 봤다"는 광고주 주장과 감사 로그가 충돌해 §5 분쟁 방어의 증거 가치가 사라진다(초대와 같은 논리).
>
> **남은 한계(기록)**: 비밀번호를 바꿔도 **이미 발급된 리프레시 토큰은 만료까지 유효**하다.
> 완전 무효화에는 `users.token_version` 같은 토큰 버전 필드가 필요하다 — 지금 범위에서는 과하다고 보고 보류.
> (광고주 액세스 토큰 15분 + 계정 정지 시 즉시 차단은 이미 동작한다.)

### A4. 내보내기 · 감사 로그  — 상태: ✅ **완료** (2026-07-31)
- [x] `POST /api/advertiser/leads/export` — 화면 필터(status·q·from·to) 반영, `LeadExcelService.dataXlsx`/CSV 재사용. **광고주 전용 매트릭스**(화이트리스트 컬럼: 접수일시·광고주상태·답변 — **IP·UTM·기기 제외**)
- [x] 내보내기 파일 하단 워터마크(`다운로드: {광고주 이메일} / {일시}`)
- [x] 일일 내보내기 **횟수** 제한 — `app.advertiser.export-daily-max`(기본 20). **건수 제한은 계정 단위 결정으로 생략**(사용자 확정 2026-07-31). `advertiser_access_logs` EXPORT 카운트로 판정(스키마 변경 없음)
- [x] `advertiser_access_logs` 기록 — LOGIN(A2)·VIEW_LEAD·STATUS·MEMO(A3) + **EXPORT(A4)** 완료
- [x] 마케터 화면 활동 이력 탭 (`GET /api/advertisers/{id}/logs`) — `/advertisers` 목록의 **'활동 이력'** 버튼 → 모달(일시·활동·상세·IP)
- [x] 검증: `AdvertiserExportTest` 5개(화이트리스트 컬럼·워터마크·EXPORT 로그·권한없음 차단·일일상한 초과 거부) + 백엔드 전체 통과 / 프론트 빌드 통과
- [ ] `main` 병합·푸시

> **결정 기록**: 일일 제한은 **횟수만**(하루 20회, `APP_ADVERTISER_EXPORT_DAILY_MAX` 로 조정). 건수 제한은 단순화로 생략.
> **내보내기 컬럼 = 화면 화이트리스트 그대로**(IP·UTM·기기 없음). 마케터 `exportMatrix`(IP/UTM 포함)는 재사용하지 않고 광고주 전용 매트릭스 신설.

### A5. 알림 확장  — 상태: ✅ **완료** (2026-07-31)
- [x] `NotificationService` 발송 대상 목록화 (마케터 + grant 광고주) — `planDispatches()` 순수 조회로 분리(테스트 가능)
- [x] 광고주 메시지 정제 — `display_name` 사용, UTM/IP 제외, 중복문구 제외, 리드 상세 딥링크(`/client?form=&lead=`)
- [x] `notification_logs` 기록 (성공/실패·채널·수신자) — `NotificationLog` 엔티티 + `NotificationLogWriter`(REQUIRES_NEW, 비동기 스레드)
- [x] 광고주 연동 화면 `/client/integrations` (텔레그램 토큰·채팅ID + 계정 단위 on/off) — **폼별 세분화는 계정 단위로 결정(사용자 확정 2026-07-31, V20 미생성)**
- [x] 검증: `planDispatches` 대상 선정 테스트 7개(양쪽 수신·만료·정지·폼토글 독립·메시지 정제) / 백엔드 전체 테스트 통과 / 프론트 tsc+prod 빌드
- [ ] `main` 병합·푸시 + 텔레그램 실수신 확인(사용자 봇 필요)

> **결정 기록**: 광고주 폼별 on/off 는 **계정 단위**로 단순화(1 광고주 : 여러 폼이라도 한 스위치). V20 마이그레이션 불필요. `integration_settings` 는 계정(user id)당 1행이라 광고주도 자기 행을 그대로 쓴다.
> **마케터 폼별 토글(`settingsConfig.notifyEnabled`)과 광고주 계정 토글은 독립** — 마케터가 폼 알림을 꺼도 광고주는 자기 설정대로 받는다.
> **딥링크 base** = `app.public-base-url`(`APP_PUBLIC_BASE_URL`, 기본 `https://app.lead-pot.com`).

### A6. 광고주 대시보드 · 실시간  — 상태: ✅ **완료** (2026-07-31)
- [x] `GET /api/advertiser/dashboard` (미확인 건수·오늘 접수·상태 분포) — **A3에서 완료**
- [x] 대시보드 화면 + **미확인 리드 경고 배너** — **A3에서 완료**
- [x] `GET /api/advertiser/leads/updates?formId=&since=` (grant 검증, `{newCount, serverTime}`) + 프론트 **30초 폴링**
- [x] 유휴 상태(1페이지·필터 없음·상세 닫힘)면 **자동 갱신**, 아니면 **'새 리드 N건 · 새로고침' 배너**(보던 화면 안 흔듦). `serverTime` 을 다음 `since` 로 써서 시계 오차 방지. count 쿼리라 부하 작음
- [x] 검증: `AdvertiserUpdatesTest` 4개(기준선·새리드 카운트·미래 since 0·미부여 404) + 백엔드 전체 통과 / 프론트 빌드
- [ ] `main` 병합·푸시

> **설계 기록**: 별도 `updates` 엔드포인트(가벼운 count)로 새 리드만 감지. 프론트는 유휴면 자동 reload, 아니면 배너로만 알림 → **모바일에서 스크롤·입력 중 화면이 튀지 않음**. 기준선(since)은 formId 바뀔 때만 리셋.

### A7. 부가 기능  — 상태: ✅ **완료** (2026-07-31) — 광고주 포털 A1~A7 전부 완료
- [x] **처리속도 리포트** (2026-07-31) — 지표 계산은 `AdvertiserReportResponse.from(leads,...)` 정적 팩토리로 추출해 **광고주·마케터 공용**
  - **광고주 화면**: `GET /api/advertiser/reports?formId=&from=&to=`(폼 1개) + `/client/report`(리드폼·기간·KPI 카드·상태 막대·**`@media print` 인쇄PDF**)
  - **마케터 화면**: `GET /api/advertisers/{id}/reports/response-time`(광고주의 **배정 폼 전체 합산**) + `/advertisers` 목록의 **'리포트' 버튼 → 모달**(KPI·상태 분포)
  - ⚠️ "접수→첫 상태변경"은 `advertiser_status_at`(광고주 전용·최근 변경)으로 계산 — 대부분 1회라 실질 동일. "첫" 정밀값은 향후 필요 시
- [x] **화이트라벨 완성** (2026-07-31) — `GET/PUT /api/advertisers/brand`(로고 URL·색상, #RRGGBB 검증·빈값 해제) + `/advertisers` 상단 **'브랜드 설정' 카드**(로고 업로드·색상 피커·실시간 미리보기). 광고주 화면 읽기·로그인 브랜드 기억은 A3-B에서 완료
- [x] **광고주 화면 미리보기(impersonate)** (2026-07-31) — 마케터측 **읽기 전용** 엔드포인트(`GET /api/advertisers/{id}/preview`·`/preview/leads`·`/preview/leads/{leadId}`, `POST /preview/exit`). 쓰기 매핑을 만들지 않아 **구조적으로 읽기 전용**. 리드 상세는 `leadReadOnly`(seen 미기록)로 **§5 증거 오염 방지**. 진입·이탈 **IMPERSONATE 로그**. 프론트 `/advertisers/:id/preview`(읽기 전용 배너·폼·리드 목록·읽기 전용 상세 모달)
- [x] 검증: `AdvertiserPreviewTest` 4개(**미리보기해도 seen 미기록**·진입 IMPERSONATE·이탈 로그·타마케터 404) + `AdvertiserReportTest` 4개 + `AdvertiserBrandTest` 4개 + 백엔드 전체 통과 / 프론트 빌드
- [x] ✅ **A7 완료 → 광고주 포털 A1~A7 전체 완료**

### 후속(이번 범위 밖, 별도 논의)
- [ ] 구독 기반 리포트 **메일·문자 자동발송** (지금은 다운로드까지만)
- [ ] 광고주 팀 계정 / 외부 CRM 웹훅 / 불량 리드 반려
- [ ] 별도 도메인: "광고주가 마케터를 모집하는 서비스"

---

## 10. 이번 범위에서 제외 (기록용)

- **불량 리드 표시(반려/claim)** — 사용자 판단으로 패스
- **정산·단가·청구** — 이 모델에 없음(§11)
- **광고주 팀 계정**(광고주 회사에 담당자 여러 명) — 나중
- **로그인 없는 공유 링크** — 개인정보 위험으로 채택 안 함
- **외부 CRM 웹훅/API** — 나중
- **구독 기반 리포트 메일·문자 발송** — 리포트 다운로드 다음 단계

---

## 11. 방향 전환 기록 — 왜 "리드 거래 플랫폼"이 아닌가

[MULTI-PORTAL-PLAN.md](MULTI-PORTAL-PLAN.md)의 원안은 리드팟 운영자가 캠페인·단가·정산·반려중재를 관리하는 **리드 유통 마켓플레이스**였다. 2026-07-30 논의로 아래와 같이 정리했다.

세 가지가 서로 다른 사업임을 구분:

| | 주고받는 것 | 이번 결정 |
|---|---|---|
| ① 광고주 열람(위임 공유) | 리드 **공유** (마케터 → 자기 광고주) | ✅ **지금 구현** |
| ② 리드 거래 중개 | 리드 **매매** (플랫폼이 중개) | ❌ 채택 안 함 |
| ③ 마케터 모집 매칭 | **사람·용역** (광고주가 마케터 모집) | 🔜 추후 **별도 도메인** |

- **②를 뺀 이유**: 플랫폼이 개인정보를 중개하는 구조라 규제 리스크가 ③과 비교가 안 된다. 정산·캠페인·반려중재가 전부 여기 딸린 항목이라 함께 제외.
- **①을 먼저 하는 이유**: 양면시장의 콜드스타트를 우회한다. ①을 만들면 **마케터가 자기 광고주를 리드팟에 데려온다** → 광고주 획득 비용 0. 그 광고주들이 상주하는 상태에서 ③을 열면 양쪽 공급이 이미 있다.
- **③에서 리드팟의 강점**: 일반 매칭 플랫폼은 성사 후 당사자끼리 플랫폼 밖에서 거래해 이탈한다. 리드팟은 **실제 업무(리드 수집·전달·확인)가 시스템 안에서 계속 일어나** 이탈 유인이 적다. ①에서 쌓는 리드 데이터·감사 로그가 ③의 **신뢰 인프라**가 된다(마케터 실적 검증, 분쟁 근거).

> 즉 ①은 ③의 준비 단계다. ②는 되돌릴 수 없는 규제 리스크라 열지 않는다.

---

## 12. 참고

- 상위 규칙: [../CLAUDE.md](../CLAUDE.md) · 진행상황: [PROGRESS.md](PROGRESS.md) · 로드맵: [ROADMAP.md](ROADMAP.md)
- 보류된 원안: [MULTI-PORTAL-PLAN.md](MULTI-PORTAL-PLAN.md)
- Flyway 현재 V17 → 이번 작업 **V18**
- DB = Neon 공유(모든 환경 동일 DB) — 마이그레이션은 되돌리기 어려우니 A1 적용 전 검토 필요
