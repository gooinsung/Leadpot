# docs/META-ADS-PLAN.md — Meta 광고 기능 실현성 분석 & 1차 계획 (초안)

> 상태: **보류(나중에 할 일)** — 2026-07-28 사용자 결정: 기능①=일단 보류, 기능②=가능하나 일단 패스, 멀티포털 통합=일단 패스. 리서치·계획 초안만 기록해두고 추후 재개.
> 재개 시: §0 결론 → §6 결정 항목부터. (기능② 진행 시 §4 P0 승인 트랙을 코드보다 먼저 시작할 것)
> 대상 기능: ① Meta 광고 라이브러리 API 기반 **경쟁사 광고 분석**, ② Meta 마케팅 API 기반 **광고 생성·수정 + 자동 on/off 룰 관리**.
> 근거: 공식 developers.facebook.com 문서 + 2024~2026 자료 교차 확인(§7 출처).

---

## 0. 한 줄 결론

| 기능 | 실현성 | 핵심 |
|---|---|---|
| ① 경쟁사 광고 분석 (광고 라이브러리 API) | ⚠️ **공식 API로는 사실상 불가**(한국/전세계 상업광고) | 공식 API는 **EU 배포 광고만** 상업광고 노출. 그 외 지역은 **정치·사회이슈 광고만**. 한국 이커머스 경쟁사 광고는 API에 아예 없음 |
| ② 광고 관리 + 자동 on/off (마케팅 API) | ✅ **기술적으로 가능** (다만 승인 장벽 큼) | 광고 CRUD + **네이티브 자동 룰(adrules_library)** 로 "CPA> X면 끄기" 지원. 진짜 관문은 **앱 심사 + 비즈니스 인증 + 접근등급** |

---

## 1. 기능① 경쟁사 광고 분석 — 실현성

### 결정적 제약 (make-or-break)
Meta 공식 `ads_archive` 레퍼런스 원문: **"EU 지역에 도달하지 않은 광고는 사회이슈·선거·정치 광고인 경우에만 반환된다."**
→ 지역별 정리:
- **한국/전세계(비 EU)**: **정치·사회이슈·선거 광고만** 조회됨. **일반 상업광고(이커머스 등)는 API 데이터셋에 존재하지 않음.** `ad_reached_countries=KR` + 브랜드 키워드 → 사실상 결과 없음.
- **EU**: DSA 규제로 **모든 광고(상업 포함)** 노출 → API로 조회 가능.
- **US**: 정치/이슈 + 규제 특수카테고리(주택·고용·금융·신용)만. 일반 상업광고 불가.

즉 **"한국 경쟁사 상업광고 자동 필터링·표시"는 공식 Meta API로 구조적으로 구현 불가.**

### 접근/인증 (참고)
- Meta 개발자 앱 + `ads_read` 토큰. **본인 신원확인(facebook.com/ID, 신분증 업로드, 1~3일)** 필수.
- 앱 심사·비즈니스 인증은 기본 티어엔 불필요(신원확인이 관문). 단, **승인 등급을 올려도 상업광고는 안 나옴**(데이터 자체가 없음).
- 검색 파라미터: `search_terms`(100자), `ad_reached_countries`(필수), `ad_type`, `publisher_platforms`, `media_type`, `ad_active_status`, `search_page_ids`(≤10), `ad_delivery_date_min/max`, `languages`.
- 반환 필드: 광고 문구/스냅샷 URL/페이지명/노출 플랫폼/게재 기간. **노출·지출은 정치광고만(그것도 범위값), 상업광고엔 없음.**
- 레이트리밋: 토큰당 ~200콜/시간(내부 비용추정으로 613 에러 조기 발생). 커서 페이지네이션(기본 25, 페이지마다 콜 차감).

