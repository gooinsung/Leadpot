# docs/SPEC.md — 우리 서비스 기능 명세

> 디비카트를 벤치마킹하되 **우리 방식으로 개선**한 설계. 디비카트 실제 구조는 [`DBCART-ANALYSIS.md`](DBCART-ANALYSIS.md), 전체 기능 목록은 [`FEATURES.md`](FEATURES.md) 참고.
> 이 문서는 "우리가 무엇을, 어떤 구조로 만들 것인가"를 정의한다.

## 1. 핵심 개선 설계 (디비카트와 다른 점)

| # | 결정 | 디비카트 | 우리 |
|---|---|---|---|
| D1 | **입력폼을 독립 엔티티로 분리** | 폼이 랜딩에 종속 | **폼을 따로 만들고, 하나의 폼을 여러 랜딩에서 재사용** |
| D2 | **폼 유형(rendering type) 확장 구조** | 단일 형태 | **기본형 / 선택형(스텝) … 유형을 계속 추가 가능** |
| D3 | **휴대폰 본인인증 옵션** | 휴대폰 인증 필드 존재 | **폼 항목에서 본인인증을 선택적으로 ON/OFF** (외부 인증 서비스 연동) |

## 2. 도메인 개념

- **계정(User)**: 로그인 주체. 폼·랜딩·리드를 소유.
- **폼(Form)**: 독립적으로 만드는 입력 양식. **유형(type)** 을 가짐. 여러 랜딩에서 재사용.
- **랜딩페이지(Landing)**: 이미지·텍스트로 구성된 공개 페이지. 폼을 1개 이상 **연결**해서 노출.
- **리드(Lead)**: 방문자가 폼을 제출해 수집된 데이터. "어느 폼 + 어느 랜딩"에서 왔는지 기록.

## 3. 폼 유형 (Form Type) — 확장 가능한 구조

폼은 `form_type` 값과 유형별 설정(JSON)을 가진다. 프론트는 유형별 **렌더러**를 두어, 새 유형 추가 시 렌더러만 붙이면 되게 설계한다.

### 3.1 `BASIC` — 기본형 입력폼
- 모든 입력 항목을 **한 화면에** 표시하는 일반 form.
- **폼 본문 = 블록의 순서 있는 배열.** 입력 항목과 **콘텐츠 블록(이미지·HTML·텍스트·구분선)을 자유롭게 섞어** 배치 가능. (예: 안내 이미지 → 이름 입력 → 설명 HTML → 연락처 입력)
- 동의 체크, 신청 버튼.

### 3.2 `STEP` — 선택형/스텝형 (대화형 퍼널)
> 참고 UX: 법률사무소 은오 "1분 AI 자가진단" (질문 6단계 → 연락처 → 제출)
- CTA 클릭 시 **배경 블러 오버레이 모달**로 표시.
- **진행바("질문 1/6")** + 단계별 화면.
- 각 단계: **질문 + 카드형 선택지**(선택지마다 제목·설명·아이콘/이미지 가능), 단일/다중 선택. 단계 안에도 **콘텐츠 블록(이미지·HTML·텍스트)** 삽입 가능.
- "다음/이전" 으로 이동, 마지막 단계에서 **연락처 입력 + 개인정보 동의 → 제출**.
- (선택) 제출 전/후 **진단 결과 화면** 표시.

### 3.3 이후 추가 예정 유형 (확장 슬롯)
- `POPUP`(단순 팝업 폼), `INLINE_EMBED`(외부 사이트 임베드용), `CHAT`(챗형) 등.
- 추가 방법: `form_type` enum 값 추가 + 유형별 config 스키마 + 프론트 렌더러 컴포넌트.

## 4. 데이터 모델 (PostgreSQL)

```
users
  id, email, password_hash, name, phone, role, plan, created_at

forms                          -- 독립 폼 (재사용)
  id, owner_id → users
  name                         -- 폼 이름(관리용)
  form_type                    -- BASIC | STEP | ... (확장)
  require_phone_verification   -- 휴대폰 본인인증 사용 여부(옵션)
  consent_config_json          -- 약관/개인정보/제3자/광고 수신 동의 설정
  submit_button_json           -- 버튼명/색상
  success_config_json          -- 완료 화면/리다이렉트/결과표시
  type_config_json             -- 유형별 부가설정
  created_at, updated_at

form_blocks                    -- 폼 본문 = 순서 있는 블록 배열 (입력 항목 + 콘텐츠 혼합)
  id, form_id → forms
  step_no                      -- (STEP 유형) 이 블록이 속한 단계. BASIC은 NULL
  sort_order                   -- 블록 순서 (입력/콘텐츠 공통 정렬 공간)
  block_type                   -- FIELD | IMAGE | HTML | TEXT | DIVIDER | SPACER …
  -- block_type=FIELD 일 때:
  field_type                   -- text, tel, phone010, phone_verified, email,
                               --   radio, radio_button, checkbox, select, date,
                               --   address, region, textarea, number, korean, length …
  label, required, unique_check, placeholder
  options_json                 -- radio/select 선택지, validation 규칙
  -- block_type=IMAGE/HTML/TEXT/... 일 때:
  content_json                 -- 이미지 URL, HTML/텍스트 내용, 정렬/스타일 등
  -- (STEP 유형은 이 블록들을 form_steps.step_no로 그룹핑해 단계에 배치)

form_steps                     -- STEP 유형 전용: 단계별 질문
  id, form_id → forms
  step_no, question, description
  select_type                  -- single | multi
  options_json                 -- 카드 선택지 배열: {label, desc, image, value}

landing_pages
  id, owner_id → users
  title, slug(unique)          -- 공개 주소 /p/{slug} (이후 서브도메인/커스텀도메인)
  content_json                 -- 상단/하단 이미지·텍스트 등 페이지 구성
  meta_json                    -- SEO: keywords, favicon, og:title/description/image
  settings_json                -- 완료페이지/중복설정/차단/해외차단/비공개/휴지통 등
  status                       -- draft | published
  created_at, updated_at

landing_page_forms             -- 랜딩 ↔ 폼 연결 (N:M, 폼 재사용)
  landing_page_id → landing_pages
  form_id → forms
  trigger                      -- inline(페이지 내 삽입) | button_overlay(CTA→오버레이)
  sort_order

leads                          -- 수집 데이터
  id
  form_id → forms              -- 어느 폼으로 받았는지
  landing_page_id → landing_pages (nullable) -- 어느 랜딩에서 제출됐는지
  values_json                  -- 제출 값(동적 항목 → JSONB)
  status                       -- 대기 | 정상 | 불량 (스팸분류)
  group_tag                    -- 유입 그룹 구분
  phone_verified               -- 본인인증 통과 여부
  submitter_ip, user_agent, referer, utm_json
  created_at

-- 후기 확장: teams, team_members, lead_assignments, form_field_types(커스텀), webhooks, payments …
```

