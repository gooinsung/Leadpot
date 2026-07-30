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
| 광고주 상태값 | **고정 5개**: 신규 / 확인 / 통화완료 / 부재 / 종료 |
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
CREATE TABLE advertiser_access_logs (
  id BIGSERIAL PRIMARY KEY,
  advertiser_id BIGINT NOT NULL, form_id BIGINT, lead_id BIGINT,
  action VARCHAR(30) NOT NULL,   -- LOGIN|VIEW_LEAD|EXPORT|STATUS|MEMO|IMPERSONATE
  detail VARCHAR(300), ip VARCHAR(64),
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_adv_logs ON advertiser_access_logs(advertiser_id, at DESC);

-- ⑦ 알림 발송 이력 (분쟁 방어 — §5 참고)
CREATE TABLE notification_logs (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT, form_id BIGINT, recipient_user_id BIGINT,
  channel VARCHAR(20) NOT NULL,  -- TELEGRAM|SHEETS
  success BOOLEAN NOT NULL, error VARCHAR(300),
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_logs_lead ON notification_logs(lead_id);
```

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
PATCH /api/advertiser/leads/{id}/status       상태변경 (고정 5개)
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
| **A4** 내보내기·감사 | 엑셀/CSV(배정분만) / 감사 로그 전 액션 / 다운로드 추적·워터마크·횟수 제한 | 다운로드 후 로그 기록 / 제한 초과 거부 / 마케터 화면에 이력 표시 |
| **A5** 알림 | 텔레그램 대상 확장 / 광고주 메시지 정제 / `notification_logs` | 제출 1건 → 마케터·광고주 양쪽 수신 + 이력 2행 |
| **A6** 대시보드·실시간 | 미확인 배너 / 폴링 갱신 / 간단 통계 | 새 리드 자동 등장 / 배너 카운트 정확 |
| **A7** 부가 | 처리속도 리포트 / 리포트 다운로드(엑셀·인쇄PDF) / 화이트라벨 / 미리보기(읽기전용) | 지표 계산 검증 / 미리보기에서 쓰기 차단 확인 |

- **A1이 가장 위험**하다(기존 인증·스키마 수정). 여기서 마케터 전체 기능 회귀 스모크를 충분히 하고 넘어간다.
- **A1~A5 = 사용자 요청 코어.** A6·A7은 부가라 중간에 멈춰도 서비스가 성립한다.
- 각 단계 완료 시 `main` 병합·푸시 + `PROGRESS.md` 갱신 (사용자 지시 2026-07-25).

---

## 9-B. 실행 체크리스트 ⭐ (이어받기용 — 여기가 진행상황 정본)

> **규칙**: 작업을 시작·중단·완료할 때마다 **이 체크리스트를 갱신하고 커밋**한다.
> 다른 PC·다른 세션은 git pull 후 **이 표에서 체크 안 된 첫 항목**부터 이어서 하면 된다.
> 상태: `[ ]` 예정 · `[~]` 진행중 · `[x]` 완료 · `[-]` 건너뜀(이유 병기)

### A1. 기반 · 보안 골격  — 상태: ⬜ 예정
- [ ] `Role` enum 에 `ADVERTISER` 추가 (USER=마케터 유지, 리네임 안 함)
- [ ] `V18__advertiser_portal.sql` 작성 — §3 전체(users 확장 · invites · grants · leads 3컬럼 · lead_notes.visibility · access_logs · notification_logs)
- [ ] `users.subdomain` NOT NULL 해제 + `Subdomains`·`PublicSiteController`·가입로직 null 영향 점검
- [ ] 커스텀 `JwtAuthenticationConverter` — `role` 클레임 → `ROLE_*` authority (없으면 hasAuthority 가 항상 실패)
- [ ] `SecurityConfig` 경로 화이트리스트 (`/api/advertiser/**`=ADVERTISER, `/api/**`=USER)
- [ ] refresh 시 DB `active`·`parent_user_id` 재확인 (권한 회수 즉시 반영)
- [ ] 광고주 액세스 토큰 수명 단축
- [ ] 백엔드 `test`+`build` / 프론트 `tsc -b`+prod 빌드 통과
- [ ] **V18 Neon 적용** + Flyway validate 통과 (⚠️ 공유 DB·되돌리기 어려움 — 적용 전 재검토)
- [ ] **회귀 스모크(필수)**: 마케터 로그인·폼CRUD·랜딩·공개폼 제출·리드목록/상태/엑셀·통계·연동 전부 정상
- [ ] 검증: 광고주 role 토큰으로 `/api/forms`·`/api/leads`·`/api/landings` **403**
- [ ] `main` 병합·푸시 + `PROGRESS.md`·이 체크리스트 갱신

### A2. 마케터 — 광고주 관리  — 상태: ⬜ 예정
- [ ] 패키지 `com.leadpot.advertiser` 생성 (엔티티·리포지토리·서비스·컨트롤러·DTO)
- [ ] 초대 발급 `POST /api/advertisers/invites` (토큰 **해시 저장**, 만료일)
- [ ] 초대 조회·취소 / 공개 수락 API 2개 (`/api/public/advertiser-invites/{token}`)
- [ ] 초대 수락 → 광고주 계정 생성(role=ADVERTISER, parent_user_id, active)
- [ ] 광고주 목록·수정·정지/해제·삭제(grant 연쇄)
- [ ] grant 부여/회수 `PUT /api/advertisers/{id}/grants` + **1폼:1광고주 위반 시 409**
- [ ] 플랜별 광고주 수 상한 검사 (`users.plan` 연동)
- [ ] 프론트 `/advertisers` 페이지 — 목록·초대모달(링크 복사)·권한부여 화면
- [ ] 권한부여 화면에 **제3자 제공 확인 문구**(동의문서 연결)
- [ ] TopBar 내비에 "광고주" 추가
- [ ] 검증: 초대→수락→로그인 / 이미 붙은 폼 재부여 거부 / 상한 초과 거부 / 타 마케터 광고주 접근 404
- [ ] `main` 병합·푸시 + 문서 갱신

### A3. 광고주 포털 코어  — 상태: ⬜ 예정
- [ ] `requireGrant(advertiserId, formId)` 단일 관문 구현 (grant·만료·active·소속 일치)
- [ ] `AdvertiserLeadResponse` 신설 — 화이트리스트 필드만 (§4-③)
- [ ] `/api/advertiser/me`·`/forms`·`/leads`(페이징 상한)·`/leads/{id}`
- [ ] 상세 조회 시 `advertiser_seen_at` 최초 1회 기록
- [ ] 상태변경 `PATCH .../status` — 고정 5개(신규/확인/통화완료/부재/종료) 값 검증
- [ ] 메모 조회·작성 (`visibility=ALL` 만 노출, 광고주 작성분은 ALL)
- [ ] 프론트 `/client/*` 라우트 + role 기반 리다이렉트 + 마케터 내비 은폐
- [ ] 광고주 리드 목록(카드형·검색·필터) / 상세(`tel:` 전화버튼·상태·메모) — **모바일 우선(375px)**
- [ ] 마케터 리드 목록에 **"광고주 확인" 배지** + "미확인만 보기" 필터
- [ ] 검증: 부여 폼만 노출·미부여 **404** / 응답 JSON 에 ip·utm·device·tags **부재 확인** / DELETE 엔드포인트 부재
- [ ] `main` 병합·푸시 + 문서 갱신

### A4. 내보내기 · 감사 로그  — 상태: ⬜ 예정
- [ ] `POST /api/advertiser/leads/export` — 기존 `LeadExcelService` 재사용(배정분만)
- [ ] 내보내기 파일 하단 워터마크(광고주 이메일·일시)
- [ ] 일일 내보내기 횟수·건수 제한
- [ ] `advertiser_access_logs` 기록 — LOGIN·VIEW_LEAD·EXPORT·STATUS·MEMO
- [ ] 마케터 화면 활동 이력 탭 (`GET /api/advertisers/{id}/logs`)
- [ ] 검증: 다운로드 후 로그 1행 / 제한 초과 거부 / 워터마크 확인
- [ ] `main` 병합·푸시 + 문서 갱신

### A5. 알림 확장  — 상태: ⬜ 예정
- [ ] `NotificationService` 발송 대상 목록화 (마케터 + grant 광고주들)
- [ ] 광고주 메시지 정제 — `display_name`, UTM/IP 제외, 중복문구 제외, 상세 딥링크
- [ ] `notification_logs` 기록 (성공/실패·채널·수신자)
- [ ] 광고주 연동 화면 `/client/integrations` (텔레그램 토큰·채팅ID + 폼별 on/off)
- [ ] 검증: 공개 폼 제출 1건 → 마케터·광고주 양쪽 수신 + 로그 2행 / 광고주 메시지에 IP·UTM 없음
- [ ] `main` 병합·푸시 + 문서 갱신

### A6. 광고주 대시보드 · 실시간  — 상태: ⬜ 예정
- [ ] `GET /api/advertiser/dashboard` (미확인 건수·오늘 접수·상태 분포)
- [ ] 대시보드 화면 + **미확인 리드 경고 배너**
- [ ] `GET /api/advertiser/leads/updates?since=` + 프론트 폴링(30초) 자동 갱신
- [ ] 검증: 새 리드 자동 등장 / 배너 카운트 정확 / 폴링이 서버 부하 유발 안 함
- [ ] `main` 병합·푸시 + 문서 갱신

### A7. 부가 기능  — 상태: ⬜ 예정
- [ ] 처리속도 리포트 (접수→최초열람, 접수→첫 상태변경, 미확인율) — 마케터·광고주 양쪽
- [ ] 리포트 화면 + 엑셀 다운로드 + `@media print` 인쇄 PDF (서버 PDF 미도입 — §8)
- [ ] 화이트라벨 (마케터 `brand_logo_url`·`brand_color` → 광고주 화면 적용)
- [ ] 광고주 화면 미리보기(impersonate) — **읽기 전용 강제** + IMPERSONATE 로그
- [ ] 검증: 지표 수치 실측 검증 / 미리보기에서 상태변경·메모 차단 확인
- [ ] `main` 병합·푸시 + 문서 갱신

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