### ToS 제약
- 이 API는 **연구자·언론·투명성 목적**으로 명시. **마케터의 경쟁사 크리에이티브 인텔리전스 용도는 취지에 반함.**
- **원본 광고/크리에이티브 대량 내보내기 금지**, 웹 UI 스크래핑은 **ToS 위반(계정정지·법적 위험)**.
- 데이터 재판매/재배포는 회색지대 — SaaS로 파는 건 리스크.

### 대안 (한국 상업광고를 얻으려면)
1. **EU DSA Content Library API** — 커버리지 최고지만 **연구자 승인(CASD)** 게이트 + EU 광고만. 한국 미해결. 상업 SaaS는 자격 어려움.
2. **광고 라이브러리 웹 UI** — 브라우저로 한국 상업광고 열람은 되지만 **API 없음**, 자동 스크래핑은 ToS 위반.
3. **제3자 광고 인텔리전스 데이터 제공사(유료)** — 한국/전세계 상업 크리에이티브를 얻는 **유일한 현실적 경로**. 단, 상당수가 자체 스크래핑 기반이라 **법적 리스크를 벤더에 전가**하는 셈 → 벤더 컴플라이언스 검증 필수, 비용 발생.
4. **자체 스크래핑** — ToS 위반·밴·법적 위험. **비권장.**

### 권고
- **공식 Meta API로 "한국 경쟁사 상업광고 분석"은 약속하지 말 것**(불가능).
- 이 기능을 정말 원하면 = **유료 제3자 데이터 제공사 도입**이 유일한 길 → **사업·법무 판단이 선행**돼야 함(CLAUDE.md §0: 애매·리스크 큰 결정은 사용자 확정부터).
- 대안 스코프: (a) EU 타깃 상업광고 분석, (b) 정치/공공 광고 분석 — 우리 고객(한국 이커머스)엔 대체로 안 맞음.

---

## 2. 기능② 광고 관리 + 자동 on/off — 실현성

### 기술적으로 가능 ✅
Marketing API(Graph v25/26)는 4단계 계층(Campaign → Ad Set → Ad Creative → Ad)로 광고 생성·수정을 완전 지원. 상태(ACTIVE/PAUSED)·예산·입찰·타깃팅 수정 가능(크리에이티브는 교체 방식).

**최소 생성 흐름:** 캠페인 생성(PAUSED) → 애드셋(타깃·예산·최적화목표, 리드/전환이면 `promoted_object`에 픽셀+전환이벤트) → 크리에이티브 → 광고 → 상태 ACTIVE. (계정에 결제수단 필요)

### 자동 룰 (핵심) — 네이티브 지원됨
- `POST /act_{id}/adrules_library` 로 **서버측 자동 룰** 생성. Meta 인프라가 평가·실행(우리가 상시 잡을 안 돌려도 됨).
- 구성: `evaluation_spec`(filters: `{field, value, operator}`, AND/OR) + `execution_spec`(`PAUSE`/`UNPAUSE`/`CHANGE_BUDGET`/`CHANGE_BID`/`NOTIFICATION`…) + `schedule_spec`(DAILY/HOURLY/**SEMI_HOURLY≈30분 최소**/CUSTOM).
- **"CPA/비용 > X면 PAUSE", "CTR < Y면 PAUSE" 표현 가능.** 필터 필드: `ctr`, `cpc`, `cpm`, `spent`, `clicks`, `impressions`, `reach`, `frequency`, `website_purchase_roas` 등 + 기간 프리픽스(`last_7d_`, `yesterday_`) + 어트리뷰션 프리픽스.
  - ⚠️ 빌드 시 확인: 순수 "cost_per_action_type(결과당 비용)" 전용 필터 필드가 룰 필터셋에 있는지 v25/26 레퍼런스로 재확인. 없으면 spend+결과수 조합 또는 자체 엔진으로 대체.

### 자체 엔진 대안
Insights 폴링(`spend`·`ctr`·`cost_per_action_type`·`actions`) → 임계값 계산 → `POST /{ad_id}` status 변경. 커스텀 로직·외부신호엔 유리하나 가동시간·레이트리밋 부담 우리 몫.