핵심: 폼 항목이 가변이므로 **리드 값은 `values_json`(JSONB)** 로 저장(Postgres JSONB 적합). 폼이 독립·재사용이라 **리드는 form_id와 landing_page_id를 함께** 기록해 통계를 정확히 낸다.

## 5. 화면(페이지) 목록

**관리자(로그인 필요)**
- 로그인 / 회원가입 / 비밀번호 재설정
- 대시보드(요약: 유입/접수/전환)
- **폼 관리**: 폼 목록 / 폼 생성·편집(유형 선택 → BASIC 항목편집 or STEP 단계편집) / 미리보기
- **랜딩 관리**: 랜딩 목록·그룹 / 랜딩 편집(상단·하단 구성 + **폼 연결**) / 설정(도메인·SEO·중복·차단·완료페이지)
- **리드(디비내역)**: 목록·검색·필터·상태변경·엑셀 내보내기
- 통계: 일별·전환·UTM
- 계정/요금(후기)

**공개(비로그인)**
- 랜딩 공개 페이지 `/p/{slug}` (연결된 폼 렌더: BASIC 인라인 / STEP 오버레이)
- 폼 제출 완료(감사) 화면 / (STEP) 진단 결과 화면
- 외부 임베드용 폼 스니펫

## 6. 대표 사용자 흐름

1. **폼 먼저 제작**: 폼 생성 → 유형 선택(기본형/선택형) → 항목·단계 구성 → (옵션) 본인인증 ON → 저장
2. **랜딩 제작**: 랜딩 생성 → 상단/하단 이미지·텍스트 구성 → **만들어 둔 폼 연결**(inline 또는 CTA 오버레이) → 공개
3. **배포·수집**: 공개 URL 공유 → 방문자 폼 제출(본인인증 시 SMS 인증) → 리드 저장
4. **관리**: 디비내역에서 리드 확인·분류(대기/정상/불량)·엑셀 내보내기

## 7. API 스케치 (REST, `/api`)

```
POST   /api/auth/signup, /login, /refresh
GET    /api/forms            POST /api/forms            (폼 CRUD)
GET/PUT/DELETE /api/forms/{id}
GET    /api/landings         POST /api/landings         (랜딩 CRUD)
GET/PUT/DELETE /api/landings/{id}
POST   /api/landings/{id}/forms         (폼 연결)
GET    /api/public/landings/{slug}      (공개 렌더 데이터, 비로그인)
POST   /api/public/leads                (폼 제출 수신, 비로그인)
POST   /api/public/verify/phone/send|confirm   (본인인증, 후기)
GET    /api/leads?landing=&form=&status=&q=     (리드 목록)
PATCH  /api/leads/bulk                   (상태 일괄 변경/삭제)
GET    /api/leads/export                 (CSV/엑셀)
```

## 8. MVP 범위 (1차)

> 사용자가 [`BACKLOG.md`](BACKLOG.md)에서 최종 선택 예정. 아래는 이 설계 기준 권장 1차.
- 인증(이메일 회원가입/로그인), 다계정
- **폼 관리**: BASIC(기본형) + STEP(선택형) 생성/편집, 폼 항목 구성, 개인정보 동의
- **랜딩 관리**: 단순형 랜딩 생성 + 폼 연결(재사용)
- **공개 페이지 + 폼 제출 수집** (BASIC 인라인 / STEP 오버레이)
- **리드 목록/상태/CSV 내보내기**
- SSL·리드 접근 권한

**본인인증(휴대폰)** 은 외부 SMS/인증 서비스가 필요하므로 **2차** 로 두되, 데이터 모델·폼 옵션 자리는 지금부터 마련(`require_phone_verification`).

## 9. 외부 서비스 의존 (유료)

- 휴대폰 본인인증 / SMS: CoolSMS·알리고·NHN·네이버 SENS, 또는 PASS 본인인증
- 결제(PG): PortOne·토스페이먼츠 (후기)
- 커스텀 도메인: 도메인 등록(선택)