**권고: 표준 on/off는 네이티브 자동 룰을 기본**으로(신뢰성·레이트리밋·Meta 관리), 네이티브로 표현 불가한 로직만 **얇은 자체 워치독**으로 보완(하이브리드).

### 진짜 관문 = 접근 승인 (일정·출시 리스크)
클라이언트의 실제 광고계정을 관리하려면:
1. 비즈니스 유형 앱 + 스코프 `ads_management`, `ads_read`, `business_management`.
2. **접근 등급**: 신규 앱은 Standard(2026-05-04부터 "Limited") — 자사 BM 계정만. **타사 계정 관리는 Advanced("Full") 필요.**
3. **앱 심사(App Review)** — 권한별 용도 소명(스크린캐스트는 2026 변경으로 불필요화). 반려 흔함.
4. **비즈니스 인증(Business Verification)** — 필수, 사업자 서류, 수일.
5. **자격 임계치(2026-05-04~)**: 최근 15일 **≥500 API 콜** + 오류율 <15% → Full 유지. (닭-달걀: 실트래픽 필요)
6. **토큰**: 유저 롱리브드 ~60일(비번변경·역할상실 시 깨짐) vs **System User 토큰(Full 등급 시 사실상 무기한)** → **SaaS 백그라운드 자동화엔 System User 강력 권장.**

**정직한 일정감:** 엔지니어링 v1 ~4~8주(가능한 팀 기준) + **Meta 승인 파이프라인 ~2~6주·다회 반복**, 코드가 준비돼도 승인이 출시를 막을 수 있음. **가장 큰 리스크.**

### Insights (룰 근거 지표)
- `GET /{ad_id}/insights?level=ad` — `spend`, `ctr`, `cpc`, `actions`, **`cost_per_action_type`**, `purchase_roas`. "결과당 비용"=최적화 이벤트에 해당하는 action type의 `cost_per_action_type`(objective에 따라 매핑 필요, 단일 만능 필드 없음).
- 어트리뷰션: **2026-01-12부터 `7d_view`/`28d_view` 데이터 중단**, 100+ 지표 폐기(10-30) → 클릭 기반 창으로 설계 + 버전 고정.
- **데이터 지연·사후 보정** 있음 → 같은 시간대 미확정 수치로 룰 실행 금지, `yesterday`/`last_7d` 등 안정 창 사용.

### 레이트리밋
점수제(read 1 / write 3, 300s 감쇠). Dev 60점(계정 2~3개), Full 9,000점. BUC 계정별 시간당(ads_management Full 10만 / Dev 300+40×활성광고). `X-Business-Use-Case-Usage` 헤더로 모니터·백오프. → **write 많은 status 토글은 3배 비용 → 네이티브 룰이 유리.**

---

## 3. 우리 스택 통합안 (Spring Boot + React)

- **OAuth(Facebook Login for Business)**: React가 `ads_management`/`ads_read`/`business_management` 로그인 → 백엔드가 code→롱리브드 토큰 교환. 지속 자동화는 **BM 자산 공유 + System User 토큰** 유도.
- **토큰 저장**: 테넌트별 암호화 저장(토큰·만료·스코프·비즈/계정ID), 만료 전 갱신 잡, 폐기/체크포인트 시 재동의 유도. (시크릿은 깃 금지 — CLAUDE.md)
- **룰**: UI에서 네이티브 자동 룰 CRUD(`adrules_library`) 위임 기본 + 네이티브 불가 로직만 Spring `@Scheduled` 워치독(안정 창 Insights 폴링 + status write, BUC 헤더 기반 레이트리밋/백오프/멱등).
- **멀티포털 정합**: 이 기능들은 [MULTI-PORTAL-PLAN.md](MULTI-PORTAL-PLAN.md)의 **광고주 포털** 성격과 맞물림 → 멀티포털 설계와 함께 배치 검토.

---

## 4. 1차 계획 (기능②만 — ①은 스코프 재정의 후)

> 전제: 사용자가 기능②를 진행하기로 확정 + 사업자·Meta 비즈니스 계정 준비.

- **P0. 준비/승인 트랙 (병렬·최우선, 코드와 무관하게 즉시 시작)**
  - Meta 비즈니스 앱 생성, `ads_management` 등 스코프 신청, **비즈니스 인증 서류 제출**, 앱 심사 준비(용도 소명 문구).
  - 자사 테스트 광고계정(BM)에서 Standard 등급으로 개발 + **500콜 자격 트래픽** 확보.
- **P1. 연결/인증**: Facebook Login for Business OAuth, 토큰 교환·저장·갱신, 광고계정 선택, System User 토큰 경로.
- **P2. 광고 조회·관리**: 캠페인/애드셋/광고 목록·상세(Insights: spend/ctr/CPA), 상태 토글(수동 on/off), 예산·입찰 수정.
- **P3. 자동 룰(네이티브)**: 룰 생성 UI("CPA> X 또는 CTR< Y면 자동 끄기" 등) → `adrules_library` 매핑, 룰 목록·on/off·삭제, 실행 이력.
- **P4. 자체 워치독(선택)**: 네이티브로 안 되는 커스텀 룰만 스케줄 폴링+토글.
- **P5. 광고 생성 마법사**: 4단계 생성 플로우(리드폼/픽셀 연계 — Leadpot 리드와 자연 연결).

각 단계는 승인 없이도 **자사 계정으로 데모/개발** 가능, 실고객 관리는 Full Access 승인 후.

---

## 5. 리스크 요약
- 기능① : **공식 API 불가**(한국 상업광고). 유료 제3자 데이터 = 비용+법적 리스크.
- 기능② : Meta **앱 심사/비즈니스 인증/자격 임계치**가 출시를 막을 수 있음(2~6주+). 사업자등록 필수.
- 어트리뷰션/지표 폐기(2026-01/10) → 버전 고정·클릭 창 설계.
- 레이트리밋/토큰 취약성 → System User + 네이티브 룰로 완화.

---

## 6. 사용자 확정 필요 (착수 전)
1. 기능① : (a) 공식 API 불가 인지하에 **EU/정치광고로 스코프 축소**, (b) **유료 제3자 데이터 제공사 도입**(비용·법무 검토), (c) **보류/드롭** — 중 택.
2. 기능② : 진행 여부 + **사업자등록/Meta 비즈니스 계정·비즈니스 인증** 준비 가능 여부(이게 없으면 실고객 관리 불가).
3. 기능② 우선순위 : 멀티포털(광고주 포털)과 함께 갈지, 별도 먼저 갈지.
4. 자동 룰 : 네이티브 룰 기반(권장) vs 자체 엔진 — 초기 범위.

---

## 7. 출처(주요)
**광고 라이브러리**: ads_archive 레퍼런스(https://developers.facebook.com/docs/graph-api/reference/ads_archive/), Ad Library API(https://www.facebook.com/ads/library/api), Transparency Center(https://transparency.meta.com/researchtools/ad-library-tools/).
**마케팅 API**: Marketing API(https://developers.facebook.com/documentation/ads-commerce/marketing-api), Ad Rules Engine(https://developers.facebook.com/docs/marketing-api/ad-rules), adrules_library(https://developers.facebook.com/docs/marketing-api/reference/ad-account/adrules_library/), Evaluation Spec Filters(https://developers.facebook.com/docs/marketing-api/ad-rules/guides/evaluation-spec-filters/), Access Tier 2026(https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/), Insights(https://developers.facebook.com/docs/marketing-api/insights/), Rate Limiting(https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/).

> ⚠️ 빌드 시 재확인 2가지: (1) `evaluation_spec` 내 CPA/결과당비용 전용 필터 필드 유무(현 버전), (2) 선택 Graph 버전의 어트리뷰션 창·지표 폐기 상태.
