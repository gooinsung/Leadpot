# docs/PROGRESS.md — 이어서 작업하는 지점 (RESUME HERE)

> **이 파일만 보면 "어디서부터 이어서 하면 되는지" 알 수 있다.**
> 규칙: 작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 **이 파일을 갱신하고 커밋**한다. (CLAUDE.md의 진행 기록 규칙 참고)
> 상세 로드맵은 [ROADMAP.md](ROADMAP.md).

---

## 📍 지금 위치

- **✅ 서브도메인 관리(D3) 검증 완료 (2026-07-24, gooinsung PC)**: 백엔드 빌드+테스트 통과 / API 스모크 전부 통과 / 브라우저에서 `{sub}.localhost:5173/{id}` 공개 렌더·루트 404 확인. 브랜치 `feature/d3-subdomain`(코드 커밋 ce10518).
  - **DB = Neon(무료 호스팅 Postgres)로 전환** — "모든 환경 공유 DB 한 대". 접속정보는 `backend/application-local.properties`(**gitignore됨·커밋금지**)에 저장, profile `local`로 기동. Flyway V1~V10 Neon에 적용됨(리전 ap-southeast-1).
  - **⚙️ 이 PC 환경 세팅(gooinsung PC = `C:\Users\gooinsung\git\Leadpot`)**: JDK21(`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`, winget) 설치, `npm install` 완료. Docker/WSL은 미설치(Neon 쓰므로 불필요).
  - **⚙️ wincube PC 환경 세팅(`C:\Users\wincube\projects\Leadpot`, 2026-08-04 확인)**:
    JDK21 은 `C:\Users\wincube\.jdks\ms-21.0.11` 에 있으나 **시스템 `JAVA_HOME` 이 JDK 8 을 가리켜** 그냥 실행하면
    `Gradle requires JVM 17 or later` 로 막힌다 → **명령마다 `JAVA_HOME` 을 넘겨야 한다**:
    ```bash
    cd backend && JAVA_HOME="C:\Users\wincube\.jdks\ms-21.0.11" ./gradlew.bat test
    ```
    ⚠️ **이 PC 의 `~/.ssh` 에는 서버 개인키가 없다**(known_hosts 만) — gooin PC 도 동일(2026-08-07 확인).
    → **키는 구글드라이브에 있다**: `G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key`
    (`ssh -i "<키>" ubuntu@129.225.198.2`). G: 가 마운트돼 있으면 바로 접속된다.
  - **❗ 로컬 실행 필수 플래그**: 이 PC는 기본 임시폴더 경로가 길어 JDK21 NIO의 AF_UNIX self-pipe가 실패("Unable to establish loopback connection") → **사용자 환경변수 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\Temp` 설정으로 해결**(설정 완료). 새 셸부터 자동 적용. (Java NIO 서버 전반에 필요)
  - **▶️ 로컬 실행법(현재)**: `C:\Temp` 존재 + 위 env 적용 상태에서 — 백엔드 `cd backend; $env:SPRING_PROFILES_ACTIVE='local'; .\gradlew.bat bootRun` (→ :8080, Neon 연결) / 프론트 `cd frontend; npm run dev` (→ :5173). 서브도메인 테스트는 `http://{내서브도메인}.localhost:5173/{랜딩번호}`.
  - **✅ D3 `main` 병합 완료**(현재 main에 `auth/Subdomains.java`·`PublicSiteController` 포함). 남은 것: SPEC·FEATURES 문서에 D3 반영 / 배포용 와일드카드 DNS·SSL(사용자 리소스, 나중).
- **현재 위치**: **핵심 루프(폼 공개→제출→리드 수집→조회) 완성 ✅** — 실제 데이터가 쌓임(방문자정보 포함) + **통계 대시보드 ✅**
- **완료**: Phase 1 인증 ✅ / Phase 2 폼 빌더 ✅ / **리드 수집(Phase 4 앞당김) ✅** / **Phase 3 랜딩 빌더 & 폼 연결 ✅** / **리드 상태변경·CSV 내보내기 ✅** / **이미지 업로드 R2 연동(경로 구조화 landing-image/YYYY/MM/DD) ✅** / **통계 고도화(방문 추적+전환율+순방문·트래픽 분리+일/주/월+호버툴팁+기간/대상 필터+랜딩/폼별) ✅** / **동의문서 이름/제목/내용 분리 ✅** / **IP 차단(K2) — 리드폼별·CIDR·사유·차단 로그 ✅**
- **추가 폼 개선(2026-07-24)**: 공개 폼 이름 숨김 · 동의 항목 기본체크 설정 · 공개 폼 모바일 최적화(1차) · **스텝형 답변 방식 확장**(카드 단일/다중 + 선택박스·텍스트·장문·연락처·이메일·숫자·날짜) · **마지막 단계 커스텀 안내문구**(typeConfig.contactMessage) · 스텝 입력형 간격 개선 · **중복 제출 방지(K3)**: 항목별 중복허용/유효기간 + 폼 동일IP 접수허용(settings_config, Flyway V6)

## 👉 다음에 할 일 (이어받는 세션은 여기부터)

> ## ✅ 2026-08-18 밤 — **광고 유입 파라미터 전 과제 + 통계 개편 + 리드폼 '분야' 완료 (전부 main 배포됨)**
>
> 이 날 저녁 세션(gooin PC)에서 아래를 전부 끝내고 배포까지 확인했다. 상세는 각 항목 절 참고.
>
> | # | 완료한 것 | 브랜치 |
> |---|---|---|
> | 1 | 광고 URL 빌더 화면 검증 → main 병합 (다른 PC 작업 이어받음) | `feature/ad-url-params` |
> | 2 | 리드 목록 **출처 열 + 유입 faceted 필터** (인박스·폼별) | `feature/lead-source-filter` |
> | 3 | 리드폼 단독 주소 광고 URL 버튼 + 통계 자체 파라미터 카드 3종 | `feature/adurl-form-and-stats` |
> | 4 | 통계 **유입별 비교 표 + 행클릭 필터 + 엑셀·일간/주간/월간 보고서**(인쇄/PDF 화면) | `feature/stats-report` |
> | 5 | PDF 보고서 그래프 안 나오던 인쇄 버그 수정(print-color-adjust) | `fix/report-print-colors` |
> | 6 | **리드폼 '분야'**(업종 구분) — 폼 지정·목록 열·인박스 필터/칩 (V34) | `feature/form-category` |
> | 7 | 분야를 **접수 시점 도장**으로 변경(과거 소급 금지) + **일괄 분야 지정** (V35) | `feature/lead-category-stamp` |
>
> **다음 후보 (미착수, 사용자 언급 순):**
> - ⬜ **광고주에게 리포트 발송** — 보고서 정의(기간+필터+섹션 키) 계약이 이미 있다
>   (`StatsExportService`·`REPORT_SECTIONS`·`/stats/report` 쿼리스트링). 발송 채널·주기만 정하면 된다.
> - ⬜ 통계 대상 필터에 '분야' 추가("개인회생 전체 전환율") · 보고서에 분야별 표
> - ⬜ 보고서 상태 필터(유효 리드만 집계) · referer 조합 필터
>
> 💡 로컬 검증 환경(이 PC): docker `postgres:18` + bootRun `local` + `npm run dev`.
> 로컬 계정 `local@test.com` / `localtest1234` (pgcrypto 로 직접 삽입, `{bcrypt}` 접두어 필수).
>
> ---
>
> ## ✅ 2026-08-18 17:40 — 광고 유입 파라미터(광고 URL 빌더) *(완료됨 — 위 표 참고)*
>
> **브랜치 `feature/ad-url-params` (main 에 아직 병합 안 함). 커밋 3개.**
> 이어받는 세션은 이 항목만 읽으면 그대로 계속할 수 있다.
>
> ### 왜 하는 작업인가
>
> 랜딩 하나를 메타·구글·당근 등 여러 매체에 쓰는데 **어디서 접수된 리드인지 구분이 안 됐다.**
> 매체별로 랜딩을 복제하지 않고, **URL 뒤에 파라미터를 붙여** 구분한다.
> 사용자가 정한 파라미터 이름 3개(2026-08-18 결정):
>
> | 키 | 뜻 | 예 |
> |---|---|---|
> | `media_from` | 광고 매체 이름 | `danggun` · `meta` · `google` |
> | `campaign_name` | 캠페인 이름 | `summer-sale` |
> | `ads_name` | 광고(소재) 이름 | `banner-a` |
>
> ⚠️ **`?from=` 이나 `?campaign=` 으로 짓지 않은 이유**: 기존 `utm_campaign` 은 JSONB 에
> 접두어를 뗀 **`campaign`** 키로 저장된다 → `?campaign=` 을 쓰면 같은 칸을 덮어써 하나가 사라진다.
> 위 3개는 표준 UTM 저장 키(`source`·`medium`·`campaign`·`term`·`content`)와 겹치지 않게 고른 이름이다.
> **표준 UTM 도 그대로 함께 수집한다**(GA·광고 플랫폼 리포트와 대조하려면 필요하다).
>
> ### ⭐ 파라미터 이름은 세 곳이 일치해야 한다 (가장 중요)
>
> 키를 늘리거나 바꿀 때 **아래 세 파일을 함께** 고친다. 한 곳만 고치면 조용히 어긋난다
> (URL 에는 붙는데 저장이 안 되거나, 저장 경로는 열렸는데 아무도 안 보낸다):
>
> 1. `frontend/src/lib/adUrl.ts` → `AD_PARAM_KEYS` (빌더가 URL 에 붙일 키)
> 2. `frontend/src/lib/utm.ts` → `AD_KEYS` (공개 화면이 URL 에서 읽을 키)
> 3. `backend/.../common/TrackingParams.java` → `ALLOWED_KEYS` (저장 최종 관문)
>
> `frontend/src/lib/adUrl.test.ts` 의 **"빌더 → 수집 왕복"** 테스트가 1·2 의 불일치를 잡아준다.
>
> ### ✅ 끝난 일 (커밋 3개)
>
> | 커밋 | 내용 |
> |---|---|
> | `bf5a76d` | **백엔드 화이트리스트 관문** `common/TrackingParams.java` — 허용 키만 통과 + 값 200자 컷. `LeadService.submit` 과 `VisitService.record` 양쪽에 적용. 테스트 `TrackingParamsTest` 6개 |
> | `300f021` | **프론트 수집** — `lib/utm.ts` 에 3개 키 추가 / `PublicFormView` 의 `parseUtm` **복사본 제거**(한쪽만 고치면 리드·방문 값이 어긋난다) / `embed.tsx` 방문 기록 utm 누락 수정 |
> | `b900993` | **광고 URL 빌더** — 랜딩 목록 '공개 열기' 옆 '광고 URL' 버튼 → 모달. `lib/adUrl.ts`(순수 함수 `buildAdUrl`) + `components/AdUrlBuilder.tsx` + `styles/features/landing.css` 의 `adurl-*`. 테스트 11개 |
>
> **왜 백엔드 관문까지 넣었나**: 제출·방문 기록은 공개 엔드포인트라 예전엔 `lead.setUtm(req.utm())` 이
> 받은 map 을 **그대로** JSONB 에 넣었다 — 키 개수·값 길이 제한이 없어 curl 로 임의 키를 무제한 넣을 수 있었다.
> 그러면 앞으로 만들 **출처 필터 드롭다운이 쓰레기 키로 오염돼 기능 자체를 못 쓴다.**
> 같은 함수에서 `referer`·`userAgent` 는 `cut(..,1024)` 로 잘랐는데 `utm` 만 빠져 있던 일관성도 맞췄다.
>
> ### 🔬 검증 상태 — 무엇이 확인됐고 무엇이 **안** 됐는지
>
> | 항목 | 결과 |
> |---|---|
> | 백엔드 전체 테스트 (`gradlew test`) | ✅ 통과 |
> | 프론트 테스트 (`npx vitest run`) | ✅ **72개 통과** (신규 17개 = TrackingParams 6 + adUrl 11) |
> | 프론트 타입체크·빌드 (`npm run build`) | ✅ 통과 |
> | ✅ **화면(브라우저) 검증** | **완료 (2026-08-18, gooin PC).** 로컬 스택(docker `postgres:18` + bootRun `local` + `npm run dev`)에서 전 항목 통과 — 아래 표 |
>
> #### ✅ 화면 검증 결과 (2026-08-18 gooin PC, 전 항목 통과)
>
> | 확인 항목 | 결과 |
> |---|---|
> | '광고 URL' 버튼 노출 | ✅ **공개 상태 + 서브도메인 보유** 조건 확인 — 서브도메인 없는 계정은 버튼이 안 뜬다(의도된 조건, `LandingsListPage.tsx:112`) |
> | 모달 레이아웃·매체 칩 | ✅ 칩 6개(meta·google·danggun·kakao·naver·tiktok) 렌더·선택 하이라이트 정상 |
> | 주소 실시간 갱신 | ✅ `?media_from=danggun&campaign_name=summer-sale&ads_name=banner-a` 즉시 조립 |
> | 복사 버튼 · 바깥 클릭 닫힘 | ✅ 클립보드 복사 동작 · 오버레이 클릭 시 닫힘 |
> | 만든 주소로 공개 폼 제출 | ✅ 제출 완료 → **리드 상세 패널 UTM 줄에 3개 파라미터 전부 표시** |
> | DB 저장 (`leads.utm`·`visits.utm`) | ✅ 양쪽 모두 `{ads_name, media_from, campaign_name}` JSONB 저장 |
> | CSV 내보내기 `UTM` 열 | ✅ `ads_name=banner-a media_from=danggun campaign_name=summer-sale` |
> | 화이트리스트 관문 (curl 공격 재현) | ✅ `junk_key`·초장문 키를 섞어 제출 → **허용 키(`media_from`·표준 `source`)만 저장**, 나머지 폐기 |
>
> 로컬 검증 환경 만드는 법(새 DB 라 계정·데이터가 없다): 가입이 잠겨 있으므로(`app.auth.signup-enabled=false`)
> pgcrypto 로 직접 넣는다 — `INSERT INTO users (..., password_hash) VALUES (..., '{bcrypt}' || crypt('비번', gen_salt('bf', 10)))`.
> ⚠️ **`{bcrypt}` 접두어 필수**(DelegatingPasswordEncoder). '광고 URL' 버튼을 보려면 `users.subdomain` 도 채워야 한다.
>
> ⚠️ 이 PC 는 `docker ps` 가 실패한다(Docker Desktop 미기동). 로컬은 `docker-compose` 의
> `postgres:18` 을 보게 바뀌어 있어(커밋 `0f9b932`) **DB 를 띄우려면 Docker 가 필요하다.**
> ⚠️ 이 PC 는 `npm run build` 가 `vitest` 타입을 못 찾아 실패할 수 있다 → **`npm install` 로 해결**된다
> (package.json 에는 있는데 node_modules 가 낡아 빠져 있었다. `package-lock.json` 은 안 바뀜).
>
> ### ⬜ 다음에 할 일 (순서대로)
>
> 1. ~~⭐ 화면 검증~~ → ✅ **완료 (2026-08-18, 위 표)**
> 2. ~~main 병합~~ → ✅ **완료 (2026-08-18)** — merge 후 push, Railway 자동 배포
> 3. ~~리드 목록의 출처 열 + 파라미터 필터~~ → ✅ **완료 (2026-08-18, 브랜치 `feature/lead-source-filter`)**
>    "파라미터 이름 선택 → 값 드롭다운" (faceted) 합의안 그대로. 브라우저 실검증 통과.
>    - **인박스**(`/inbox`): 필터바에 [모든 유입 ▾]→[모든 값 ▾(건수 표기)] 2단 셀렉트,
>      행에 출처 칩(`.il-src`, media_from 우선 → utm source). 서버 필터
>      `GET /api/leads/inbox?utmKey=&utmValue=`(정확 일치, 키·값 둘 다 있어야 적용).
>    - **폼별 목록**(`/forms/{id}/leads`): '출처' **열** 신설 + 칩 클릭 → 그 값으로 필터
>      (태그 칩과 같은 패턴). 전체 리드를 이미 들고 있어 **클라이언트 필터**(기존 패턴 유지).
>    - **facet 옵션**: 서버 `GET /api/leads/utm-facets?formId=`(인박스용) /
>      클라이언트 `buildUtmFacets()`(폼별). 키는 `TrackingParams.ALLOWED_KEYS` 로 한정 —
>      옛 데이터의 쓰레기 키가 드롭다운을 오염 못 한다. **필터 전 전체 기준**으로 만든다
>      (값을 골라도 다른 값이 드롭다운에 남게).
>    - **검색(q)이 유입 값도 본다** — "danggun" 검색이 당근 유입 리드를 찾는다
>      (백엔드 `matchesQuery` + 폼별 클라이언트 필터 양쪽).
>    - 상세 패널 UTM 줄 → '출처' + 한국어 라벨("광고 매체 danggun · 캠페인 이름 summer-sale").
>    - 키 라벨·정렬은 `frontend/src/lib/tracking.ts` 한 곳(자체 3개 먼저). **키를 늘리면
>      adUrl.ts·utm.ts·TrackingParams.java 와 함께 이 파일 라벨도** 추가한다.
>    - '태그'와 별개 축 유지 — 문구 '유입/출처', 칩 모양도 다르게(회색 알약 vs #파랑).
>    - ⚠️ **여전히 메모리 필터·집계다**(기존 목록·인박스와 일관). 리드 수천 건부터는
>      JSONB GIN 인덱스 + DB 쿼리로 옮긴다 — `LeadService.utmFacets` 주석에도 남김.
> 4. ~~통계 페이지에 자체 파라미터 3개 카드~~ → ✅ **완료 (2026-08-18, 브랜치 `feature/adurl-form-and-stats`)**
>    `/stats` 상세에 [광고 매체 (media_from)]·[캠페인 이름 (campaign_name)]·[광고 이름 (ads_name)]
>    카드 3개 — 표준 UTM 카드보다 **앞에** 배치(우리 도구가 만든 축이 주 지표).
>    `StatsResponse.byMediaFrom/byCampaignName/byAdsName` + `StatsService` 집계(기존 `utm()` 재사용,
>    값 없는 리드는 기존 UTM 카드와 똑같이 `(없음)`).
> 5. ~~리드폼 단독 주소(`/f/{id}`)에도 빌더 붙이기~~ → ✅ **완료 (같은 브랜치)**
>    폼별 리드 목록(`/forms/{id}/leads`) 상단 '공개 링크 복사' 옆 **'광고 URL' 버튼** →
>    `AdUrlBuilder` 재사용(baseUrl=`/f/{id}`). 브라우저 검증: 모달 열림 + 만든 주소
>    (`/f/1?media_from=tiktok&...`)로 실제 제출 → `leads.utm`·`visits.utm` 3종 저장 확인.
>
> 💡 **네이버 QR(단축주소) 주의 (2026-08-18 실측)**: `m.site.naver.com/xxxx?media_from=...` 처럼
> **단축주소 뒤에 붙인 파라미터는 버려진다**(등록된 원본 URL 로만 리다이렉트, 308 Location 실측).
> → **파라미터 붙인 완성 주소를 먼저 만들고 그걸로 QR 을 생성**해야 한다. 매체·캠페인별로 QR 도 따로.
>
> ### ✅ 통계 개편 — 유입별 표·필터 + 엑셀·보고서 (2026-08-18, 브랜치 `feature/stats-report`)
>
> 사용자 요청 2건("통계 필터 다양화" + "엑셀/일간·주간·월간 보고서")을 한 번에:
>
> - **유입별 비교 표** (`/stats`): 매체/캠페인/광고 탭 전환, 값별 **방문·리드·전환율**
>   (방문(visits)에도 utm 이 저장돼 있어 매체별 전환율이 실제로 계산된다). "(없음)" = 오가닉.
> - **행 클릭 → 유입 필터**: 페이지 전체(KPI·추이·퍼널·카드·표)가 그 유입만으로 서버 재계산
>   (`GET /api/stats/overview?utmKey=&utmValue=`). 비교 표 자체는 필터 무관 전체(행 갈아타기).
>   이벤트(요소 클릭)는 utm 이 없어 **방문자 IP 해시로 근사 귀속**시킨다.
> - **[보고서·엑셀] 버튼 → 모달**: 기간 단위(화면 기간/일간=오늘/주간=7일/월간=이번 달) +
>   **섹션 8개 체크박스** → ① **엑셀 다운로드**(멀티시트, `POST /api/stats/export`)
>   ② **보고서 화면 열기**(`/stats/report`, 새 탭) → 브라우저 인쇄로 PDF 저장.
> - ⭐ **"보고서 정의 = 기간 + 필터 + 섹션 키 목록"** 이 계약이다 — 섹션 키
>   (summary·trend·utm·landing·form·device·status·referer)는
>   `StatsExportService`(백엔드) · `REPORT_SECTIONS`(StatsPage) · `StatsReportPage` 세 곳이 공유.
>   **나중 '광고주에게 리포트 발송'(사용자가 원함)은 이 정의를 그대로 재사용**해서 만든다.
> - 구조 정리: `components/StatsCharts.tsx` 신설(TrendChart·BarCard·EntityTable·UtmValueTable·bucketize)
>   — 통계 페이지와 보고서 화면이 공유. 엑셀은 `LeadExcelService.dataXlsxSheets`(멀티시트) 신설.
> - 검증: `StatsUtmTest` 2개 + 백엔드 전체 + 프론트 81개 + 빌드 통과. 브라우저에서
>   표·행클릭 필터·모달·보고서 화면·엑셀(시트 5개 zip 검사) 실확인.
> - ⬜ 다음 후보: **광고주 리포트 발송**(위 계약 재사용) · 보고서 상태 필터(유효 리드만) ·
>   유입 경로(referer) 조합 필터.
>
> ### ✅ 리드폼 '분야' — 업종 구분 (2026-08-18, 브랜치 `feature/form-category`, Flyway V34)
>
> 사용자 요청: "개인회생·장기렌트·임플란트 같은 걸 리드폼별로 지정하고, 그 폼의 리드에서 보이고,
> 인박스에서 걸러서 '오늘 개인회생 전반'을 본다." 원래 '태그'라 불렀으나 **`leads.tags`(손태그)와
> 겹쳐 '분야'로 명명**(사용자 승인).
>
> - **DB**: `forms.category varchar(50)` (V34). **리드에 복사하지 않는다** — 리드는 폼을 통해
>   물려받아, 분야 이름을 바꾸면 과거 리드까지 즉시 반영된다.
> - **분야 목록은 별도 테이블 없음** — forms.category 의 distinct 값이 곧 목록
>   (등록/관리 화면 없이 굴러간다. 커스텀 파라미터 화이트리스트를 안 만든 결정과 같은 취지).
> - **폼 편집기**: 이름 아래 '분야' 입력 + **datalist 자동완성**(내 폼들의 기존 분야 —
>   '개인회생'/'개인 회생'으로 갈리는 오타 분열 방지). 빈 값 = 미지정(null).
> - **폼 목록**: '분야' 열.
> - **인박스**: [모든 분야 ▾] 드롭다운(건수 표기, 분야 지정 폼이 없으면 숨김) +
>   리드 행에 **보라 분야 칩**(`.il-cat` — 손태그 #파랑·출처 회색과 또 다른 축).
>   서버 필터 `GET /api/leads/inbox?category=`. Counts.byCategory(전체 기준).
> - 검증: InboxTest 분야 테스트 + 백엔드 전체 + 프론트 81개 + 빌드. 브라우저에서
>   편집기 저장·datalist·목록 열·인박스 드롭다운/칩/필터(API 3건 매칭) 실확인.
> - ⬜ 다음 후보: 통계 대상 필터에 '분야' 추가("개인회생 전체 전환율") · 보고서 섹션에 분야별 표.
>
> #### ⭐ 구조 변경 (같은 날, 브랜치 `feature/lead-category-stamp`, Flyway V35)
>
> 사용자 요구 2건으로 **"폼에서 상속" → "접수 순간 리드에 도장"** 으로 바꿨다:
>
> 1. **분야를 지정한 이후 접수분부터만 집계** — 폼 분야를 지정/변경해도 기존 리드는 안 바뀐다.
>    상속 방식은 조회 시점 계산이라 과거까지 소급되는 문제가 있었다.
> 2. **인박스에서 체크 → 일괄 분야 지정/해제** — 과거 리드에 소급하는 유일한 경로.
>    일괄 바에 [분야 지정… ▾] 셀렉트(기존 분야 + 새 분야 입력 + 해제).
>
> - **DB**: `leads.category varchar(50)` (V35, 백필 안 함 = 기존 전부 분야 없음).
>   `forms.category`(V34)는 "새 접수에 찍을 도장 원본"으로 유지된다.
> - 도장 위치: `LeadService.submit` + `importRows`(파일 가져오기도 같은 규칙).
> - API: `PATCH /api/leads/bulk/category` {ids, category} — 빈 값 = 해제, 남의 리드 건너뜀(K5).
> - 인박스 필터·카운트·칩 전부 리드의 category 기준으로 변경. `InboxResponse.Item.category`.
> - 검증: InboxTest 2개(도장이 기존 리드 제외·일괄 지정/해제/K5) + 전체 통과.
>   실동작: 폼에 개인회생 지정 → 기존 리드 3건 분야 없음 유지, 새 제출만 도장,
>   일괄 지정으로 소급, UI 셀렉트 전부 브라우저 확인.
>
> ### 결정된 사항 (다시 논의하지 말 것)
>
> - 빌더 **입력값은 DB 에 저장하지 않는다** — 만들어서 복사만 하는 도구다(사용자 결정)
> - 표준 `utm_*` 은 **삭제하지 않고 병행**한다(사용자 결정)
> - 매체 이름 **빠른 선택 칩**을 둔다 — 손으로 적으면 `danggun`/`dangn`/`당근` 으로 갈려 통계가 쪼개지고,
>   이미 접수된 리드에 박힌 값은 되돌릴 수 없다. 자유 입력도 계속 가능하다
> - 커스텀 파라미터를 **계정별로 등록**하는 화이트리스트 화면은 **만들지 않는다** — 키를 3개로 못 박아
>   코드 상수로 관리하는 쪽을 택했다(등록 화면·마이그레이션 없이 끝난다)
>
> ### 참고: 광고 플랫폼 동적 파라미터 (조사 완료, 2026-08-18)
>
> 매체가 캠페인·소재 이름을 **자동으로 치환**해준다 → 소재별로 URL 을 따로 만들 필요가 없다.
>
> | 매체 | 동적 파라미터 | 주의 |
> |---|---|---|
> | 메타 | `{{site_source_name}}`(fb/ig/msg/an) · `{{campaign.name}}` · `{{adset.name}}` · `{{ad.name}}` | 광고 설정에 'URL 매개변수' 칸이 따로 있다 |
> | 구글 | ValueTrack `{campaignid}` · `{adgroupid}` · `{creative}` · `{keyword}` · `{network}` · `{device}` | '최종 URL 서픽스'에 넣는 게 정석. `gclid` 자동 |
> | 당근 | `{{campaign_id}}` · `{{adgroup_id}}` · `{{material_id}}` · `{{click_id}}` · `{{keyword}}` | ⚠️ **이름이 아니라 ID** 만 준다 → 통계에 숫자로 찍힌다 |
> | 틱톡 | `__CAMPAIGN_NAME__` · `__AID_NAME__` · `__CID_NAME__` · `__PLACEMENT__` | 이름을 준다 |
> | 네이버 GFA | `{campaign}` · `{ad_group}` · `{ad}` | |
> | 카카오 | 동적 매크로 빈약 → 캠페인별로 URL 을 직접 나눈다 | ⚠️ **키워드광고는 'URL 파라미터 자동 추가'가 기본 ON** → 우리 값이 덮이니 **해제**해야 한다 |
>
> ⬜ 아직 안 한 것: `gclid`/`fbclid`/`ttclid` 클릭ID 저장(플랫폼 리포트와 1:1 대조·전환 API 용).
> 지금은 저장하지 않는다 — 전환 귀속은 플랫폼에 맡기는 설계다(`frontend/src/lib/pixels.ts:7` 주석).
>
> ---
>

> ## ✅ 2026-08-18 01:15 — **DB 이전 완료: Neon → Railway Postgres** (관찰 기간 중)
>
> **상세·롤백·검증 수치는 [DB-MIGRATION-RAILWAY.md](DB-MIGRATION-RAILWAY.md) 상단.**
>
> | | 결과 |
> |---|---|
> | 데이터 일치 | CUTOFF 시점 `users=44 leads=78 visits=1110` **양쪽 완전 일치** · Flyway V33 실패 0 |
> | 유실 | **리드·메시지·사용자 0건.** `visits` 1건(익명 페이지뷰)만 Neon 에 남음 — 이전 안 함 |
> | 전환 증거 | Neon 마지막 visit 16:00:44 **멈춤** / Railway 16:05:02 **계속 유입** |
> | 접속 | `jdbc:postgresql://postgres.railway.internal:5432/railway` (내부망, 공개 노출 없음) |
> | **DB 왕복** | **426ms(VM+Neon) → 100ms(Railway+Neon) → 약 20ms** ⭐ P1 해결 |
> | 비용 | Postgres 추가분 ~$1~2/월 (Neon Launch 유지 시 ~$19 였다) |
>
> ### ⭐ 이번에 바뀐 운영 사실 (기억할 것)
>
> - **VM 백엔드는 정지됐다**(`docker compose -f docker-compose.prod.yml down`).
>   그래서 **자동 승인을 Railway 가 인수**했다 — `APP_LEAD_AUTO_APPROVE_ENABLED` `false`→**`true`**.
> - ⚠️ **Oracle VM 을 지우면 안 된다.** `app.lead-pot.com` 이 아직 이 VM 의 nginx 에서 서비스된다
>   (HTTP 200 확인). 프론트를 Cloudflare Pages 로 옮긴 뒤에만 VM 종료 가능(Phase B).
> - **Neon 은 아직 살려둔다.** keepalive 가 사라져 scale-to-zero 로 잠들므로 월 약 20원뿐이다.
>   살아있는 롤백 대상이라 관찰 뒤 삭제한다.
> - 백업·롤백 파일: `C:\Users\gooin\leadpot-backup\` (덤프 4개 + `ROLLBACK-leadpot-env-20260818.txt`). git 금지.
>
> ### 2026-08-18 01:40 시점 최종 상태 점검 (전부 정상)
>
> | 항목 | 결과 |
> |---|---|
> | `api/health` · `/actuator/health` | 200 · **UP** |
> | `app.lead-pot.com`(프론트) | **200** (0.17s) |
> | `landing/17/live` · `public/forms/24` (DB 읽기) | **200** (0.39s) |
> | `auth/login`(users 읽기) | 401 = 정상 동작 |
> | VM 백엔드 | **502 = 정지 유지** (의도된 상태) |
> | Railway 서비스 | `Leadpot` **Online** · `Postgres` **Online** |
> | DB 접속 | `postgres.railway.internal:5432/railway` (내부망) |
> | DB 공개 노출 | **없음** — Public Access 제거됨 ✅ |
> | 자동승인·예열·저장소 | `true` · `true` · `r2` |
>
> ### ✅ 끝난 일
>
> - [x] DB 이전 + 검증 + 델타 확인 (업무 데이터 유실 0건)
> - [x] **Public Access 제거** — 복원용으로 켰던 TCP 프록시. DB 는 내부망 전용
> - [x] 자동 승인을 Railway 가 인수 (`APP_LEAD_AUTO_APPROVE_ENABLED=true`)
> - [x] **로컬 개발을 프로덕션 DB 에서 분리** (커밋 `0f9b932`) — 로컬은 docker-compose 의
>       `postgres:18` 을 본다. `application-local.properties.example` 템플릿 추가.
>       ⚠️ postgres:18 함정 2개를 주석으로 남겼다: 마운트가 `/var/lib/postgresql` 로 바뀜 ·
>       16→18 은 볼륨 재사용 불가(옛 `leadpot_pgdata` 는 보존)
>
> ### ⬜ 내일 할 일 (사용자: "남은거는 내일 진행")
>
> - [ ] ⭐ **매시 10분 자동 승인 배치 첫 사이클 확인** — 설정은 켰지만 **실제로 도는 것은 아직 미확인**.
>       실패하면 리드 상태가 **조용히** 멈춘다. Railway `Leadpot` → Deploy Logs 에서
>       `LeadAutoApproveRunner` 관련 로그 확인
> - [ ] **문자·알림톡·구글시트 정상 동작 확인** — 전환 후 아직 이 경로가 밟히지 않았다.
>       ⚠️ DB 가 내부망 전용이 되어 **외부에서 직접 조회할 수 없다** → 관리자 UI 나 Railway 로그로 확인
> - [ ] Railway **Usage Limit** — 워크스페이스 이름 → Settings → Usage → Soft **$15** / Hard **$40**
>       (⚠️ Hard 는 초과 시 서비스를 정지시킨다. 실측 월 ~$7 이므로 넉넉히)
> - [ ] 관찰 뒤 **Neon 프로젝트 삭제** (지금은 scale-to-zero 로 월 약 20원, 살아있는 롤백 대상)
> - [ ] 남은 보안(§6-3): 앱 전용 최소권한 계정 · DB 비번 회전 ·
>       **로컬 R2 설정이 아직 프로덕션 버킷·키를 가리킨다**(업로드 만질 때만 위험)
> - [ ] 문서: `application.properties` 의 Neon 전제 주석(20~26·64행) · **CLAUDE.md §2·§6**(DB=Neon 으로 적혀 있음)
> - [ ] (별건) **Phase B — 프론트 → Cloudflare Pages.** 실작업 약 40분 + Phase C 30분.
>       `_redirects` 가 이미 있어 SPA 폴백 작업은 없고, `*.pages.dev` 로 먼저 검증하므로 다운타임 0.
>       ⚠️ 이걸 해야 **Oracle VM 을 끌 수 있다**(지금 프론트가 VM nginx 에서 서비스 중)
>
> ### 참고: 지금 무엇이 어디서 도는가 (2026-08-18)
>
> | 구성 | 위치 |
> |---|---|
> | 백엔드 `api.lead-pot.com` | **Railway**(싱가포르) |
> | **DB** | **Railway Postgres**(같은 프로젝트, 내부망 전용) ⭐ 이번에 이전 |
> | 프론트 `app.lead-pot.com` | **Oracle VM 의 nginx** (Cloudflare 는 DNS·SSL 프록시일 뿐) |
> | 업로드 파일 | **Cloudflare R2** (`leadpot-uploads`) |
> | 옛 DB | Neon (잠든 상태, 삭제 예정) |
>
> ---
>
> ## 🚨 2026-08-17 — **서비스 다운: Neon 무료 한도 초과** · DB → Railway Postgres 이전 착수
>
> **런북: [DB-MIGRATION-RAILWAY.md](DB-MIGRATION-RAILWAY.md) — 이어받는 세션은 이 파일을 보고 그대로 실행한다.**
>
> ### 무슨 일이 났나
>
> 사용자가 "서버 접속이 안 된다"고 해서 확인한 결과 **Neon 컴퓨트가 정지**돼 있었다.
> Neon 대시보드: **Compute 110.6 / 100 CU-hrs** (8/1부터) → 무료 한도 초과로 컴퓨트 suspend.
>
> | 확인 | 결과 | 의미 |
> |---|---|---|
> | `/api/health` | UP (0.7초) | 앱은 정상 — **DB를 안 타는 경로** |
> | `/actuator/health` | **DOWN** | DB 포함 헬스 실패 |
> | DB 타는 엔드포인트(로그인·공개폼) | **10.4초 뒤 실패** | `connection-timeout=10000ms`와 초 단위 일치 → 커넥션 자체를 못 맺음 |
>
> **데이터는 안전하다**(Storage 0.04GB로 정상 표시).
>
> ### 원인 — 예측했던 리스크가 그대로 터졌다
>
> 이 파일 아래쪽 2026-08-09 항목 6번에 이미 적혀 있다:
> *"DB → Railway Postgres 교체 검토(Neon 무료 100 CU-h/월 한도 → **keepalive 24시간이면 초과 가능**, 콘솔 Usage 확인 필요)"*
> → **그 Usage 확인을 넘기지 않은 채 한도를 넘겼다.**
>
> 산수가 정확히 맞는다: 최소 크기 **0.25 CU × 24h × 17일 = 102 CU-hrs** ≈ 실측 110.6.
> **DB가 17일간 한 번도 잠들지 않았다**는 뜻이고, 범인은 지연을 줄이려 넣은
> [application.properties:29-31](../backend/src/main/resources/application.properties:29)의
> keepalive(120초)·`minimum-idle=3`이다. Neon 자동 절전이 영원히 안 걸린다.
> ⚠️ 그 리스크는 [application.properties:25-26](../backend/src/main/resources/application.properties:25) 주석에
> 이미 경고로 적혀 있었다 — *"요금 페이지에서 한 번 확인할 것"*.
>
> ### 결정 (사용자, 2026-08-17)
>
> **Neon Launch로 잠깐 올려 데이터를 빼내고 → Railway Postgres로 이전 → Neon 프로젝트 삭제.**
>
> ⚠️ **정정(2026-08-17)**: 처음에 "Launch = 정액 $19/월"이라고 적었으나 **틀렸다.**
> Neon Change plan 화면 실측 결과 Launch는 **순수 사용량 과금 — $0.106/CU-hour**
> (+ 스토리지 $0.35/GB·월). 즉 **덤프만 하는 비용은 0.25 CU × 30분 ≈ $0.013(20원)** 으로 사실상 공짜다.
> ($19은 "24시간×30일 = 180 CU-hr × $0.106" 일 때의 월 비용이라 우리 사용 패턴과 우연히 같았을 뿐이다.)
> ⚠️ 결제 화면에서 **기본료/최소 청구액**과 **이번 달 이미 쓴 110.6 CU-hrs의 소급 청구 여부**를 확인할 것.
>
> 근거: Railway Postgres 추가분 약 $2~4/월로 Neon을 계속 쓰는 어떤 조합보다도 싸고,
> Railway Postgres는 **컴퓨트 시간 과금이 아니라 이 사고가 구조적으로 재발 불가능**해진다.
> 덤으로 [HOSTING-MIGRATION-PLAN.md:13-25](HOSTING-MIGRATION-PLAN.md:13)의 P1(응답시간 74%가 외부 DB 왕복)도 같이 풀린다.
>
> ### ⚠️ 이전 전 반드시 알아야 할 것 2개
>
> 1. **Neon 컴퓨트가 정지된 상태에서는 `pg_dump`도 안 된다.** 그래서 결제가 먼저다(또는 9/1 리셋 대기 = 2주 다운).
> 2. **VM 백엔드가 아직 살아있다** — `https://129.225.198.2/api/health` → UP (2026-08-17 확인).
>    Railway와 VM **두 백엔드가 같은 Neon DB를 동시에 보고 있고**, VM 쪽은 `APP_LEAD_AUTO_APPROVE_ENABLED=true`로
>    매시 배치를 돌린다. **덤프 후 VM이 쓰면 그 데이터는 유실된다** → 런북 Step 3에서 먼저 정지.
>
> ### 진행 상황 (2026-08-18 00:30 기준)
>
> - [x] **서비스 복구** — 사용자가 Neon Launch 로 전환. `/actuator/health` UP, 로그인 0.385초
> - [x] **백업 덤프 + 복원 검증 완료** — `C:\Users\gooin\leadpot-backup\`,
>       로컬 postgres:18 에 실제 복원해 에러 0건 / 50개 항목 중 48 완전일치 · 문제 0
> - [x] Railway Postgres 생성(버전 18) — **위치가 잘못됨. 아래 참조**
> - [ ] 🛑 **복원 중단.** 블로커 2개 → 방향 재검토 중
>
> ### 블로커 2개 → **둘 다 해소됨 (00:40)**
>
> **1. Postgres 가 다른 프로젝트에 생성됐다 → ✅ 사용자가 삭제하고 프로젝트 `Leadpot` 안에 재생성.**
> Railway 는 **프로젝트가 내부망 경계**다 → 백엔드와 DB 는 **같은 프로젝트의 서비스 두 개**여야 한다
> (새 프로젝트를 만드는 게 아니다). 다른 프로젝트면 공개 인터넷을 타서
> 저지연·egress 무과금·비공개가 전부 사라진다.
>
> **2. "RAM 4.66GB → 월 $50" → ❌ 내 오독이었다.**
> Railway 요금 화면의 숫자는 **순간 사용량이 아니라 청구 주기 누적 GB-분**이다.
> 결정적 증거: 백엔드 RAM 이 **7085.04 GB** 로 표시된다(순간값이면 7TB 라 불가능).
> 이 오독으로 "이전하면 2.5배 비싸진다"고 잘못 경고해 복원을 멈추게 했다. 블로커가 아니었다.
>
> ### ⭐ 확인된 실제 비용 (`Cost by Service` 실측)
>
> 백엔드는 컷오버(8/9)부터 9일 가동 → 평균 RAM = 7,085 ÷ (9×1,440) = **약 0.55GB**. 정상 수치다.
> ("JVM 힙 폭주"도 내 잘못된 가설이었다.)
>
> | 서비스 | 월 환산 | 앞서 적었던 값 |
> |---|---:|---|
> | 백엔드(Leadpot) | **~$5.5** | $12~17(계획 추정) — 과대평가였다 |
> | Postgres | **~$1~2** | $2~4 → $50 ❌ |
> | **합계** | **약 $7/월** | Hobby 크레딧 $5 가 대부분 덮는다 |
>
> → **Railway Postgres(~$1~2) 가 Neon Launch 유지(~$19)보다 10배 이상 싸다. 예정대로 진행.**
> → Usage Limit 확정: **Soft $15 / Hard $40** (Hard 는 초과 시 서비스를 정지시키므로 넉넉히)
>
> ### 다음 행동
>
> - [ ] **사용자**: 새 Postgres 의 **`DATABASE_PUBLIC_URL`** 을
>       `C:\Users\gooin\leadpot-backup\railway-db.txt` 에 저장
>       (⚠️ Windows 확장자 숨김 때문에 `railway-db.txt.txt` 로 저장된다 — 실제로 그랬다)
> - [ ] 복원 → 검증(런북 §6, 기준값 §6-1·6-2) → 보안 조이기(§6-3) → Neon 프로젝트 삭제
> - [ ] 실제 전환은 트래픽 적은 시간: VM 정지 → 최종 덤프 → 재복원 → 환경변수 교체 → **델타 확인**
>       (20분에 리드 2건 들어온 실측이 있다 — 델타 처리 필요)
>
> ## 📞 2026-08-13 밤 — 광고주 알림 수신번호 구조 변경 (V33) · 배포됨
>
> **실제로 알림이 끊기고 있었다.** 사용자가 "알림톡 발송 설정이 안 된 것 같다"고 해서 조사했더니
> **알림톡 자체는 정상**이었다(`ATA/SENT` 27건, 마케터·광고주 모두). 원인은 V28 구조였다 —
> 수신번호가 리드폼별이라 **새 리드폼이 배정되면 광고주가 다시 등록해야** 했고, 안 하면 조용히 끊긴다.
> 폼 24 는 등록됨 / 새로 만든 폼 33('더엘-계산기')은 미등록 → 그 폼만 광고주 알림이 안 나갔다.
>
> **바꾼 것 (커밋 `56931eb`, Flyway V33)**
>
> | | 전 | 후 |
> |---|---|---|
> | 등록 단위 | 리드폼마다 따로 | **계정에 한 번 → 배정된 모든 폼 적용**(`users.notify_phone`) |
> | 폼별 예외 | 없음 | 그 폼에만 번호를 넣어 **덮어쓰기**(`grant.notify_phone`) |
> | 폼 전용 번호 비우기 | 발송 중단 | **기본 번호로 복귀**(중단 아님) |
> | 이 폼만 끄기 | 번호 비우기 | **`grant.notify_disabled`** (별도 상태) |
>
> 해석 순서는 `AdvertiserFormGrant.resolveNotifyPhone()` 한 곳에 모았다: **끔 → 폼 전용 → 계정 기본**.
>
> ⚠️ **수신 동의 원칙은 유지**(사용자 결정: "광고주만"). 마케터는 남의 번호를 넣을 수 없고,
> **가입 연락처(`users.phone`)로 폴백하지 않는다** — 계정 식별용이고 동의가 아니다. 회귀 테스트로 고정.
> 완화하려는 유혹이 생기면 [MESSAGING-PLAN.md](MESSAGING-PLAN.md) V28 절의 이유를 먼저 읽을 것.
>
> **마이그레이션이 기존 폼별 번호를 계정 기본값으로 승격**한다(광고주별 최신 1개). 적용 후 폼 33 이
> 즉시 `registered=true`(출처 `ACCOUNT`)로 살아났다 — 사용자가 겪던 증상이 그대로 해결됐다.
> **V33 은 로컬에서 Neon 에 이미 적용됨(v33)** — Railway 는 검증만 하고 건너뛴다.
>
> 함께: 리드폼 편집 구글시트 섹션에 **'시트로 이동 ↗'** 버튼 추가. 저장값이 아니라 **입력칸의 현재 값**으로
> 열어서 저장 전에도 시트가 맞는지 확인할 수 있다.
>
> ### 남은 확인
> - ⛔ **광고주 포털 화면(`/client/integrations`)을 눈으로 못 봤다** — 광고주 계정 로그인이 필요하다.
>   마케터 화면(출처 표시)·API·마이그레이션 결과는 확인했다. 다음 세션에서 광고주 계정으로 볼 것:
>   기본 번호 입력 → 저장 → 폼별 행에 "기본 번호로 받는 중" 배지 / '이 리드폼은 알림 받지 않기' 토글.
> - 실제 리드 1건으로 폼 33 광고주 알림톡이 오는지 확인(Railway 배포 완료 후).

> ## 🧮 2026-08-13 진행중 — 리드팟 계산기 블록 (개인회생 탕감액 1호)
>
> 브랜치 `feature/debt-relief-calculator`. **1단계(계산 함수) 완료 · 2단계(위젯 아키텍처) 설계 승인 대기.**
>
> 목표: 계산기를 특정 랜딩에 박는 게 아니라 **리드팟 공용 기능**으로 만들어, 사용자가 자기 랜딩·리드폼에
> 붙여 쓴다. 나중에 '인터넷 지원금 계산기' 등을 같은 틀로 추가한다. (장기: PRO 플랜 전용)
>
> ### ✅ 1단계 완료 — 계산 함수 (커밋 `3d50bb1`, vitest 33건 통과)
>
> | 파일 | 내용 |
> |---|---|
> | [standards.ts](../frontend/src/lib/calculators/debtRelief/standards.ts) | **2026 기준 중위소득**(복지부 고시, 4인 6.51%↑) + 법령 상수. **연도별 표로 분리** — 2027년엔 표만 추가 |
> | [index.ts](../frontend/src/lib/calculators/debtRelief/index.ts) | `calcDebtRelief()` — 외부 의존 0 순수함수(임베드 번들에 그대로 들어간다) |
> | [index.test.ts](../frontend/src/lib/calculators/debtRelief/index.test.ts) | 손계산 값을 박아둔 33건. 상수표가 잘못 바뀌면 여기서 먼저 깨진다 |
>
> **산식**: 가용소득 = 월 실수령소득 − 생계비(중위소득×60% + 추가생계비)
> → 총변제액 = **max(가용소득×기간, 최저변제액, 청산가치)** → 탕감액 = 무담보채무 − 총변제액
>
> ⚠️ **놓치기 쉬운 것 3개** (시중 계산기들이 여기서 틀린다):
> 1. **가용소득 ≤ 0 이면 개인회생 불가** → 개인파산 트랙(`NO_DISPOSABLE_INCOME`). 갚을 재원이 없는데
>    최저변제액을 갚는다고 계산하는 블로그·계산기가 많다. 우리는 분기해서 파산 상담으로 보낸다.
> 2. **하한을 36개월로 못 채우면 변제기간을 늘린다**(최대 60). 월변제금을 가용소득 위로 올리는 건 불가능.
> 3. **재산 미입력 = 탕감액 과대추정**(위험한 방향) / 추가생계비 미입력 = 과소추정(안전한 방향).
>    → `assumptions` 플래그로 전제를 화면에 반드시 노출한다.
>
> ⛔ **주거비 추가생계비 지역별 표는 아직 미확보** (서울 1인 최대 589,208원만 확인).
> 지금은 `extraLivingCost` 로 직접 받는다. 서울회생법원 실무준칙 별표를 구하면 자동화 가능.
>
> ### 🔎 2단계 조사 결과 — **새로 만들 게 거의 없다**
>
> | 필요한 것 | 이미 있는 것 |
> |---|---|
> | 랜딩 버튼 → 클릭하면 계산기 올라옴 | 랜딩 `FORM` 블록의 `trigger:"overlay"`+`buttonLabel` — [LandingView.tsx:88](../frontend/src/components/LandingView.tsx#L88) |
> | 단계별 질문 UX(참고사이트 방식) | `formType:"STEP"` — 카드선택·숫자·연락처·마지막 안내문구 |
> | 계산 결과를 리드에 저장 | `answers` JSONB `{label,fieldType,value}` — **마이그레이션 불필요** ([Lead.java:38](../backend/src/main/java/com/leadpot/lead/Lead.java#L38)) |
> | 외부 사이트 임베드 | `embed.js` Shadow DOM ([embed.tsx](../frontend/src/embed/embed.tsx)) |
> | PRO 전용 잠금 | `Plan{FREE,PRO}` 이미 존재 ([Plan.java](../backend/src/main/java/com/leadpot/auth/Plan.java)) |
>
> **→ 결론: 계산기 = 리드폼의 새 블록 `CALC` 한 개.** "계산기 + 리드폼"이 아니라 **계산기가 리드폼이다**
> (사용자 판단과 동일). 계산기 전용 페이지·전용 엔티티를 새로 만들지 말 것.
>
> ### ✅ 2단계 완료 — 계산기 블록 (커밋 `d117c21`, 테스트 49건)
>
> **사용자 결정 3건 확정(2026-08-13)**: ① 입력 매핑 = **질문 자동 생성**(수동 매핑 아님) /
> ② 결과 표시 = **탕감액 + 산출 근거 함께**(접어서) / ③ 면책 문구 = **우리가 강제**(마케터가 못 지움)
>
> | 계층 | 파일 |
> |---|---|
> | 계산기 규격 | [types.ts](../frontend/src/lib/calculators/types.ts) — `CalculatorDef` |
> | **계산기 등록소** | [registry.ts](../frontend/src/lib/calculators/registry.ts) — ⭐ **계산기 추가는 여기만 건드린다** |
> | 탕감액 계산기 정의 | [debtRelief/definition.ts](../frontend/src/lib/calculators/debtRelief/definition.ts) — 질문 스펙·표시 문구·리드 저장 형태 |
> | 결과 화면(범용) | [CalcResultView.tsx](../frontend/src/components/formRenderers/CalcResultView.tsx) — 계산기 종류와 무관 |
> | 공개 폼 통합 | [PublicFormView.tsx](../frontend/src/components/PublicFormView.tsx) — 질문→**계산 결과**→연락처 |
> | 빌더 | [FormEditPage.tsx](../frontend/src/pages/FormEditPage.tsx) — 종류 선택 카드 + 계산 입력 배지·잠금 |
> | 블록타입 | [BlockType.java](../backend/src/main/java/com/leadpot/form/BlockType.java) `CALC` 추가 — **마이그레이션 없음**(block_type 은 varchar, 체크제약 없음) |
>
> **마케터 화면**: 리드폼 만들 때 종류를 고른다 — 기본형 / 스텝형 / 🧮 개인회생 탕감액 계산기.
> 사용자 아이디어대로 독립된 종류로 보이지만 **`formType` 은 늘리지 않았다**(BASIC/STEP 분기를 전부
> 3-way 로 고쳐야 하고 계산기가 늘 때마다 enum 이 늘어난다). 내부는 `STEP` + `CALC` 블록.
>
> ### 🔌 픽셀·문자·알림톡·시트 — **백엔드 변경 없이 그대로 동작한다** (실제 코드로 확인)
>
> | 기능 | 왜 되는가 |
> |---|---|
> | 픽셀 | 폼 `trackingConfig` → 제출 시 `firePixelLead()`. 계산기는 폼이라 그대로 |
> | 문자·알림톡 | [TemplateRenderer:116](../backend/src/main/java/com/leadpot/sms/TemplateRenderer.java#L116) 이 답변을 **varKey 와 label 둘 다로** 색인 → `{{예상 탕감액}}` 이 치환된다 |
> | 구글시트 | [NotificationService:365](../backend/src/main/java/com/leadpot/integration/NotificationService.java#L365) 가 헤더를 **리드의 실제 답변에서** 만든다 → 계산 결과가 자동으로 새 열 |
> | 카톡·디스코드 | 같은 `answersMap` 사용 |
>
> ⚠️ **막은 구멍**: 빌더 변수 목록이 `varKey` 있는 블록만 보여줘서, `{{예상 탕감액}}` 이 **되는데도
> 마케터가 알 수 없었다** → 계산 결과 변수 버튼(🧮)을 문자 편집기에 추가했다.
>
> ### ⚠️ 다음 세션이 알아야 할 함정
>
> 1. **`outputLabels` 와 `toAnswers()` 의 label 이 어긋나면** 마케터가 넣은 `{{변수}}` 가 빈칸으로
>    나간다. 그리고 **이 label 이 곧 구글시트 열 이름**이라 바꾸면 이미 붙여둔 시트가 어긋난다.
>    → `definition.test.ts` 가 이 일치를 검증한다. 이름을 바꿀 땐 테스트가 먼저 깨진다.
> 2. **값 수집은 인덱스가 아니라 `content.calcInput` 키로** 한다 → 마케터가 단계 순서를 바꿔도 안 깨진다.
> 3. **미선택과 0을 구분해서** 계산기에 넘긴다(`undefined` vs `0`) → '재산 없음 가정' 경고가 정확히 붙는다.
> 4. 계산 입력 단계는 **답변 방식을 잠갔다**. 숫자를 장문으로 바꾸면 계산이 조용히 깨진다.
>
> ### ✅ 브라우저 실확인 완료 (2026-08-13, gooin PC · 로컬+Neon · 모바일 375px)
>
> 빌더에서 계산기 폼 생성 → 공개 폼 6단계 → 계산 결과 → 연락처 → 접수 → 리드 저장 → CSV 까지 통과.
> 재편집 시 계산기 선택·"계산 입력" 배지 6개 복원도 확인. (테스트로 만든 폼·리드는 삭제했다.)
>
> | 케이스 | 결과 |
> |---|---|
> | 채무 8,000만 / 월소득 450만 / 3인 / 재산 1,000만 / 자녀 1명 | 탕감 **4,095만원(51.2%)** · 월 108만 × 36개월 — 손계산 일치 |
> | 위에서 월소득만 300만으로 | 생계비(341만 = 321만+교육비 20만) 이하 → **개인파산 안내로 분기** |
>
> 리드 저장 확인: 질문 답변 8개(varKey `f1~f8`) + 계산 결과 5개(`fieldType:"calc"`).
>
> **🐞 이때 찾아 고친 버그 2개** (커밋 `b6fda5a`):
> 1. **CSV·엑셀에 계산 결과 열이 빠졌다.** 내보내기 열은 서버가 **블록**에서 만드는데(FIELD·CHOICE)
>    CALC 이 빠져 있었다. **구글시트는 리드의 실제 답변에서 헤더를 만들어 정상** — 두 경로가 다르다.
>    → 저장 시 CALC content 에 `outputLabels` 를 심고 서버 `exportColumnLabels()` 가 그걸로 열을 붙인다.
>    가져오기(`importRows`)에는 넣지 않는다(계산 결과는 사람이 채우는 값이 아니다).
>    ⚠️ **기존 계산기 폼은 한 번 다시 저장해야** `outputLabels` 가 심긴다.
> 2. 새 폼에서 계산기를 고를 때 불필요한 "질문이 사라집니다" 확인창 → `isPristineSteps()` 로 구분.
>
> ### 🔧 질문 6개 → 4개 (사용자 결정 2026-08-13, 커밋 `4e42c81`)
>
> 최종 질문: **① 총 채무액 ② 월 실수령소득 ③ 부양가족 ④ 재산**
>
> - **주택담보대출 단계 삭제** — 1번 질문 설명에 "주택담보대출은 빼고 입력" 으로 안내(B안).
>   ⚠️ 제외 안 하고 입력하면 **탕감액 과대 추정**(위험한 방향)이므로 이 안내 문구는 지우면 안 된다
>   (`definition.test.ts` 가 문구 존재를 검증한다). 계산에는 `securedDebt: 0` 을 **명시**한다 —
>   `undefined` 면 "담보 대출을 분리하지 않았다" 경고가 늘 붙어 거짓 안내가 된다.
> - **미성년 자녀 단계 삭제** — 주거비(서울 1인 최대 58.9만) > 교육비(20만)인데 주거비 표가 없어
>   못 받는 상황. 큰 항목 빼고 작은 항목만 받으면 어중간하다. 추가생계비를 0 으로 통일하면
>   탕감액이 **낮게** 나오고(안전) "인정받으면 더 늘어납니다" 경고가 상담 훅이 된다.
>   `calcDebtRelief` 는 `minorChildren`·`extraLivingCost` 를 계속 지원 — 표 구하면 되살린다.
> - ⛔ **선택지 카드로 담보채무를 받으면 안 된다** — 총채무에서 **빼는** 값이라 구간을 크게 잡으면
>   변제 대상 채무가 0이 되어 "계산 불가"가 된다. (재산은 더하는 방향이라 구간이 안전하다.)
>
> 같은 입력(채무 8,000만/월 450만/3인/재산 1,000만) 기준 **4,095만원(51.2%) → 3,375만원(42.2%)**.
>
> ### 🚨 2026-08-13 저녁 — **계산이 거의 전부 파산으로 오판되던 버그 수정** (커밋 `fcc9288`)
>
> 사용자가 실사용 중 "계산할 때마다 개인파산이 낫다고 나온다"고 발견. **법리를 잘못 적용했다.**
>
> - **원인**: `가용소득 ≤ 0 → 개인회생 불가` 로 못 박았다. 2026 생계비가 3인 **322만**·4인 **390만**이라
>   개인회생 신청자 상당수가 그 밑이다 → 전부 파산으로 빠졌다.
> - **바로잡은 법리**: 60%는 **원칙값**이고 법원은 "60%보다 높거나 낮게" 인정할 수 있다. 소득이 60%
>   미만이어도 **생계비를 줄여 신청하면** 최저변제액만 갚고 인가된다. 그래서 탕감률 90%대 사례가 흔하다.
>   → 앞서 "시중 계산기·블로그가 이 부분을 틀렸다"고 적은 것은 **내(Claude) 판단이 틀렸다.**
> - **수정한 산정 순서**:
>   1. 원칙 생계비(60%)로 60개월까지 하한(최저변제액·청산가치)을 채우면 그대로
>   2. 못 채우면 **생계비를 줄인 안**(필요 월변제금 = 하한 ÷ 60개월)으로 다시 본다 → `LIVING_COST_REDUCED`
>   3. 줄인 생계비가 **생계급여 기준(중위소득 32%)** 미만이면 그때만 파산 트랙 → `INSUFFICIENT_INCOME`
> - 검증: 월 300만·3인·채무 8,000만·재산 1,000만 → 이전 "파산" / 지금 **87.5% · 6,999만원**.
>   파산 경계선도 테스트로 고정(1인 월 845,000 불가 / 846,000 가능).
>
> ⚠️ **다음에 이 계산기를 만질 때**: `가용소득 음수 = 회생 불가` 는 **틀린 전제**다. 되돌리지 말 것.
>
> ### 🔀 흐름 변경 — `질문 → 정보 입력 → 결과` (사용자 결정)
>
> 이전엔 결과를 먼저 보여줬다. 결과만 보고 나가면 **리드가 안 남는다** → 참고 사이트들처럼
> 연락처를 받고 그 자리에서 결과를 공개한다. 접수(DB 저장)가 결과보다 **먼저** 일어난다.
>
> - 게이트 화면(`gate`): 제목·강조·체크목록·제출 버튼 문구를 **계산기 정의**에서 가져온다
> - 제출 직후 **3초 로딩** → 결과 공개. 즉시 뜨면 숫자의 무게가 안 실린다
> - 결과 표시 우선순위 반전: **탕감률을 가장 크게(88px)** → 금액 → 월 변제금
> - 결과 아래 `followUp`: 상담 전화 안내
> - 파산 안내를 "안 됩니다"에서 **"개인파산이 유리할 수 있습니다 + 무료 상담"** 으로.
>   재산 때문에 막힌 경우는 파산이 오히려 불리하므로(재산이 처분된다) 별도 문구로 분기
> - ⛔ **'AI' 표현 금지**(사용자 결정) — 법정 산식 계산이라 AI 가 아니다. 테스트로 재발 방지
> - 질문 문구: "**본인의** 월 소득" · "**본인이 부양하는** 가족" — 배우자 소득을 합산하거나
>   소득 있는 가족을 부양가족에 넣으면 생계비가 부풀려져 결과가 틀린다
>
> **구조 개선**: `toAnswers` 가 화면 문구를 정규식으로 파싱하던 것을 `CalcView.data` 로 분리.
> 표시 문구를 손볼 때마다 리드 저장·시트 열이 조용히 깨지던 위험을 없앴다.
>
> ### ➕ 게이트 설명 + 미리보기 일치 (커밋 `412a35c`, 배포됨)
>
> - 게이트에 **"탕감액이 무엇인가요?"** 설명 추가(`gate.explain`) — 용어를 모르면 숫자만 커도 와닿지 않는다.
> - ⚠️ **빌더 미리보기가 실물과 달랐다.** 미리보기는 [StepFormRenderer](../frontend/src/components/formRenderers/StepFormRenderer.tsx),
>   공개 폼은 [PublicFormView](../frontend/src/components/PublicFormView.tsx) 를 쓰는데 미리보기가 계산기를 몰랐다.
>   → 같은 `CalcGateView` 를 쓰게 하고 진행 표시·제출 버튼 문구도 통일했다.
>   **계산기 UI 를 고칠 때는 이 두 렌더러를 항상 같이 봐야 한다.**
> - '완료 화면' 미리보기를 **'접수 후 결과 화면'**(계산 결과 + 상담 안내)으로 교체 —
>   계산기 폼은 접수 후 완료 안내가 아니라 결과가 나간다. 예시 값은 `sampleInput`(계산기 정의)이고
>   미리보기 예시가 '계산 불가'로 나오지 않도록 테스트로 고정했다.
>
> ### 👉 남은 일
> - 폼 목록에서 계산기 폼이 그냥 **"스텝형"** 으로 보인다 → "계산기" 배지를 붙이면 좋겠다(미구현).
> - 랜딩에 버튼으로 띄우기(`trigger:"overlay"`)는 코드가 이미 있으나 **계산기로는 확인 안 했다.**
> - 구글시트 실연동·문자 변수(`{{예상 탕감액}}`) 실발송은 **코드로만 확인**했고 실제로 쏴보진 않았다.
> - PRO 플랜 게이트는 아직 안 넣었다(`Plan{FREE,PRO}` 존재). 지금은 전원 사용 가능.
> - 주거비 추가생계비 지역별 표(서울회생법원 실무준칙 별표) 확보되면 `extraLivingCost` 자동화.
> - 랜딩에 버튼으로 띄우기는 기존 `trigger:"overlay"` 를 그대로 쓰면 된다(추가 개발 없음) — 확인만 필요.

> ## 🔄 구글시트 열 밀림 사고 수정 — 코드·테스트 완료, 실시트 확인 남음 (2026-08-12)
>
> 브랜치 `fix/sheets-column-alignment`. **시트에 쌓이는 리드가 한 칸씩 왼쪽으로 밀리는 사고**를 고쳤다.
>
> **증상**: `법률사무소 더엘` 시트의 `2026-08-12 15:38 김민희` 행이 `접수일시 → no` 칸부터 시작해
> 전부 한 칸 밀렸다. **연락처가 이름 칸에 들어가고 연락처 칸이 비었다** — 그 리드는 콜 리스트에서 누락된다.
>
> **원인**: Sheets API 의 `values.append` 는 넘긴 범위가 아니라 **감지한 표의 첫 열부터** 쓴다.
> 사용자가 시트 왼쪽에 자기 열(`no`)을 삽입한 순간부터 표의 첫 열이 A 가 되어, 그때부터 모든 신규 리드가 밀렸다.
> (8/11 두 행과 9:35 행의 A열이 빈 것은 열 삽입으로 기존 행이 오른쪽으로 밀린 흔적 — 밀린 건 15:38 행뿐이다.)
>
> **수정**: `append` 를 버리고 **1행을 읽어 `헤더명 → 열` 로 맞춘 뒤 그 열에만 쓴다**
> ([GoogleSheetsClient](../backend/src/main/java/com/leadpot/integration/GoogleSheetsClient.java)).
> - `no`·`특이사항`·`1차콜` 처럼 **사용자가 손으로 관리하는 열은 쓰기 범위에서 빠진다** — 절대 덮지 않는다.
>   붙어 있지 않은 열은 범위를 쪼개 보낸다(`A10:A10` + `C10:D10`).
> - 열을 **삽입·순서변경** 해도 안 밀린다. 헤더에 없는 **새 문항**은 오른쪽 끝에 열을 만들어 넣는다
>   (예전엔 조용히 다른 열로 들어갔다).
> - **이미 데이터가 있는 시트에 붙여도 된다** — 헤더 이름만 맞으면 그 열로 들어간다. (아래 옛 ⚠️ 주의는 폐기)
> - 행(1000)·열(26)이 꽉 찬 시트는 `appendDimension` 으로 넓히고 한 번 재시도한다
>   (`update` 는 `append` 와 달리 격자를 자동으로 넓혀주지 않는다).
> - API 호출 수는 그대로 2회(읽기 1 + `values.batchUpdate` 1).
>
> **남은 것 / 주의**
> - ❗ **실제 시트로 확인 못 했다** — 백엔드 전체 테스트만 통과(`GoogleSheetsClientTest` 헤더 매칭 7건 신규).
>   배포 후 리드폼 옵션의 **'시트 테스트 발송'** 으로 `B`열부터 들어가는지 눈으로 볼 것.
> - ❗ **이미 밀린 `김민희` 행은 손으로 고쳐야 한다**(코드가 과거 행을 고치지는 않는다).
> - `no` 는 우리가 쓰지 않는 사용자 열이다. 자동 번호가 필요하면 시트 수식으로:
>   `A2` 에 `=ARRAYFORMULA(IF(B2:B="","",ROW(B2:B)-1))`.
>
> ## 🔄 광고주 리드 확인 추적(V33) — 코드 완료, 실환경 확인만 남음 (2026-08-12)
>
> 브랜치 `feature/advertiser-lead-activity`. **마케터 리드 상세에서 "광고주가 이 리드를 보기는 했나"를 확인**할 수 있게 했다.
>
> **왜**: `advertiser_seen_at` 한 칸으로는 "봤다/안 봤다" 한 비트뿐이라, 언제·몇 번 봤는지도
> 열어만 보고 말았는지도 알 수 없었다. 새 표를 만들지 않고 이미 쌓던 `advertiser_access_logs` 를 리드 단위로 모아서 답한다.
>
> - **열람 이력을 매번 기록**([AdvertiserLeadService.lead](../backend/src/main/java/com/leadpot/advertiser/AdvertiserLeadService.java)) —
>   예전엔 최초 1회만 남겼다. 새로고침 폭주 방지로 **30분 dedupe 창**을 뒀다.
> - **마케터 API** `GET /api/leads/{id}/advertiser-activity`
>   ([AdvertiserLeadActivityService](../backend/src/main/java/com/leadpot/advertiser/AdvertiserLeadActivityService.java)).
>   확신 등급 4단계: `NO_ADVERTISER`(섹션 숨김) / `NOT_VIEWED` / `VIEWED` / `ACTED`(상태변경·메모까지 = 가장 강한 증거).
> - **리드 상세 '광고주 확인' 섹션**([LeadSidePanel.tsx](../frontend/src/components/LeadSidePanel.tsx)) —
>   배지 + 접수→최초열람 소요시간 + 열람 횟수 + 접었다 펴는 이력.
> - ⭐ **광고주 화면에서는 확인/미확인을 전부 걷어냈다**(사용자 지시 2026-08-12) —
>   미확인 배너·할 일 카드·'미확인만' 필터·카드 강조·폼 배지·리포트의 미확인율/평균 확인까지.
>   **기록은 계속 쌓인다** — 마케터만 본다.
>
> **남은 것 / 주의**
> - ❗ **실환경(로컬 기동) 확인을 못 했다** — 백엔드·프론트 빌드와 테스트(신규 `AdvertiserLeadActivityTest` 7건 포함)만 통과.
>   광고주 계정으로 리드를 열어보고 마케터 화면에서 타임라인이 뜨는지 눈으로 볼 것.
> - 광고주 API 응답(`unseenCount`·`unseenLeads`·`unseenRate`)에는 숫자가 **아직 실려 나간다**. 화면에만 안 그린다 —
>   DTO 를 마케터/광고주용으로 쪼개야 서버에서까지 지울 수 있어서 이번엔 손대지 않았다.
> - 알림톡 `#{미확인건수}` 변수는 그대로 뒀다(카카오 사전 승인 템플릿이라 코드로 임의 변경 불가).
> - 후속 후보(사용자가 A 범위만 선택): 알림톡 도달(`message_logs`)·텔레그램·시트 동기화까지 합친 **통합 타임라인**(B),
>   체류시간·연락처 노출 계측(C).
>
> ## ✅ 구글시트 서비스 계정 전환 — 배포·검증 완료 (2026-08-11)
>
> `main` 병합 `adba648`(작업 커밋 `0bdd16c`). **Railway 변수 등록 + 화면 확인까지 사용자 완료.**
> 시트 연동을 **Apps Script 웹앱 → 서비스 계정 + Sheets API** 로 **완전히 교체**했다(사용자 결정 2026-08-11).
>
> - `GOOGLE_SHEETS_CREDENTIALS` 는 **Railway Variables** 에 있다(base64). VM `.env` 에는 **없다** —
>   ⚠️ VM 으로 롤백하게 되면 거기에도 같은 변수를 넣어야 시트가 돈다.
> - 배포 직후 `api.lead-pot.com` 이 잠깐 502 였다(Railway 재시작). 곧 `200 UP` 복귀 — 정상 동작.
>
> **왜 바꿨나**: 웹앱은 *실행 계정 = 배포한 사람* 이라, 우리가 광고주 시트에 대신 세팅해준 뒤
> 시트 공유에서 빠지면 **조용히 끊긴다**(재시도 없음 + 실패가 화면에 안 뜬다 —
> `NotificationLogRepository.findByLeadIdOrderByCreatedAtAsc` 는 아무 데서도 호출되지 않는다).
> 서비스 계정은 사람 계정과 분리돼 있어 그 문제가 없고, **시트 ID 만 받으면 우리가 대신 연동해줄 수 있다.**
>
> ### 광고주 시트 하나 붙이는 절차 (운영 매뉴얼)
>
> 1. `/integrations` 에서 **서비스 계정 이메일 복사**.
> 2. 대상 시트 → **공유** → 그 이메일을 **편집자**로 추가(알림 메일 체크는 끈다 — 서비스 계정은 메일함이 없다).
>    ⭐ **내가 그 시트의 편집자면 내가 직접 추가하면 된다** — 광고주에게 이메일을 전달할 필요가 없다.
>    (시트 주인이 "편집자의 권한 변경·공유"를 꺼둔 경우에만 광고주가 직접 추가해야 한다.)
> 3. 리드폼 편집 > 옵션 > 구글시트 → **시트 주소 붙여넣기**(주소 통째로 OK) + 탭 이름(비우면 맨 앞 탭) → **저장**.
> 4. 같은 화면 **'시트 테스트 발송'** 으로 확인.
>
> ~~⚠️ **연결할 시트/탭은 비어 있어야 한다** — 헤더는 시트가 완전히 빈 경우에만 만들어진다.
> 내용이 있는 시트에 붙이면 헤더 없이 아래에 붙어 열이 안 맞는다.~~
> → **폐기(2026-08-12)**: 이제 헤더 이름으로 열을 찾으므로 **데이터가 있는 시트에 붙여도 된다**.
> 위 '구글시트 열 밀림 사고 수정' 참고.
>
> ### 검증한 것 / 못 한 것
>
> - ✅ 백엔드 컴파일·전체 테스트 통과(신규 `GoogleSheetsClientTest` 8건 포함) · 프론트 `tsc` + 빌드 통과.
> - ✅ 배포 후 `/integrations` 에 서비스 계정 이메일 표시 확인(사용자) · `api/health` `200 UP`.
> - ❌ **실제 광고주 시트에 리드가 쌓이는 것까지는 아직 안 봤다** — 첫 실사용 때 한 번 확인할 것.
>
> ### 남은 일
>
> - **기존 연동 사용자에게 재설정 안내** — 웹앱 URL 방식은 더 이상 동작하지 않는다.
>   옮기기 전까지 그 리드폼은 시트에 쌓이지 않는다. `/integrations` 에 안내 문구는 넣어뒀다.
>
> ### 이어받는 사람이 알아야 할 것
>
> - `settingsConfig` 키가 바뀌었다: ~~`sheetsWebhookUrl`·`sheetsSecret`~~ → **`sheetsSpreadsheetId`·`sheetsTabName`**.
>   공유 시크릿은 구글이 인증해주므로 없앴다.
> - **Flyway 마이그레이션 없음** — 설정이 `form.settingsConfig`(JSONB)라 스키마 변경이 필요 없었다. **다음은 여전히 V33.**
> - 계정 테이블 `integration_settings` 의 `sheets_*` 컬럼은 예전부터 미사용이고 그대로 뒀다(파괴적 변경 금지 규칙).
> - 열 순서는 예전 Apps Script 와 같다(`접수일시 · 리드폼 · 답변…`, 헤더는 시트가 비었을 때만 생성) — 사용자 확정.
>   ⚠️ **리드폼 항목을 나중에 바꾸면 그 시점부터 열이 밀린다**(예전과 동일한 한계). 헤더 이름 매칭은 선택하지 않았다.
> - 접수일시는 UTC ISO 문자열 대신 **한국시간 문자열**로 넣는다(시트가 날짜로 인식 → 정렬·필터가 먹는다).
> - ⚠️ **`sendSheets()` 로 Make·Zapier 웹훅을 우회 호출하던 뒷문이 사라졌다** — 이제 시트 ID 만 받는다.
>   MESSAGING-PLAN.md 에 적혀 있던 그 우회로는 무효 처리했다.
> - ⚠️ 광고주 회사가 **외부 공유 금지** 워크스페이스 정책이면 서비스 계정 추가가 막힐 수 있다(Apps Script 도 같은 벽).
>
> ---
>
> ## 🌅 2026-08-12 착수 예정 — 광고주 화면 보강 (사용자 지시 2026-08-11 밤)
>
> ### ① 광고주 삭제 — ✅ **이미 다 만들어져 있다. 새로 만들지 말 것.**
>
> 사용자가 "만들 것"으로 알고 있었으나 조사 결과 완성돼 있다(2026-08-11 확인).
>
> | 계층 | 위치 |
> |---|---|
> | API | `DELETE /api/advertisers/{id}` — [AdvertiserController.java:83](../backend/src/main/java/com/leadpot/advertiser/AdvertiserController.java#L83) |
> | 서비스 | [AdvertiserService.delete:289](../backend/src/main/java/com/leadpot/advertiser/AdvertiserService.java#L289) — grants 먼저 지우고 계정 삭제 |
> | 화면 | `/advertisers` 카드 메뉴 **"계정 삭제"**(빨강) + 확인 다이얼로그 — [AdvertisersPage.tsx:376](../frontend/src/pages/AdvertisersPage.tsx#L376) |
> | 정지/해제 | `AdvertiserService:270` — 정지하면 로그인·토큰 재발급이 즉시 막힌다 |
>
> - **리드 데이터는 남는다**(계정만 삭제). 리드 메모의 작성자는 `on delete set null`(V27)로 끊어지고
>   화면엔 '삭제된 광고주'로 표시된다.
> - ⚠️ 과거에 **메모를 남긴 광고주가 FK 위반으로 삭제 안 되던 버그**가 있었고 V27 로 고쳤다(2026-08-06).
> - **→ 내일 할 일은 "만들기"가 아니라 "실제로 잘 되는지 확인"이다.** 사용자가 원하는 동작과
>   지금 동작(계정만 삭제·리드 유지)이 같은지부터 물어볼 것. 다르면 그때 범위를 잡는다.
>
> ### ② 광고주 페이지에 전환율 추가 — 🆕 **새로 만들어야 한다**
>
> 광고주 리포트에 지금 있는 것: **미확인율 · 평균 확인까지 · 평균 처리까지 · 상태 분포**
> ([AdvertiserReportResponse.java](../backend/src/main/java/com/leadpot/advertiser/dto/AdvertiserReportResponse.java) · [AdvertiserReportPage.tsx](../frontend/src/pages/AdvertiserReportPage.tsx)).
> **전환율(방문 → 접수)은 없다.**
>
> 마케터 쪽엔 이미 있으므로 **계산 로직을 새로 짜지 말고 재사용**한다:
> [StatsService](../backend/src/main/java/com/leadpot/stats/StatsService.java) · [StatsResponse](../backend/src/main/java/com/leadpot/stats/StatsResponse.java) · [Visit](../backend/src/main/java/com/leadpot/visit/Visit.java) · 화면은 [StatsPage.tsx](../frontend/src/pages/StatsPage.tsx).
>
> **착수 전에 사용자에게 물을 것** (CLAUDE.md §0):
> 1. **어느 화면인가** — 광고주 포털(`/client/report`, 광고주 본인이 봄)인가, 마케터가 보는 광고주별 화면인가? 둘 다인가?
> 2. **전환율의 분모** — 방문수 대비 접수인가(마케터 통계와 같은 정의), 아니면 접수 대비 유효(`VALID`)인가?
>    광고주 입장에선 후자가 더 관심사일 수 있다. **둘은 완전히 다른 지표다.**
> 3. **광고주에게 방문수를 보여줘도 되는가** — 마케터의 트래픽 규모가 드러난다. 영업상 민감할 수 있다.
>    (그래서 지금 광고주 화면엔 접수 이후 지표만 있는 것으로 보인다 — 의도된 설계인지 확인 필요)
>
> ⚠️ 3번이 핵심이다. 방문수를 광고주에게 그냥 노출하면 되돌리기 어렵다.

> ## ✅ 2026-08-11 — 알림톡(M7) **배포 완료** · main `adcbd25`
>
> **마케터·광고주 접수 알림이 이제 알림톡으로 나간다. 문자는 고객향 전용.** (건당 18원 → 13원)
> 배포 3단계(코드 push → 관리자 화면 ATA 체크 → Railway Variables 주입) 전부 완료. 사용자 확인 "다 됐다".
>
> **⚠️ 첫 실사용 발송은 아직 지켜봐야 한다** — 개발 중엔 로컬에 솔라피 키가 없어 실제 발송을 못 해봤다.
> 다음 세션은 `/sms` 이력에서 **채널 `ATA` 건이 `SENT` 인지** 먼저 확인할 것. 실패하면 사유가 그대로 남아 있다.
> 대체발송을 껐으므로(`disableSms=true`) **실패하면 문자로도 안 간다** — 조용히 유실되지 않게 이력을 봐야 한다.
>
> **되돌리기**: Railway Variables 에서 `APP_SMS_SOLAPI_PF_ID`·`_ATA_TEMPLATE_ID` 두 줄을 지우면
> 자동 재배포되며 즉시 문자로 복귀한다(재배포 불필요·코드 수정 불필요).
>
> **권한 구조 메모**: 발송 비용 주체가 리드폼 소유자라 **마케터 계정에만 ATA 를 켜면 광고주 알림도 나간다.**
> 단 광고주향은 ① 리드폼에서 토글 ON ② 광고주 계정 연결 ③ **광고주 본인이 포털에서 번호 등록**(V28, 폴백 없음)
> 세 조건이 다 맞아야 한다.
>
> <details><summary>구현 상세 (접힘)</summary>
>
> ### 🔔 (원문) 알림톡(M7) 코드 작업 · 브랜치 `feature/alimtalk-notify`
>
> 솔라피 카카오 채널·템플릿 **승인 완료**(2026-08-10). 마케터·광고주 접수 알림을 문자 → **알림톡**으로 옮겼다.
> **문자는 이제 고객향 전용**이다(정산 알림은 예외 — 템플릿과 무관한 내용이라 문자 유지).
>
> **한 일**: `SolapiSmsSender.sendAlimtalk`(kakaoOptions) · `SmsService` ATA 분기 + **설정 없으면 문자 폴백** ·
> `SmsPermissions` 에 `ATA` 채널 · `LeadRepository` 미확인 건수 2종 · `LeadSmsPlanner` 변수 4개 ·
> `/sms` **알림톡 테스트** 버튼 · 관리자 화면 ATA 체크박스 · 리드폼 편집 문구.
> 테스트 233건 통과 · `tsc -b` 통과. **Flyway 불필요**(다음은 여전히 V33).
>
> **🚨 배포 순서를 지켜야 알림이 안 끊긴다** (기존 계정에 `ATA` 채널이 없어 먼저 env 를 넣으면 전부 SKIPPED):
> 1. 코드 배포 — **환경변수 없이** (이 상태에선 문자로 그대로 나간다, 무변화)
> 2. 관리자 화면에서 계정별 **ATA 채널 체크**
> 3. VM `~/Leadpot/.env` 에 아래 두 줄 추가 + 재기동 → **알림톡 전환**
>    ```
>    APP_SMS_SOLAPI_PF_ID=KA01PF260804155252497tMhE0GwIYAy
>    APP_SMS_SOLAPI_ATA_TEMPLATE_ID=KA01TP260804155905596UWBE9zFG5Up
>    ```
> 4. `/sms` → **알림톡 테스트** 버튼으로 수신 확인 → 실제 리드 1건으로 자동 발송 확인
>
> **되돌리기**: env 두 줄 지우고 재기동 → 즉시 문자로 복귀(재배포 불필요).
>
> **⚠️ 아직 검증 못 한 것**: 로컬에 솔라피 API 키가 없어(`application-local.properties` 는 DB 접속정보뿐)
> **실제 발송을 한 번도 못 해봤다.** 위 4번이 첫 실사용 검증이다. 특히 확인할 것 —
> ⓐ 변수 4개가 실제로 치환돼 도착하는지 ⓑ 실패 시 `FAILED` 로 이력에 남는지(대체발송을 껐다)
> ⓒ 광고주가 버튼을 누르면 마케터 화면(`/leads`)으로 간다 — **의도한 동작**(사용자 결정).
>
> 상세는 [MESSAGING-PLAN.md §9](MESSAGING-PLAN.md).
>
> </details>

> ## 🏁 2026-08-09~10 세션 마감 (gooin PC) — main `cc9da7f`, 배포·검증 완료
>
> **이 블록만 읽어도 이어받을 수 있게 정리한다. 아래 상세 항목들은 근거·경위다.**
>
> ### 이번 세션에 한 일 (전부 main 병합·배포·실사용 검증 완료)
>
> | # | 내용 | 핵심 파일 |
> |---|---|---|
> | 1 | HTML 편집기에 **이미지 업로드 버튼**(R2 업로드 → `<img>` 삽입 + URL 복사) | [HtmlImageUploadButton.tsx](../frontend/src/components/HtmlImageUploadButton.tsx) |
> | 2 | **업로드·내보내기 401 실패 수정** — FormData·blob 요청 7곳이 토큰 자동 재발급을 안 탔다 | `client.ts` `authedFetch` |
> | 3 | 랜딩 블록 **'좌우 여백 없이 전체 폭'** 옵션 | `LandingView.tsx` / `LandingEditPage.tsx` |
> | 4 | 리드폼 **'기본 선택'** + **연락처 3칸 입력**(010 기본·자동 이동) | [PhoneInput3.tsx](../frontend/src/components/PhoneInput3.tsx) |
> | 5 | **전환 이벤트 선택**(당근·메타) + 픽셀 **'사용할 픽셀 선택'** 칩 UI | [PixelFields.tsx](../frontend/src/components/PixelFields.tsx) |
> | 6 | 리드폼 편집 **카드 제목 확대·접기**(10개, 접힘 상태 브라우저 기억) | `FormEditPage.tsx` |
> | 7 | 🔒 **공개 응답에서 `settingsConfig` 제거** — 시트 시크릿·알림번호 유출 차단 | `FormResponse.publicOf` |
> | 8 | 구글시트 전송을 **접수일시·리드폼·답변**만으로 축소 | `NotificationService.buildSheetsBody` |
> | 9 | ⭐ **'미확인'을 리드 상태에서 분리**(V32 `leads.seen_at`) + '확인으로 변경' 일괄 버튼 | `LeadService.markSeen` |
>
> ### ⚠️ 이어받는 세션이 반드시 알아야 할 것
>
> 1. **Flyway V32 를 추가했다**(사용자 승인 2026-08-10). 이전 기간 금지 규칙을 깬 것인데,
>    `seen_at` 은 **nullable 컬럼 추가**라 구버전 VM 백엔드가 몰라도 무해하고 롤백 경로도 살아 있다.
>    → **다음은 V33.** 단 VM 이 아직 살아 있으므로 **테이블 변경·컬럼 삭제 같은 파괴적 변경은 여전히 금지.**
> 2. **기존 리드는 전부 '미확인'으로 보인다** — 열람 기록이 없던 데이터라 그렇다.
>    사용자에게 "전체 선택 → 확인으로 변경" 으로 한 번 정리하라고 안내했다.
> 3. **시트 연동을 이미 켠 사용자는 Apps Script 재배포가 필요하다** — 코드에서 '상태·중복' 열을 뺐다.
>    안 해도 동작하지만 그 두 열이 빈칸으로 쌓인다. 안내 문구는 `/integrations` 에 넣어뒀다.
> 4. **문자 발송은 정상이다.** 이전 기록의 "솔라피 IP 로 문자 전체 장애"는 **내 추론 오류였고 정정했다**
>    (§아래 🟠 항목). 실제 실패는 **문자 첨부 업로드(MMS)** 하나뿐이다.
> 5. **다른 세션이 같은 저장소를 동시에 만졌다** — 커밋 `dedf846`(리드폼 편집기 UI)은 내가 만든 게 아니다.
>    작업 전 `git fetch` 필수.
>
> ### 🔜 다음에 할 일 (우선순위 순)
>
> 1. ~~**광고주 구글시트 연동 플로우 결정**~~ → ✅ **2026-08-11 완료.** ⓑ(서비스계정 + Sheets API)를
>    골라 배포까지 끝냈다 — 이 파일 맨 위 "구글시트 서비스 계정 전환" 항목 참고.
>    구조 메모는 유효: **리드폼 1개 = 광고주 1명**(DB UNIQUE), **광고주 1명 = 리드폼 N개** 가능,
>    광고주 리드 화면의 **리드폼별 조회는 이미 구현돼 있다**(칩 전환).
>    ⓐ(광고주 포털에 시트 설정 UI)는 **아직 안 했다** — 지금은 마케터가 리드폼 편집에서 대신 넣어준다.
> 2. **솔라피 첨부 업로드 403** — 급하지 않다(발송은 정상). 첨부를 다시 올려보고 여전히 403 이면
>    솔라피 콘솔의 허용 IP 를 손본다. 고정 IP 를 쓰려면 Railway **Pro($20/월)** 필요.
> 3. **호스팅 이전 잔여**: A5(VM 백엔드 중지 → Railway 자동승인 켜기 ⭐) · A6(Neon 비번 재발급) ·
>    Phase B(프론트 → Cloudflare Pages) · Phase C(Actions 삭제·VM 종료).
> 4. **테스트 잔여물 정리**: Neon 에 테스트 계정 `claude-test-20260809@example.com`(id 43) +
>    그 계정의 리드폼(25·26·27)·랜딩(13·14)·리드 몇 건, R2 에 테스트 이미지 3장.
>    사용자 계정과는 무관하니 지워도 된다.
>
> ---

> ### ✅ 2026-08-09 (밤) — **랜딩 블록 '좌우 여백 없이 전체 폭' 옵션**
>
> HTML·텍스트 블록의 좌우 20px 패딩(`.landing-html`/`.landing-text` 가독성 기본값)이,
> 직접 풀폭으로 디자인한 HTML 에서는 좌우 흰 띠로 보였다. 기존 '좌우 여백(mx)' 입력은
> margin 만 건드려 이걸 못 없앴다. → 블록별 `full` 플래그 추가(편집기 체크박스).
> **CSS 기본값은 손대지 않고 켠 블록만 인라인으로 padding·margin 0** — 안 켠 블록·기존
> 랜딩·다른 사용자 페이지는 렌더가 완전히 동일하다.
> 검증(375px): 켠 블록 335→375px·padding 0 / 안 켠 블록 335px·padding 20px 유지,
> 편집기 미리보기와 공개 렌더(`/p/{slug}`) 양쪽 확인.
> ⚠️ 검증 잔여물: 테스트 계정(id 43)에 랜딩 `landing-02379`(id 13) 1건 생성됨.

> ### 🟠 2026-08-09 (밤) — **문자 '첨부 업로드'가 솔라피 IP 거부로 실패 (발송 자체는 정상)**
>
> **증상**: 문자 첨부 업로드가 400 으로 실패. 본문에 대행사 응답이 그대로 담긴다 —
> `HTTP 403 {"errorCode":"Forbidden","errorMessage":"허용되지 않은 IP(35.240.148.206)로 접근하고 있습니다."}`
> (우리 400 = 솔라피 403 을 감싼 것. [SmsController.java:151](../backend/src/main/java/com/leadpot/sms/SmsController.java))
>
> **⚠️ 정정(2026-08-10)**: 처음엔 "같은 키를 쓰니 발송도 전부 실패할 것"이라고 **추론해서 장애로 적었는데,
> 사용자 확인 결과 문자 발송은 정상 동작 중이다.** 확인된 실패는 **첨부 업로드(솔라피 스토리지 API) 하나뿐**이다.
> 추론을 검증 없이 사실로 기록했던 것 — 발송 실패 근거는 없었다.
> **원인**: 솔라피 API 키의 허용 IP 에 옛 VM(129.225.198.2)만 있고, 백엔드가 Railway 로 옮겨져
> 나가는 IP 가 GCP 대역(35.240.148.206)으로 바뀌었다. **우리 코드 문제 아님 — 코드로 우회 불가.**
>
> **방침(사용자 확정 2026-08-09): 고정 IP 를 쓴다.** Railway Static Outbound IPs —
> **Pro 플랜($20/월) 필요**(현재 Hobby), 추가요금 없음. 서비스 Settings → Networking →
> Enable Static IPs → **IP 3개 발급(HA)** → 재배포. 재배포해도 유지되나 **리전을 옮기면 바뀐다**
> (싱가포르 유지할 것). 전용 IP 보장은 아니다(다른 고객과 공유 가능) — 허용목록을 보안장치로 볼 땐 감안.
>
> **해야 할 일(급하지 않다 — 발송은 되고 있고 첨부(MMS)만 막힌다)**: ① Railway Pro 업그레이드
> ② Static IPs 켜고 3개 확보 ③ 솔라피에 3개 등록 ④ VM 종료 후 옛 IP 제거.
> **먼저 확인할 것**: 첨부 업로드가 지금도 403 인지 재시도해본다 — 발송이 되는 걸 보면
> IP 제한이 이미 풀렸거나 스토리지 API 에만 걸려 있을 수 있다.

> ### ⭐ 2026-08-10 — **'미확인'을 리드 상태에서 분리 (V32 `leads.seen_at`)**
>
> **문제**: 마케터 화면의 '미확인'이 `status = NEW` 였다. 상태는 **광고주도 바꾸는 축**이라
> 광고주가 '유효'로 옮기면 마케터 화면에서 미확인이 저절로 사라졌고, 반대로 마케터가 확인 표시를
> 하려면 상태를 바꿔야 했는데 `VALID` 는 **광고주 잔액 차감 트리거**라 누를 수 없었다.
>
> **바꾼 것**: 미확인 = "마케터가 이 리드를 열어봤는가" 하나로만 판단한다.
> - V32 `leads.seen_at`(nullable). 광고주 열람(`advertiser_seen_at`)과 완전 독립.
> - 인박스 카운트·`unseen` 필터·목록 뱃지 전부 `seen_at` 기준
> - 상세를 열면 확인 처리. **단 데스크톱 첫 리드 자동 선택은 제외** — 직접 누른 것만 봤다고 본다.
> - 종합 리드(인박스)·리드폼 내 리드 목록에 **'확인으로 변경'** 일괄 버튼. 되돌리기 API(`/bulk/unseen`)도
>   만들어뒀지만 화면 버튼은 아직 없다.
> - 회귀 방지 테스트 2개(상태 변경이 미확인에 영향 없는지 / 확인 처리가 상태를 안 바꾸는지)
>
> ### 🔒 2026-08-10 — **[보안] 공개 응답에 리드폼 운영설정이 통째로 실려 나갔다**
>
> 공개 랜딩·공개 리드폼 응답에 `settingsConfig` 가 그대로 담겨, **비로그인 누구나** 아래를 볼 수 있었다:
> 구글시트 **웹훅 URL·시크릿**, 마케터 **개인 연락처**, 고객 발송 **문자 본문**, 자동승인·목표 설정.
> 당시 시트 연동을 켠 리드폼이 없어 실제 유출은 없었지만, **연동을 켜는 순간 시크릿이 공개**되는 상태였다.
> → `FormResponse.publicOf()` 로 공개 경로 두 곳에서 제거. 재발 방지 테스트 추가.
> 운영 서버 응답에서 실제로 사라진 것까지 확인했다.
>
> ### 🐛 2026-08-09 (밤) — **업로드·내보내기 401 실패 수정 (토큰 자동 재발급 누락)**
>
> 증상: 랜딩 편집 중 이미지 업로드가 `401 Unauthorized` 로 실패.
> 원인: `uploadImage` 등 **FormData·blob 요청 7곳이 `request()` 를 안 거치고 raw fetch** 라
> 401 → refresh → 재시도 로직이 없었다. 액세스 토큰은 30분짜리라 **편집을 30분 넘게 하면**
> JSON 호출(자동갱신됨)은 멀쩡한데 업로드·내보내기만 조용히 실패했다.
> 수정: `authedFetch(path, init)` 헬퍼 신규(client.ts) — 401 이면 1회 재발급 후 재시도.
> 적용 7곳: 이미지 업로드 / 리드 양식 다운로드 / 리드 일괄등록 / 리드 내보내기 /
> 광고주 AS 증빙 업로드 / 광고주 리드 내보내기 / 문자 첨부 업로드.
> 검증: 만료된 토큰을 주입한 뒤 업로드 → `refresh` 후 재시도 성공(R2 URL 반환) 확인.

> ### ✅ 2026-08-09 (밤) — **HTML 편집기에 이미지 업로드 버튼 추가 (gooin PC)**
>
> HTML 블록에 `<img>` 를 넣으려면 이미지 URL 이 필요한데 얻을 방법이 없던 문제.
> [HtmlImageUploadButton](../frontend/src/components/HtmlImageUploadButton.tsx) 신규 —
> 클릭 → 파일 선택 → `/api/uploads`(R2) 업로드 → `<img src="공개URL" style="display:block;width:100%">`
> 태그를 HTML 에 자동 삽입 + URL 클립보드 복사(토스트 안내). 백엔드 수정 없음.
> - 부착 3곳: 랜딩 편집기 HTML 블록 · 리드폼 편집기 HTML 블록 · HTML 요소 편집 페이지
> - `uploadImage(file, type?)` 에 저장 경로 프리픽스 추가 — landing / form / component 별로 R2 폴더 분리
> - 로컬 실검증 완료: 업로드 → R2 공개 URL 200 확인(`landing-image/2026/08/09/…png`)
> - ⚠️ **검증 잔여물**: Neon 에 테스트 계정 `claude-test-20260809@example.com`(id 43, 비번은 세션 중 랜덤 생성·미보관) +
>   R2 에 40px 테스트 png 1개. 정리하려면 계정은 DB 에서, png 는 R2 콘솔에서 삭제.

> ### 🏁 2026-08-09 세션 마감 — 배포 완료(main 49d9eb5, VM Actions 2종 success + Railway 자동배포·헬스 200)
>
> - **삭제 정책 방침(사용자와 논의, 아직 미구현)**: 돈·분쟁 관련(리드·리드폼·광고주·원장)은 **논리삭제**,
>   개인정보(리드)는 논리삭제 후 유예기간 뒤 **물리 파기**(개인정보보호법상 의무), 유니크 값(서브도메인·아이디)·
>   운영 로그류는 물리삭제 유지. 리드폼 휴지통화 + 리드 30일 자동 파기 배치는 **V32 해금 후** 과제.
> - 다음 세션: 아래 "남은 일" A5 부터 (2~3일 관찰 → VM 중지 → Railway 자동승인 켜기 ⭐).
>
> ### ✅ 2026-08-09 (저녁) — **목표 기능 + 리드폼 삭제 버그 + SmsPage 레이아웃 수정**
>
> 1. **목표(Goal) 기능 신규** — 리드폼별 일간/월간 수집 목표 + 시작~종료 기간, 보고서로 확인.
>    - 저장: `forms.settings_config`(JSONB) 무스키마 — `goalEnabled/goalDaily/goalMonthly/goalStart/goalEnd`
>      (**V32 마이그레이션 금지 준수**, [GoalSettings.java](../backend/src/main/java/com/leadpot/form/GoalSettings.java))
>    - 백엔드: `GET /api/goals/report` — [GoalReportService](../backend/src/main/java/com/leadpot/form/GoalReportService.java)
>      (KST 버킷팅은 자바에서, 일별 최근 31행, 진행 중인 달 미달은 met=null 보류)
>    - 프론트: 리드폼 편집 '옵션' 카드에 목표 설정 UI + **/goals 보고서 페이지 신규**(운영 내비 '목표')
>    - 과금(grant.dailyGoal)과 별개다 — 그쪽은 광고주 계약·문자 알림용.
> 2. **리드폼 삭제 500 수정** — leads(V5)·ip_blocks·ip_block_hits(V13)의 FK 에 on delete 가 없어
>    자식 있는 폼 삭제가 FK 위반으로 죽었다. 마이그레이션 금지 기간이라 DB 대신
>    **FormService.delete 가 자식부터 지우도록** 수정(leads → ip_block_hits → ip_blocks → form).
>    lead_notes/as_requests 는 DB cascade 가 이미 있다. H2 테스트는 FK 를 안 만들어 못 잡았던 버그.
> 3. **SmsPage 문자발송이력이 푸터 아래 렌더** — 유일하게 `.app-shell` 래퍼가 없던 페이지.
>    LNB 가로 배치 규칙이 `.app-shell:has(> .app-nav)` 라 래퍼 없으면 본문이 LNB(100vh) 아래로 밀린다.
> 4. 답변 완료(코드 무관): Railway 로그 보는 곳(서비스 → Deployments → View Logs / Observability),
>    알림톡 수신동의(정보성 접수확인은 동의 불필요·고객용은 별도 템플릿 심사·M7 발송코드는 미구현),
>    물리/논리 삭제 현황(리드만 논리삭제·나머지 물리삭제).

> ### ✅ 2026-08-09 — **호스팅 이전 Phase A 컷오버 완료: `api.lead-pot.com` → Railway(싱가포르)**
>
> **방문자 랜딩 API 실측: VM 850~980ms → Railway 220~246ms (약 4배 단축).** 계획서 목표(200ms) 달성.
>
> #### 지금 상태 (이어받는 세션은 여기 숙지)
> - `api.lead-pot.com` = **CNAME `09g4ey7v.up.railway.app`** (DNS-only, TTL 60) + TXT `_railway-verify.api`.
>   Railway 인증서 자동 발급 완료. ⚠️ 첫 CNAME(`9fubn50t`)은 Railway 도메인 재등록으로 값이 바뀐 것 —
>   재등록하면 대상이 또 바뀔 수 있다.
> - **VM 백엔드는 롤백용으로 계속 가동 중** (docker `leadpot-backend`). 롤백 = Cloudflare 에서 `api` 를
>   A `129.225.198.2` 로 되돌리면 끝 (백업: `C:\Users\gooinsung\leadpot-backup\dns-api-record-backup-2026-08-09.json`).
> - **자동 승인은 VM 쪽만 돈다** — Railway 는 `APP_LEAD_AUTO_APPROVE_ENABLED=false` (이중 과금 방지).
>   **VM 을 내리는 날 Railway 에서 true 로 켜는 것 잊지 말 것** ⭐
> - Railway 프로젝트: 서비스명 Leadpot, Root Directory=`backend`, 리전 싱가포르, 포트 8080,
>   Watch Paths=`backend/**`. **push 하면 VM(Actions)과 Railway 둘 다 배포된다**(이전 기간 의도).
> - R2: 신규 업로드부터 R2(`leadpot-uploads`, APAC). 기존 업로드 파일은 **0개였음**(복사 불필요 확정).
> - 시크릿·백업: `C:\Users\gooinsung\leadpot-backup\` (vm-env / railway-env / cf-dns-token / dns 백업). git 금지.
>
> #### 남은 일 (계획서 Step 순)
> 1. ~~**사용자**: Railway Variables 에서 `APP_WARMUP_ENABLED=true` 로 변경(무중단 재배포) ·
>    **Trial→Hobby 결제 활성화 확인** · 로그인해서 기존 세션 유지 확인(JWT 시크릿 검증)~~ → **3종 모두 확인 완료 (2026-08-09)**
> 2. **A5**: 2~3일 관찰(리드 유실·알림·요금) → VM 백엔드 중지(`docker compose -f docker-compose.prod.yml down`)
>    → Railway `APP_LEAD_AUTO_APPROVE_ENABLED=true`
> 3. **A6**: Neon 비번 재발급 → Railway 환경변수만 갱신 (VM 내린 뒤에만!)
> 4. **Phase B**: 프론트 → Cloudflare Pages (VM 을 끄기 위한 마무리)
> 5. **Phase C**: Actions 워크플로 삭제 · CLAUDE.md §2/§3/§6 전면 갱신 · VM 종료
> 6. 그 후: DB → Railway Postgres 교체 검토(Neon 무료 100 CU-h/월 한도 → keepalive 24시간이면 초과 가능,
>    콘솔 Usage 확인 필요 — 2026-08-09 조사 결론)
>
> ---
>
> ### ~~🟢 2026-08-09 예정 — 호스팅 이전 착수 (사용자 확정 2026-08-08 "내일 진행")~~ → 위처럼 실행됨
>
> **[HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) 를 그대로 실행한다. Step 0 부터.**
> 2026-08-08 세션에서 SSH 로 사전 판정을 마쳤고, 계획서에 없는 갱신 사항이 4개 있다:
>
> 1. 🔴 **R2 판정 = local 확정** — VM `.env` 에 `APP_STORAGE*` 키가 없다(기본값 local).
>    → **Step 0 에 R2 전환이 선행 작업으로 확정**: 버킷 생성 → env 5개 주입 → 재배포 →
>    기존 업로드 파일 VM 디스크→R2 복사(파일명 UUID 라 충돌 없음).
> 2. ✅ **SSH 접속 실동작 확인** (gooin PC, G: 마운트) — `.env` 백업·`APP_JWT_SECRET` 확보 가능
>    → 로그인 세션 유지 경로 유효.
> 3. ⚠️ 계획서의 "이전 중 V29 이상 금지"는 **"V32 이상 금지"** 로 읽는다 (현재 **V31**).
> 4. ⚠️ **자동승인 이중 실행 = 이중 과금 위험으로 격상** — V31부터 자동승인이 유효 확정
>    = 광고주 잔액 차감 트리거다. Railway 는 컷오버(A5)까지 반드시
>    `APP_LEAD_AUTO_APPROVE_ENABLED=false`.
>
> **사용자가 직접**: Railway 계정 + 결제 등록 (Step A1 전에).
> **이전 기간 중 이 저장소에 Flyway V32 이상 커밋 금지.**

> ### 🎨 2026-08-08 — **전면 리디자인 적용 (docs/design/적용 가이드.md 1~7단계 완료)**
>
> 시안 `docs/design/전체 화면 리디자인.dc.html` 기준. 색 토큰은 그대로(다크모드 자동 대응 유지),
> **형태만 교체**: 카드 18px·소형 12px 라운드 + 버튼/입력/필터 pill 통일.
> 브랜치 `feature/redesign`, 가이드 §13 커밋 순서대로 7커밋. 각 단계 `tsc -b`+빌드 통과.
>
> 1. 토큰(--radius 18/12 + --radius-pill) → 2. 버튼·입력·btn-sm pill →
> 3. LNB(섹션 제목 확대+구획선, 링크 12px, **리드 미확인 뱃지**) →
> 4. ★ **인박스 스플릿 뷰** — rail 3-pane 폐기, 목록 430px(검색·셀렉트3·세그먼트·2줄 카드·페이징)
>    + 상세 상시 pane(히어로 헤더+[유효로 확정 그린]+2단 그리드). 첫 리드 자동 선택,
>    ≤900px 은 목록만+서랍(기존 drawer), hover 체크박스 벌크 →
> 5. 대시보드('오늘 들어온 리드' 미리보기+서브도메인 우측 1열), 유형 pill 색 분리(.pill.gr),
>    편집기 블록 행·점선 추가버튼, 통계 막대(리드=그린) →
> 6. 광고주 포털(soft 활성 탭·인사 헤더 "새 리드 N건이 기다려요"·**그린 전화 pill+번호**),
>    로그인(22px 카드·pill), 공개 폼(입력 14px·제출 16px — 리드폼별 색 유지) →
> 7. 검증: 로그인 화면 DOM 실측(라운드/토큰/다크모드 반전/375px 무스크롤) 통과.
>    ⚠️ **로그인 필요 화면(인박스 스플릿 등)은 브라우저 실측 못 함**(자격증명 없음) — 배포 후 실사용 확인 필요.
>
> **다음 사람 주의**: 통합 인박스의 옛 클래스(.inbox-rail/.inbox-row/.rail-*)는 삭제됐다.
> 폼별 목록(.flead-*)은 그대로다. 공개 폼 입력은 base 의 pill 을 public.css 가 14px 로 되돌린다(모바일).

> ### ✅ 2026-08-08 (gooin PC) — **상태 축 통합 + AS요청 + 선입금 과금 (V29~V31) 배포 완료**
>
> **`main` = `dd47719` · 전부 라이브.** 사용자 확인 후 병합·배포했고(20a88fc, 다운타임 1분 49초),
> **운영 리드 상태는 전부 '신규'로 리셋됐다**(사용자 결정, 옛 값은 `status_legacy`·
> `advertiser_status_legacy` 컬럼에 백업). 백엔드 테스트 **233개 통과**, 프론트 빌드 통과.
> **Flyway V31 까지 → 다음은 V32.**
>
> **배포 후 사용자 실사용 피드백 6건을 같은 날 반영·재배포(`dd47719`)**:
> ① 광고주 LNB 미적용 수정(layout.css 의 `.app-shell > *:not(.app-nav)` 가 덮던 것)
> ② 무효 상태를 광고주에게도 항상 표시(선택만 비활성) ③ 무효 리드도 상태값 계속 표시
> ④ 마케터 **'정산' 메뉴(/billing)** 신설 — 계약 전체의 잔액·이번달 수익·목표 진행 표
> ⑤ 정산 지표를 '승인 대기 중/총 목표'(유효·무효 아닌 리드) + '유효 확정/총 목표'로 분리
> ⑥ 광고주 목록 카드의 거대한 전화 버튼 수정(모달용 스타일 누수)
>
> #### 무엇이 바뀌었나 (2026-08-08 사용자 확정 설계)
> 1. **진행상태 단일 축(V29)** — 마케터 축(신규/상담중/완료/불량)과 광고주 축(신규/확인/…/종료)을
>    폐기하고 **신규/유효/AS요청/무효 + 광고주 커스텀 상태**로 통합. 무효 전환·해제는 마케터만.
>    광고주가 유효로 넘기면 마케터도 같은 상태를 본다(같은 컬럼). 모든 전이는
>    `LeadStatusService` 단일 관문(권한+공유 이력+과금 훅). 자동 승인은 신규·커스텀 → **유효**로 개편.
>    커스텀 상태는 광고주 계정 단위, 광고주가 `/client/integrations` 에서 직접 관리(최대 20개, 삭제 대신 보관).
> 2. **AS 요청(V30)** — 광고주가 사유(필수)+증빙 이미지(≤5장, `/api/advertiser/uploads` 신설)로 접수
>    → 리드 AS_REQUESTED 잠금 + **마케터 텔레그램+문자 알림** → 마케터 인정(무효+환급)/거부(유효 확정).
>    ⚠️ 사용자가 원한 건 **카톡 알림**인데 알림톡 발송 코드·전용 템플릿이 없어 M7 때 채널 교체.
> 3. **선입금 과금(V31)** — grant 에 DB 단가·일/총 목표·잔액 알림 설정. 원장(`advertiser_ledger`)이
>    유일한 진실(충전+/차감−/환급+, 잔액=합계). 유효 진입 차감·이탈 환급(리드별 순액으로 중복 방지).
>    잔액 임계 미만 → 결제담당 문자(**마케터 지정 번호 → 광고주 등록 번호 → 없으면 미발송**,
>    V28 원칙의 유일한 예외 — 사용자 확정). 일 목표 도달 → 마케터 문자(하루 1회).
>    잔액 소진돼도 수집 계속(마이너스 허용). UI: 리드폼 편집 '광고주 정산' 카드.
> 4. **광고주 포털 LNB** — 넓은 화면 좌측 사이드바(마케터처럼), 모바일은 기존 상단바 유지.
>    메뉴: 리드/리포트/설정/**사용 안내**(`/client/guide` 신설). 메모는 광고주메모(공유·작성자 역할 표기)
>    / 마케터메모(전용)로 정리(작성 시 공유 체크박스).
> 5. **마케터 대시보드** — '총 리드' 카드를 **'신규 리드'(오늘 접수)** 로 교체.
>
> #### 배포 후 확인된 것 / 남은 실물 확인
> - ✅ 사용자가 라이브에서 직접 확인: 광고주 상태 지정(커스텀 '부재 1일차' 생성·지정), AS 접수 →
>   마케터 인정(무효 처리), 정산 카드(잔액 275만·차감·환급 반영). 스크린샷 기준 전부 동작.
> - ⬜ 아직 실물 미확인: 잔액 부족 문자(임계 아래로 내려가는 순간 1회), 일 목표 달성 문자,
>   AS 접수 시 마케터 텔레그램+문자 도착 여부.
>
> #### 다음 사람이 알아야 할 함정
> - **자동 승인 = 과금 트리거가 됐다.** 유효 확정이 차감이므로, 과금 계약(단가>0) 있는 폼에서
>   자동 승인을 켜면 N일 후 자동 차감된다. 이게 계약 의도("N일 내 AS 없으면 유효 확정")다.
> - **컨테이너 다중화 금지 전제 하나 추가** — 자동 승인이 겹치면 이력 중복을 넘어 **이중 차감** 위험.
> - 이전(호스팅 마이그레이션) 기간의 "V29 이상 금지"는 이제 "V32 이상 금지"로 읽어야 한다.
>   **이 브랜치를 배포한 뒤에 호스팅 이전을 시작할 것.**
> - 알림톡(M7) 전환 시 AS 알림용 템플릿을 **별도 심사**받아야 한다(접수 알림 템플릿과 용도가 다르다).

> ### 🚚 [2026-08-07 확정, gooin PC] 호스팅 이전 계획 — **계획만 세웠고 아직 착수 안 함**
>
> **계획서: [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) — 그 문서 하나만 읽으면 끝까지 실행할 수 있다.**
> (아래 2026-08-06 2차 마감 블록의 1·2순위(V28 실물 확인, 광고주 문자 안내)가 **여전히 먼저다.** 이건 그 다음.)
>
> **무엇을**: 백엔드 Oracle VM → **Railway(싱가포르)** / 프론트 VM Nginx → **Cloudflare Pages** / DB 는 **Neon 싱가포르 그대로**.
> **월 2만원 안팎** (사용자가 비용 감수 확정).
>
> **왜 — 우리가 이미 두 번 시도해서 못 푼 문제 때문이다**
> - 커넥션 풀 튜닝(`d19e908`)·예열(`86e3f84`) 둘 다 했지만 **웜 541ms 중 426ms(74%)가 Neon 싱가포르 왕복**으로 남았다.
>   이 문서 아래 "예열 효과 실측" 절의 결론 그대로 — **앱 최적화로는 안 줄어든다.**
> - **앱을 DB 옆(싱가포르)으로 옮기는 게 해법.** 한국 사용자는 왕복 50ms 를 한 번 더 내지만 426ms×N 이 사라진다.
>   **목표 541ms → 200ms.** (`/api/health` 는 115ms → 160ms 로 조금 느려지는 게 정상이다)
>
> **덤으로 같이 풀리는 것 2개**
> - **배포 다운타임 1분 52초 → 0** (Railway 는 헬스체크 통과 후 트래픽 전환). ※ "배포 10~17분"은 `f1a7683` 로 **이미 해결됨**
> - **시크릿 변경이 "SSH → 파일 편집 → 재기동(다운타임)"** → **웹 UI + 롤링 재배포**로 바뀐다.
>   미뤄져 있던 **Neon 비번 재발급**(아래 "사용자가 처리해야 할 것")도 이전 마지막 단계에서 함께 정리한다.
>
> **Vercel 은 검토했으나 탈락** — Spring Boot 가 올라가지 않는다(JVM 런타임 없음). Fly.io 는 차선책. 근거는 계획서 §2.
> ⚠️ **"DB 서울 이전"(아래 사용자 처리 항목)은 이 계획이 대체한다.** 근거는 계획서 §3.
>
> #### ✅ SSH 키는 있다 (2026-08-07 확인) — 이전이 훨씬 쉬워졌다
> 구글드라이브에 있다. 계획서 §P3 에 접속 명령을 그대로 적어뒀다.
> 덕분에 **VM `.env` 를 통째로 가져올 수 있고**, `APP_JWT_SECRET` 을 그대로 옮겨 **로그인 세션이 유지**된다
> (= 마케터·광고주 재로그인 불필요). R2 판정도 SSH 로 바로 된다.
>
> #### 착수 전 남은 것
> 1. **Step 0** — `.env` 백업 + R2 판정(`grep APP_STORAGE ~/Leadpot/.env`). `local` 이면 R2 전환이 선행 작업
> 2. **Railway 계정·결제** — 사용자가 직접
>
> #### ⛔ 이전 기간 중 금지 (VM·Railway 가 같은 Neon 을 동시에 봄)
> - **Flyway V29 이상 추가 금지** (현재 V28)
> - **자동 승인 이중 실행 주의** — `LeadAutoApproveRunner` 가 매시 10분에 실제로 리드를 완료 처리한다.
>   Railway 쪽은 컷오버까지 `APP_LEAD_AUTO_APPROVE_ENABLED=false`
> - 검증 중에는 `APP_WARMUP_ENABLED=false` (예열이 운영 DB 에 리드 INSERT 를 시도한다)

> ### ⏸ 2026-08-06 **2차 세션 마감** (wincube PC) — 🟢 **다음 세션은 여기서 시작**
>
> **`main` = `b01db2b`** · 작업트리 클린 · 전부 푸시·배포 완료
> **Flyway V28 까지 → 다음은 V29** · 백엔드 테스트 **212개 통과** · 프론트 타입체크·빌드 통과
>
> 이 세션에서 한 일 두 가지 (상세는 아래 각 절):
> 1. 💬 **알림톡 템플릿 1차 반려 대응** — 수정본 확정·기록 (코드 변경 없음, `0fe4cf5`)
> 2. 🔴 **광고주 수신번호 자기등록 (V28)** — 구현·배포 (`1132759`, `b01db2b`)
>
> ---
>
> #### 🔴 1순위 — V28 실물 확인 (배포는 됐는데 눌러보지 못했다)
>
> 사용자 지시로 자리 비운 사이 **검증 없이 배포**했다. 라이브에서 확인한 건 헬스체크 UP(=Flyway V28
> 적용됨)과 프론트 번들 문구뿐이고, **화면을 실제로 눌러본 적이 없다.**
>
> 1. **광고주 포털** `/client/integrations` → "접수 알림 문자 받기" 카드가 뜨는지.
>    마케터가 토글을 켠 리드폼만 보여야 한다(안 켠 폼은 카드에 안 나옴).
> 2. **번호 저장 → 리드 접수 → 실제 문자 도착** 확인. 비우고 저장하면 멈추는지도.
> 3. **마케터 리드폼 편집** → 광고주 번호 칸이 사라지고 상태 안내가 맞게 뜨는지
>    (미연결 / 미등록 / ✅마스킹번호 3가지).
>
> #### 🔴 2순위 — 지금 광고주 문자 알림이 멈춰 있다
>
> 사용자 결정("광고주 입력 전까지 중단")대로 **기존 `smsAdvertiserPhone` 을 더 이상 읽지 않는다.**
> 영향받는 리드폼을 뽑아 **해당 광고주에게 포털에서 번호를 등록해달라고 안내**해야 한다.
> ```sql
> SELECT id, name FROM forms
>  WHERE settings_config ? 'smsAdvertiserPhone'
>    AND settings_config->>'smsAdvertiserPhone' <> '';
> ```
>
> #### 👤 사용자가 직접 해야 할 것
> - **솔라피 콘솔에서 반려된 알림톡 템플릿 수정 후 재검수 요청** (새로 만들지 말 것). 영업일 1~3일.
> - **Neon 비밀번호 재발급** — 이전 세션에서 평문 노출됐다. VM `~/Leadpot/.env` 도 같이 바꿔야
>   운영이 안 죽는다. (아직 안 함)
>   → ✅ **SSH 키는 있으므로**(2026-08-07 확인) 지금도 가능하다. 다만 **호스팅 이전을 할 거면 그 마지막 단계에서
>   하는 게 낫다** — 재발급 즉시 옛 비번이 무효라 이전 도중에 돌리면 롤백 경로가 끊긴다.
>   상세는 [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) §4-3.
>
> #### 그 다음 (이전 세션에서 넘어온 잔여 — 아래 1차 마감 절 참고)
> 1. **광고주 삭제 실물 확인**(40번) · **자동 승인 실물 확인** — 둘 다 미확인
> 2. **LMS 권한 경고** — 리드폼 편집 byte 카운터 옆. 미착수
> 3. ~~**SSH 확보**~~ → ✅ **해소됨 (2026-08-07)**. 키는 구글드라이브에 있다:
>    `ssh -i "G:\내 드라이브\오라클\instance key\leadpot-dev\ssh-key-2026-07-28.key" ubuntu@129.225.198.2`
>    (작업 PC 에 G: 마운트 필요). 여기 걸려 있던 **Neon 비번 교체·운영자 추가·리전 확인**을 이제 진행할 수 있다
> 4. **어드민에 역할 변경 기능 없음** — 두 번째 운영자를 만들려면 또 DB 를 직접 만져야 한다
> 5. 메타 연동은 [META-LEADS-PLAN.md](META-LEADS-PLAN.md) §7 의 사용자 결정 4건부터
>
> ⚠️ **로컬을 Neon 운영 DB 에 붙일 일이 있으면** 아래 1차 마감 절의 경고 3가지를 반드시 먼저 읽을 것
> (warmup·자동승인 끄기 + 미배포 Flyway 확인). 이번 세션에 브라우저 검증을 포기한 이유도 이것이다.

> ### ⏸ 2026-08-06 **1차** 세션 마감 (wincube PC) — 운영자 계정·문자 권한 UI
>
> #### 🔑 운영자(ROLE_ADMIN) 계정이 생겼다 — 첫 세션부터 막혀 있던 블로커 해소
> **`gooinsung@naver.com` (users.id=42) = ROLE_ADMIN.** `/admin` 접근 가능.
>
> **어떻게 풀었나**: SSH 가 없어 VM `.env` 를 못 고치는 상황이었는데, 사용자가 **Neon 접속정보를
> 알려줘서** 로컬 백엔드를 **운영 DB 에 붙여** 처리했다. 배포는 하지 않았다.
> 1. 로컬에서만 회원가입을 열고(`APP_AUTH_SIGNUP_ENABLED=true`) 사용자가 직접 가입 → 운영 DB 에 계정 생성
> 2. 로컬 백엔드를 `APP_ADMIN_BOOTSTRAP_EMAIL` 을 준 채로 재기동 → `AdminBootstrap` 이 승격
>    (raw UPDATE 대신 이 경로를 쓴 이유: **`admin_audit_logs` 에 이력이 남고**, 광고주 계정이면 자동 거부된다)
>
> ⚠️ **로컬을 운영 DB 에 붙일 때 반드시 끌 것** — 안 끄면 운영 데이터가 망가진다:
> ```
> APP_WARMUP_ENABLED=false            # 기동 시 운영 DB 에 리드 INSERT(롤백) 시도
> APP_LEAD_AUTO_APPROVE_ENABLED=false # 🔴 매시 10분에 운영 리드 상태를 실제로 완료로 바꾼다
> ```
> ⚠️ 로컬 코드에 **미배포 Flyway 마이그레이션이 있으면 운영 DB 에 그대로 적용된다.** 붙이기 전에
> `main` 과 같은 커밋인지 확인할 것.
>
> #### 🔴 사용자가 처리해야 할 것 (보안)
> **Neon 비밀번호(`neondb_owner`)가 대화에 평문 노출됐다. 재발급 필요.**
> 재발급하면 **VM `~/Leadpot/.env` 의 `SPRING_DATASOURCE_PASSWORD` 도 같이 바꿔야** 운영이 안 죽는다
> → **SSH 확보와 묶어서** 처리할 것. (아직 안 함)
> ✅ **2026-08-07 갱신**: SSH 키는 있다(위 2차 마감 블록). 재발급 타이밍은 [HOSTING-MIGRATION-PLAN.md](HOSTING-MIGRATION-PLAN.md) §4-3 참고.
>
> #### 오늘 마지막 작업 — 문자 권한 UI (`9fc00fa`)
> 권한 없는 계정은 리드폼 편집의 문자 설정이 **잠기고 사유가 뜬다**. 전에는 켤 수 있었지만 저장 시
> 서버가 조용히 껐다. 서버 변경 없음(`GET /api/sms/status` 재사용).
>
> #### 이때 남긴 다음 할 일 — **위 2차 마감 블록에 통합됨** (여기 목록은 상세 설명용)
> 1. **광고주 삭제 실물 확인** — 활동 이력 있는 광고주(40번)를 지워보면 500 이 사라졌는지 확인된다. (미확인)
> 2. **자동 승인 실물 확인** — 리드폼에 1일로 켜두고 하루 뒤 리드 이력에 자동 메모가 찍혔는지.
> 3. **LMS 권한 경고** — 리드폼 편집의 byte 카운터 옆. 권한이 *있어도* LMS 가 안 열린 계정은
>    90byte 를 넘기면 저장은 되고 발송 때 막힌다. `/sms` 에만 경고가 있다. (미착수)
> 4. ~~**SSH 확보**~~ → ✅ **해소됨 (2026-08-07)** — 위 2차 마감 블록 참고.
> 5. **어드민에 역할 변경 기능 없음** — 두 번째 운영자를 만들려면 또 DB 를 직접 만져야 한다.
> 6. 메타 연동은 [META-LEADS-PLAN.md](META-LEADS-PLAN.md) §7 의 사용자 결정 4건부터.

> ### 💬 2026-08-06 — 알림톡 템플릿 **1차 반려 → 수정본 확정** (코드 변경 없음)
>
> **반려 사유(카카오 검수)**: 다발성 메시지 — 다수 발송될 수 있음을 수신자가 동의·요청했다는 사실을
> **메시지 내 고정값**으로 기재해야 승인. 내용 문제가 아니라 **고지 문구 누락** 하나였다.
>
> **확정본 정본은 [MESSAGING-PLAN.md](MESSAGING-PLAN.md) §9 "템플릿 확정본"** — 여기 옮겨 적지 않는다.
> 요약: 유형 **강조표기형**, 변수 4개(`#{담당역할}` `#{리드폼}` `#{접수시각}` `#{미확인건수}`),
> `#{담당역할}` = `마케터`/`광고주`, **고지 문구는 부가정보 칸**에 넣었다.
>
> **다음에 할 일**
> 1. **솔라피 콘솔에서 반려 템플릿 수정 후 재검수 요청** (새로 만들지 말 것). 영업일 1~3일. — 사용자
> 2. **또 반려되면** MESSAGING-PLAN §9 "⚠️ 재반려 리스크" 4개 항목을 순서대로 적용한다.
>    (요지: 고지문을 부가정보→**본문**으로, `접수될때`→**`접수될 때마다`**, 오타 3건, 보조문구 중복)
> 3. **승인되면 M7 착수** — 발송 시스템은 이미 있다. §9 "구현 시 주의" 1~7 확인 후 시작.
>
> ⚠️ **승인된 템플릿은 문구를 못 고친다**(수정하려면 재심사) — 오타까지 재심사 전에 정리할 것.

> ### 🔴 2026-08-06 — 광고주 수신번호를 **광고주 본인이 등록**하도록 변경 (Flyway **V28**)
>
> **사용자 지시로 검증 없이 배포까지 진행했다**(자리 비움). 아래 "실물 확인" 항목을 **다음 세션 1순위**로.
>
> **왜**: 마케터가 리드폼 편집에서 **남의 번호(광고주)를 대신 입력**하고 있었다. 번호 주인은 등록·동의한
> 적도 끌 수도 없었다. 발신 채널이 **리드팟 명의 하나**라 광고주가 스팸 신고하면 우리 채널이 제재를
> 받고 **전 고객 알림이 동시에 멈춘다**. 알림톡 고지문("등록하신 리드폼의 접수 알림")과도 사실이 어긋났다.
>
> **바뀐 동작** (정본은 [MESSAGING-PLAN.md](MESSAGING-PLAN.md) §9 "광고주 수신번호는 광고주 본인이 등록한다")
> - 마케터: 리드폼 편집에서 **체크만**. 광고주 번호 칸 삭제 → 수신 상태 안내로 교체(마스킹 번호만 표시)
> - 광고주: `/client/integrations` 에서 **리드폼별로 본인 번호 등록**. 비우면 즉시 중단
> - 발송 조건: 토글 ON **AND** 광고주 연결 **AND** 광고주가 번호 등록. **계정 연락처 폴백 없음**
> - 저장: `advertiser_form_grants.notify_phone` + `notify_phone_at`(동의 시각)
> - **마케터 번호(`smsMarketerPhone`)는 그대로** — 본인 번호라 동의 문제가 없다
>
> **🔴 배포 즉시 기존 광고주 문자 알림이 전부 멈춘다** (사용자 결정: "광고주 입력 전까지 중단").
> 마케터가 넣어둔 `smsAdvertiserPhone` 은 더 이상 읽지 않는다. 값 자체는 **지우지 않고 남겨뒀다**.
> → **운영 중인 리드폼이 있으면 해당 광고주에게 "포털에서 번호 등록해달라"고 안내해야 한다.**
>
> **배포 완료 — `1132759`, 2026-08-06 17:40 push, Deploy Backend·Frontend 둘 다 success**
>
> | 확인한 것 | 결과 |
> |---|---|
> | `GET /api/health` | `UP` (0.74초) → **앱 기동 = Flyway V28 정상 적용**(실패하면 기동 자체가 안 된다) |
> | 프론트 번들 `index-CJRql7ku.js` | 새 문구 5종 있음(`접수 알림 문자 받기`·`notify-phone`·`notify-status` 등) |
> | 〃 | 옛 문구 제거 확인(`광고주에게 접수 문자 보내기`·`비우면 광고주 계정 연락처`) |
> | 백엔드 테스트 | **212개 통과**(신규 15) · 프론트 타입체크·빌드 통과 |
>
> ⚠️ **API 엔드포인트 존재는 증명 못 했다** — 인증 없이 부르면 없는 경로도 401 이라 401 만으로는
> 판정이 안 된다(대조군으로 확인). 로그인 상태에서 실제로 눌러봐야 한다.
> ⚠️ **브라우저 실물 확인은 안 했다** — 로컬 백엔드를 띄우려면 Neon 운영 DB 에 붙어야 하고
> 미배포 V28 이 운영에 먼저 적용돼 버려서 자리 비운 상태에서 하지 않았다.
>
> **다음에 할 일 (실물 확인 — 1순위)**
> 1. **광고주 포털** `/client/integrations` → "접수 알림 문자 받기" 카드가 뜨는지. 마케터가 토글을 켠
>    리드폼만 보여야 한다(안 켠 폼은 카드에 안 나옴).
> 2. **번호 저장 → 리드 접수 → 실제 문자 도착** 확인. 비우고 저장하면 멈추는지도.
> 3. **마케터 리드폼 편집** → 광고주 번호 칸이 사라지고 상태 안내(미연결/미등록/✅마스킹번호)가 맞게 뜨는지.
> 4. **기존 운영 리드폼 영향 파악** — `smsAdvertiserPhone` 이 채워져 있던 리드폼 목록을 뽑아
>    해당 광고주에게 재등록 안내. (Neon 에서 `settings_config ? 'smsAdvertiserPhone'` 로 조회)

> ### 🔄 2026-08-06 (wincube PC) — 자동 승인 기간 · 광고주 삭제 500 수정 · 계정 상한 해제 · 회원가입 닫기
>
> **`main` 병합·배포 완료 (`c258ea8`) — ✅ 라이브 검증까지 끝남**
> 백엔드 테스트 **197개 통과**(신규 13) · 프론트 빌드 통과 · **Flyway V27 까지 → 다음은 V28**
> 담긴 것: ① 자동 승인 기간 ② 광고주 계정 상한 해제 ③ 광고주 삭제 500 수정 ④ 공개 회원가입 닫기
>
> #### 배포 실측 (2026-08-06 11:52 push)
> | 항목 | 값 |
> |---|---|
> | 백엔드 다운타임 | **1분 55초** (11:54:39 → 11:56:34) |
> | push → 백엔드 복구 | 약 **4분 30초** |
> | 프론트 반영 | 약 **1분**, 다운타임 없음 |
> | 공개 랜딩 응답(웜) | 0.82~0.84초 |
>
> **라이브 확인 결과**
> - `POST /api/auth/signup` → **403 `SIGNUP_CLOSED`** (계정 생성 없음) — 서버 차단 동작 확인
> - `https://app.lead-pot.com/signup` → **`/login` 리다이렉트** 확인, 문구도 교체됨
> - 배포된 번들에 `자동 승인 기간 사용`·`삭제된 광고주` 있음 / `회원가입` **0건**
> - 앱이 기동했다 = **Flyway V27 정상 적용**(실패하면 기동 자체가 안 된다)
>
> ⚠️ **아직 실물로 확인 못 한 것 2가지** — 둘 다 조건이 갖춰져야 보인다:
> 1. **광고주 삭제** — 활동 이력이 있는 광고주(예: 40번)를 실제로 지워봐야 500 이 사라졌는지 확인된다.
> 2. **자동 승인** — 설정을 켠 뒤 그 일수가 지나야 동작한다. 빨리 보려면 1일로 두고 하루 뒤
>    리드 상세의 이력에 자동 메모가 찍혔는지 본다.
>
> #### 🔒 공개 회원가입을 닫았다 (`f61d606`)
> 무단 가입 방지(사용자 결정). **서버·화면 양쪽**을 닫았다 — 화면만 막으면 `/api/auth/signup` 이
> 공개라 curl 한 줄로 계정이 만들어진다.
> - 서버: `app.auth.signup-enabled` **기본 false** → 403 `SIGNUP_CLOSED`
> - 화면: `/signup` → `/login` 리다이렉트, 로그인·서비스소개의 가입 링크 제거
>
> ⚠️ **기본값을 false 로 둔 것은 의도적이다.** VM 의 `.env` 를 고치려면 SSH 가 필요한데 지금 접근
> 수단이 없어, **배포만 하면 닫히도록** 코드 기본값을 닫힌 상태로 뒀다.
> **다시 열 때**: `application.properties` 의 값을 `true` 로 바꿔 배포 + `App.tsx` 라우트 ·
> `LoginPage`·`AboutPage` 링크를 되돌린다(각 파일에 주석으로 표시해 뒀다). `SignupPage.tsx` 는 그대로 있다.
>
> ⚠️ **광고주 초대 수락은 이 설정과 무관하게 동작한다** — 마케터가 발급한 링크로만 만들어지므로
> 무단 가입이 아니다. 실수로 막지 않도록 회귀 테스트를 넣어 뒀다(`SignupClosedTest`).
>
> #### 무엇을 만들었나
> 리드폼 편집 화면 **'옵션'** 카드에 **자동 승인 기간** 체크박스 + 일수 입력을 추가했다.
> 켜면 접수 후 그 일수가 지나도 **신규·상담중**인 리드를 서버가 **완료**로 넘기고
> 리드 이력에 자동 메모를 남긴다 — `설정에 따른 자동 승인 — 접수 후 7일 경과. 상태 변경: 신규 → 완료`
>
> | 파일 | 역할 |
> |---|---|
> | [AutoApproveSettings.java](../backend/src/main/java/com/leadpot/form/AutoApproveSettings.java) | 설정 3키 판독·검증 + `since` 확정 규칙 |
> | [LeadAutoApproveRunner.java](../backend/src/main/java/com/leadpot/lead/LeadAutoApproveRunner.java) | 매시 10분(KST) 실행 |
> | FormService·LeadRepository·LeadService | 저장 시 `since` 각인 · 대상 조회 · 상태 한글 표기 공용화 |
>
> #### ⚠️ 다음 사람이 알아야 할 것
> - **소급 적용하지 않는다(사용자 결정 2026-08-06).** 기능을 켠 시각을 서버가 `autoApproveSince` 에
>   찍고 **그 이후 접수분만** 대상이다. 이 조건을 빼면 켜는 순간 과거 리드 수백 건이 완료로 뒤집히고
>   **되돌릴 방법이 없다**(강등·일괄취소 기능 없음). **껐다 켜면 그 시점부터 새로 시작**한다.
> - **클라이언트가 보낸 `autoApproveSince` 는 무시**하고 서버 시각으로 덮어쓴다(과거 시각을 실어
>   소급 적용을 유발하지 못하게).
> - **`@EnableScheduling` 을 이번에 처음 켰다.** 지금은 **컨테이너가 한 대**라는 전제 위에 있다 —
>   다중화하면 두 대가 같은 리드를 처리해 **같은 자동 메모가 두 번** 남을 수 있다(상태는 멱등).
> - **저장소 설정은 `settings_config`(JSONB)** 라 마이그레이션이 없다. 대신 자동 승인 켜진 폼을 찾을 때
>   **리드폼을 전량 조회해 자바에서 거른다** — 테스트가 H2 라 Postgres JSONB 문법을 못 쓴다.
>   리드폼이 수천 개가 되면 별도 컬럼으로 승격해 인덱스를 걸 것.
> - **알림을 보내지 않는다.** 텔레그램·구글시트·문자는 신규 접수 훅에만 걸려 있다. 상태 변경에
>   알림을 붙이면 자동 승인이 새벽에 수십 건을 쏜다.
> - 급히 멈추려면 VM `.env` 에 `APP_LEAD_AUTO_APPROVE_ENABLED=false` 후 재기동.
>
> #### 🔴 같은 브랜치에 함께 담은 것 — 광고주 관련 2건
>
> | 커밋 | 내용 |
> |---|---|
> | `387be4b` | **FREE 광고주 계정 상한 해제** (`app.advertiser.max-free` 1 → 0 무제한) |
> | `752d4c9` | **광고주 삭제 500 수정** (Flyway **V27**) |
>
> **광고주 상한**: 초대 모달의 빨간 문구는 안내문이 아니라 **한도에 걸려 나온 409 에러**였다.
> 결제·플랜이 없어 상한만 걸려 있으면 실사용을 막으므로 값을 0(무제한)으로 풀었다.
> 판정 코드(`checkCanAddAdvertiser`)와 테스트는 그대로 — **플랜 작업 때 값만 되돌리면 된다.**
> ⚠️ VM `.env` 에 `APP_ADVERTISER_MAX_FREE` 가 있으면 환경변수가 이긴다.
>
> **광고주 삭제 500**: `lead_notes.owner_id` 가 `users(id)` 를 **`on delete` 절 없이** 참조해(V16)
> 기본값이 RESTRICT 였다. 광고주가 메모를 쓰거나 상태를 바꾸면 그 행이 쌓이므로
> **활동한 광고주는 삭제가 막히고 500** 이 났다(`DataIntegrityViolationException` 핸들러 없음).
> → 사용자 결정대로 **메모는 보존하고 작성자만 비운다**. V27 로 NOT NULL 해제 + `on delete set null`,
> `AdvertiserService.delete` 가 삭제 전에 작성자를 비운다. 화면에는 **'삭제된 광고주'** 로 표시.
> `AdvertiserNoteResponse.of` 의 NPE 도 함께 고쳤다(작성자 null 메모가 섞이면 목록 전체가 500).
>
> ⚠️ **V27 의 FK 동작은 테스트로 검증되지 않는다.** 테스트는 H2 이고 `LeadNote.ownerId` 가
> 연관관계가 아닌 단순 컬럼이라 **H2 스키마에는 FK 가 아예 생기지 않는다** — 그래서 수정 전에도
> H2 에서는 삭제가 성공했다(운영 Postgres 에서만 터졌다). **V27 은 배포 때 처음 실행된다.**
> 배포 직후 앱이 기동하면 마이그레이션이 통과한 것이고, 실제 확인은 활동 이력이 있는
> 광고주를 삭제해 보면 된다.
> ⚠️ 다른 곳도 같은 함정이 있다 — `users(id)` 를 `on delete` 없이 참조하는 테이블이
> `forms`·`landing_pages`·`consent_documents`·`html_components`·`interaction_events`·
> `integration_settings` 에 남아 있다. **마케터 계정 삭제 기능을 만들 때 같은 500 을 만난다.**
>
> #### 남은 일
> 1. **브라우저 검증 못 했다** — 이 PC 에 `backend/application-local.properties`(Neon 접속정보)가 없어
>    백엔드를 띄울 수 없다(H2 는 `testRuntimeOnly` 라 bootRun 클래스패스에 없다).
>    검증 항목: 리드폼 편집 → 옵션 카드에서 체크·일수 저장 → 다시 열었을 때 값 유지.
> 2. **`main` 병합·배포** (백엔드 변경이라 약 1분 다운타임).
> 3. 배포 후 실제 동작 확인은 **일수가 지나야** 보인다. 빨리 보려면 1일로 두고 하루 뒤 리드 상세의
>    이력에 자동 메모가 찍혔는지 확인.

> ### ⏸ 2026-08-05 세션 마감 (wincube PC) — **다음 세션은 여기서 시작**
>
> **Flyway V26 까지 → 다음은 V27** · 백엔드 테스트 **184개 통과** · 프론트 타입체크·빌드 통과
>
> #### 오늘 한 것
> | 커밋 | 내용 | 배포 |
> |---|---|---|
> | `351c77d` | 🔥 **예열(warm-up)** — 기동 후 첫 요청 단축 + 지난번 실패한 커넥션 풀(`84aa289`) 동반 | ✅ 라이브 |
> | `6ba6bab` | **계정별 문자 발송 권한(V25)** — 발송 on/off · 허용 채널 · 월 한도 | ✅ 라이브 |
> | `bee4087` | **어드민 기반(V26)** — `/api/admin/**` + 감사로그 + 환경변수 승격 | ✅ 라이브 |
> | `80fc707` | 어드민 화면 + `SmsPage` 한도 표시 버그 수정 | ✅ 라이브 |
> | `b44a103` | 메타 잠재고객 연동 **설계 문서**(코드 미착수) | — |
> | `f1a7683` | **배포 빌드를 Actions 러너로 이전** | ✅ 라이브 |
>
> `main` 최신 = `e3e48fd`(머지 커밋). 작업트리 클린.
>
> #### 🔴 배포됐지만 아직 쓸 수 없다 — 운영자 계정을 만들어야 한다 (SSH 필요, 사용자 몫)
> 어드민 화면은 라이브지만 **ROLE_ADMIN 계정이 아직 없어 아무도 들어갈 수 없다.**
> VM `~/Leadpot/.env` 에 아래를 넣고 재기동하면 그 계정이 기동 시 승격된다:
> ```
> APP_ADMIN_BOOTSTRAP_EMAIL=<운영자 이메일>
> ```
> ```bash
> docker compose -f ~/Leadpot/docker-compose.prod.yml up -d
> ```
> ⚠️ **승격된 계정은 마케터 화면에 더 이상 들어갈 수 없다**(오늘 `/api/**` 를 ROLE_USER 전용으로 좁혔다).
> 마케터 기능도 함께 써야 한다면 **별도 계정을 운영자로 만들 것.**
> 그 뒤 `/admin` 에서 본인 마케터 계정에 문자 권한(발송 on · 채널 · 월 한도)을 열어준다.
> **DB 수동 UPDATE 는 필요 없다.**
>
> #### 예열 효과 실측 — **개선했지만 목표(1초) 미달**
>
> **갓 재기동한 컨테이너에서 잰 값**(2026-08-05 17:32, 두 번째 배포 직후 — 이게 깨끗한 측정이다):
> | 호출 | 값 |
> |---|---|
> | `/api/public/landings/11/live` **첫 호출** | **1,992ms** |
> | 2번째 | 703ms |
> | 3번째 | 541ms |
> | `/api/health`(DB 안 탐) | 115~150ms |
>
> **6.80초 → 2.0초.** 크게 줄었지만 성공 기준으로 잡은 "1초 이내"에는 못 미친다.
>
> ⚠️ **원인 가설: 예열이 각 경로를 1회만 밟아 JIT 이 적용되지 않는다.** 2·3번째가 계속 빨라지는 것이 근거다.
> → **후속: 경로별 3~5회 반복**(아래 "다음에 할 일"). 단정은 아니며 SSH 로 `[warmup]` 로그의 단계별 소요를 보면 판명된다.
>
> ⚠️ 앞서 기록했던 `944ms` 는 **이미 한참 떠 있던 컨테이너**에서 잰 값이라 깨끗한 측정이 아니었다 — 위 값이 맞다.
>
> **덤으로 확인된 것**: `115ms`(DB 안 탐) vs `541ms`(웜, DB 탐) → **응답시간의 약 74%가 Neon 싱가포르 왕복**이다.
> 앱 최적화로는 안 줄어든다. DB 이전이 유일한 해법임이 수치로 확인됐다.
>
> #### ✅ 러너 빌드 이전 검증됨 (2026-08-05 두 번째 배포)
> | 항목 | 실측 |
> |---|---|
> | push → 서비스 복구 | **약 5분** (예측 2~3분보다는 길다) |
> | 실제 다운타임 | **약 1분 52초** (17:28:22 → 17:30:14) |
> | 이전(VM 빌드) | 10분 06초 / 16분 49초 |
>
> 검증 근거(SSH 없이):
> - **다운타임이 발생하고 복구됐다** = 컨테이너가 새 이미지로 교체됐다 = **jar 전송 + `Dockerfile.runtime` 빌드 성공**.
>   빌드가 실패했다면 옛 컨테이너가 그대로 떠 있어 다운타임이 없었을 것이다.
> - **`/api/admin/users`·`/api/admin/audit` → 401**. 전에 없던 경로이므로 **새 코드가 배포됐고** 보호도 걸렸다.
> - **앱이 기동했다 = Flyway V25·V26 정상 적용**(실패하면 기동 자체가 안 된다).
>
> #### ❓ 확인 필요: 서버 리전이 **서울인지 오사카인지 기록이 상충한다**
> - 아래 2026-07-27 절(최종 구성)에는 **"서울 AD-1"** 로 적혀 있다 — 실제 배포 세션의 기록이다.
> - 2026-08-05 사용자 확인: **"지금 나 osaka 리전이야"**.
>
> Always Free 리소스는 **홈 리전에만** 만들 수 있고 홈 리전은 **변경 불가**다. 따라서 둘 중 하나가 틀렸다.
> **콘솔에서 인스턴스 상세의 리전·AD 를 한 번 확인해 이 줄을 정리할 것.** (오늘 A1 생성 시도는 오사카에서 했다)
>
> → 어느 쪽이든 **DB 이전의 이득은 그대로다.** 핵심은 "서울이냐"가 아니라 **앱과 DB 를 같은 곳에 두는 것**이고,
> 지금 병목은 Neon 싱가포르 왕복 333ms 다. 한국↔서울 vs 한국↔오사카 차이(수십 ms)는 부차적이다.
>
> #### 다음에 할 일
> 1. **🔴 운영자 계정 만들기** — 위 "배포됐지만 아직 쓸 수 없다" 절. 이게 없으면 어드민 화면이 무용지물이다.
> 2. **예열을 경로별 3~5회 반복** — 첫 호출이 여전히 2.0초다(목표 1초). 위 실측 절 참고.
>    비동기라 기동 시간에 영향 없고 조회 전용이라 부작용도 없다.
>    ⚠️ Neon 무료 플랜 컴퓨트 사용량을 함께 확인할 것.
> 3. **어드민 화면 브라우저 검증** — 오늘 못 했다(Neon 접속정보 없음 · ADMIN 계정 없음).
>    이 PC 에서 하려면 `backend/application-local.properties`(Neon 접속정보)가 필요하다.
> 4. **리드폼 편집 화면의 byte 카운터 옆 LMS 권한 경고** — 미착수(`/sms` 화면에만 넣었다).
>    SMS 만 허용된 계정이 긴 본문을 저장하면 발송 때 조용히 막히는 함정이다.
> 5. 메타 연동은 [META-LEADS-PLAN.md](META-LEADS-PLAN.md) §7 의 **사용자 결정 4건**부터.
>
> #### 서버 이전 — 보류 (사용자 결정)
> - **Oracle ARM(Ampere A1)**: Always Free ARM 몫이 2026-06-15 부터 **4 OCPU/24GB → 2 OCPU/12GB** 로
>   반토막 났지만 그래도 지금(1GB)의 12배다. **그런데 오사카 A1 이 `Out of capacity`** 로 안 잡힌다(오늘 시도).
>   x86 → ARM 은 shape 변경이 안 되므로 **새 인스턴스를 만들어 통째로 이전**해야 한다.
> - **SSH 키 2개를 이 PC 에 만들어 뒀다**: `~/.ssh/leadpot_arm`(사람용) · `~/.ssh/leadpot_deploy`(Actions용).
>   A1 이 잡히면 공개키를 인스턴스에 넣고 바로 진행할 수 있다. Actions 용은 `VM_SSH_KEY` 시크릿을 교체하면 된다.
> - **Vultr 서울 2GB $10 / 4GB $20** — **최후의 보루**로 두기로 했다(사용자 결정).
> - ⚠️ **DB 를 VM 안 Postgres 로 옮기면 백업이 우리 책임**이 된다(Neon 은 자동 백업·PITR 제공).
>   백업 스크립트 + 오프사이트 저장을 먼저 만들지 않으면 개선이 아니라 리스크 증가다.
>
> #### ⚠️ 다음 사람이 알아야 할 함정 (오늘 만든 것)
> - **문자 월 한도 `0` 은 금지다.** 제거된 플랜 상수(`app.sms.monthly-limit.*`)는 `0` 을 **무제한**으로
>   해석했다. 규약이 정반대라 섞이면 **권한 없는 계정이 무제한**이 된다. 판정은 `SmsPermissions` 한 곳만 거친다.
>   무제한은 `-1`. (오늘 `SmsPage` 가 실제로 금지 계정에 "무제한"이라고 표시하던 버그를 고쳤다)
> - **채널은 발송 시점에 결정된다** — 본문 90byte 초과 → LMS, 첨부 → MMS. SMS 만 허용된 계정이 긴 본문을
>   저장하면 **저장은 되는데 발송 때 막힌다.** `/sms` 에 경고를 넣었지만 **리드폼 편집 화면에는 아직 없다.**
> - **운영자(ROLE_ADMIN)는 이제 마케터 API 에 접근할 수 없다**(`/api/**` = ROLE_USER 전용). 운영자가 마케터
>   기능을 써야 하면 **별도의 마케터 계정**을 쓴다. 프론트도 `/admin` 만 열린다.
> - **로컬과 배포의 Dockerfile 이 다르다** — 로컬 `backend/Dockerfile`(컨테이너 안 빌드) /
>   배포 `backend/Dockerfile.runtime`(jar COPY). 합치지 말 것.

> ### ⏸ 2026-08-04 밤 세션 마감 (gooin PC) — **내일 새 세션은 여기서 시작**
>
> 작업트리 클린 · **Flyway V24 까지 → 다음은 V25** · 백엔드 테스트 153개 통과 · 프론트 타입체크·빌드 통과
>
> **내일 순서**
> 1. **배포 재시도** — `84aa289`(커넥션 풀)이 배포되지 않았다. 아래 ⚠️ 참고.
> 2. **🔥 예열(warm-up)** — 기동 후 첫 요청 6.8초 문제. 아래 블록. 1번과 함께 배포하면 된다.
> 3. **🔒 문자 발송 권한·채널·횟수 제한** — 설계는 확정돼 있고, 착수 시 정할 건
>    **허용 채널을 CSV 한 칸으로 둘지 boolean 3개로 둘지** 하나뿐이다.
>    마이그레이션 V25 배포 후 **운영자 계정만 수동 UPDATE** 하는 것까지가 한 묶음이다.
>
> #### 오늘 커밋한 것
> | 커밋 | 내용 | 배포 |
> |---|---|---|
> | `e1d2fcf` | 🔴 **리드폼 저장 500 수정** — 변수키 유니크 위반(INSERT 가 DELETE 보다 먼저 실행) | ✅ 라이브 |
> | `e5d5e0a` | 사업자 정보 푸터 전역화(ServiceLayout) + 정렬 정리, '꾸스가 운영하는' 문장 제거 | ✅ 라이브 |
> | `b451a7a` | 동의문서 '보기' 링크를 앱 도메인 절대 URL로 고정(서브도메인·임베드 404 해결) | ✅ 라이브 |
> | `37ea4e7` | 알림 링크 `/leads` → `/inbox` 라우트 연결(문자·알림톡 버튼이 대시보드로 튕기던 문제) | ✅ 라이브 |
> | `84aa289` | 커넥션 풀(HikariCP) 유휴 대응 | ❌ **배포 실패 — 아래 참고** |
>
> ⚠️ **`84aa289` 백엔드 배포가 끝나지 않았다.** VM 은 코드를 받았지만(`git log` = 84aa289)
> **컨테이너는 이전 이미지 그대로**고(`docker logs | grep leadpot-pool` = 0건), 빌드 프로세스도 남아 있지 않았다.
> dmesg 에 OOM 기록은 없어 원인 미확정 — **VM 가용 메모리 218MB 라 빌드가 죽었을 가능성**이 있다.
> → **내일 첫 할 일: 배포 재시도**(GitHub Actions 재실행 또는 VM 에서
> `cd ~/Leadpot && docker compose -f docker-compose.prod.yml up -d --build`).
> 어차피 아래 예열 작업도 배포가 필요하니 **같이 올리면 된다.** 반영 확인은 로그에 `leadpot-pool` 이 찍히는지로 한다.
>
> #### 유휴(idle) 대응 — 한 것과 못 한 것
> **한 것**: `application.properties` 에 HikariCP 설정 추가(`keepalive-time` 2분·`minimum-idle` 3·
> `max-lifetime` 25분·`connection-timeout` 10초). 유휴 뒤 첫 요청의 **커넥션 재수립 +400ms 를 없애는 것**이 목적.
> 전부 환경변수로 덮어쓸 수 있게 뒀다(`APP_DB_KEEPALIVE_MS` 등).
> **못 한 것(=DB 이전 몫)**: **쿼리 1회 170~280ms** 는 그대로다. DB 가 싱가포르에 있어서이고 풀 설정으로는 안 줄어든다.
> ⚠️ keepalive 가 Neon 을 계속 깨워두므로 **무료 플랜 컴퓨트 사용량**을 한 번 확인할 것.
>
> #### 사용자가 직접 처리하기로 한 것 (2026-08-04 확정 — 우리가 손대지 않는다)
> 1. **고객(접수자)향 문자 본문** — 지금 접수자에게 본인 답변(신용카드·소득·채무)을 되돌려 보내고 있다.
>    사용자가 화면에서 직접 조정. (90byte 이하로 줄이면 굵은 제목 줄도 사라지고 단가도 내려간다)
> 2. **DB 서울 이전** — Neon 은 서울·도쿄 리전이 **없다**(유료도 동일). 현재 DB 크기 **9.6MB**.
>    후보: Supabase 서울(무료 500MB) / VM 내 Postgres(서버 업그레이드 선행) / 유료 관리형.
> 3. **솔라피 실제 청구 단가 확인** — 우리 문서·코드 주석은 13/29/60원, 공개 페이지는 **18/45/110원**(알림톡 13원).
>    어긋나 있으니 콘솔 이용내역 확인 후 문서를 바로잡을 것.
>
> #### 문자 subject(제목)는 **일부러 넣지 않았다** (사용자 결정)
> LMS·MMS 는 제목 칸이 있어서, 제목을 안 보내면 **본문 앞부분이 제목처럼 굵게** 표시된다(2026-08-04 실제 발생).
> 구현했다가 **전부 되돌렸다** — "선택 필드면 빼자, 나중에 추가하자"는 판단. 저장소에 흔적 없음.
> 다시 넣을 때 주의: **`subject` 를 실으면 본문이 짧아도 대행사가 LMS 로 전환**해 단가가 오른다
> → **LMS·MMS 로 판정될 때만** 붙여야 한다. 굵은 줄을 피하는 다른 방법은 **본문 90byte 이하 유지**뿐이고,
> **첨부(MMS)는 본문을 줄여도 피할 수 없다.**

> ### 🔥 [내일 작업] 기동 후 첫 요청이 6초 — **예열(warm-up)** 넣기 (2026-08-04 실측)
>
> **증상**: 공개 랜딩 API 를 그 컨테이너에서 **처음 호출**할 때 **6.8초**. 그 뒤로는 0.4~0.8초.
>
> **실측 (2026-08-04, 외부에서 `https://api.lead-pot.com` 호출)**
> | 상황 | 값 |
> |---|---|
> | `/api/public/landings/11/live` **첫 호출** | **6.80초** |
> | 20분 유휴 후 첫 호출(이미 데워진 뒤) | 0.78초 |
> | 웜 | 0.43~0.60초 |
> | `/api/health`(DB 안 탐) | 0.11초 |
>
> **원인은 유휴가 아니다.** 그 6.8초를 잰 시점에 컨테이너는 이미 1시간 넘게 떠 있었다.
> **경로(엔드포인트)를 그 프로세스에서 처음 탈 때** 비용이 몰리는 것이다:
> Hibernate 의 해당 엔티티 쿼리·메타데이터 준비 + JSON 직렬화기 초기화 + JIT 미적용 인터프리터 실행.
> → **커넥션 풀·keepalive 로는 해결되지 않는다**(그건 유휴 커넥션 재수립 +400ms 만 없앤다).
>
> **언제 재발하나**: 컨테이너가 새로 뜰 때마다, **경로마다 각각 1회**.
> ① 백엔드 배포 ② **메모리 부족으로 컨테이너가 죽고 자동 재시작**(가용 218MB — 예고 없이 일어난다) ③ VM 재부팅.
> ⚠️ **가장 위험한 건 리드 제출 경로**다. 방문자가 광고를 클릭해 폼을 채우고 '제출'을 눌렀는데
> 그게 그 컨테이너의 첫 제출이면 몇 초를 기다린다 → **이탈**. 반드시 예열 대상에 넣는다.
>
> **할 일**: 기동 완료 후(`ApplicationReadyEvent`) 서버가 스스로 공개 경로를 한 번씩 밟아 데운다.
> - 대상: **공개 랜딩 조회 · 공개 폼 조회 · 리드 제출 경로 · 로그인**
> - ⚠️ **데이터를 바꾸면 안 된다** — 리드 저장·방문 기록(`recordVisit`)은 하지 말고 조회·검증 경로만 태운다.
> - ⚠️ **기동 시간(현재 92초)을 더 늘리지 않도록 비동기**로 돌린다. 헬스체크를 막으면 배포가 실패한다.
> - ⚠️ published 랜딩이 하나도 없으면 조용히 건너뛴다(신규 환경에서 기동 실패하면 안 된다).
> - 배포 헬스체크가 `/api/health`(DB 안 탐)만 보고 UP 판정하는 것도 이 예열이 보완한다.
> - **성공 기준**: 배포 직후 첫 방문자가 **1초 이내**. (사용자 판단: "1초는 괜찮다, 6초가 문제다")
>
> **하지 않기로 한 것(지금은)**: 공개 랜딩 응답 **캐시**(0.78초 → 0.15초). 효과는 크지만
> 사용자가 1초는 허용 가능하다고 판단해 우선순위를 내렸다. 필요해지면 그때 넣는다 —
> 설계는 **TTL 이 아니라 '저장 시 무효화' 기반의 장기 캐시**여야 한다(방문이 몇 시간에 한 번이면 TTL 은 매번 만료된다).
> ⚠️ 그때 **IP 차단 검사를 캐시에 태우면 안 된다**(방문자마다 달라 차단이 무력화된다).

> ### 🔒 [내일 작업] 문자 발송을 권한 있는 계정만 쓰게 막기 (2026-08-04 사용자 지시)
>
> **왜**: 문자는 **리드팟 솔라피 계정 하나**로 나가고 **비용을 우리가 부담**한다(MESSAGING-PLAN §11).
> 지금은 **모든 마케터가 리드폼에서 자유롭게 켤 수 있어** 돈이 샌다. 실제로 단가가 생각보다 높다.
> → **당분간 운영자 계정(사용자 본인)만** 쓰게 하고, 나중에 요금제와 함께 열어준다.
>
> **지금 상태**: 플랜별 **월 한도**(FREE 100 / PRO 5000, `SmsService.quotaError`)만 있고
> **기능 자체를 막는 장치가 없다.**
>
> **설계 = 계정(users) 컬럼 방식으로 확정 (2026-08-04 사용자 결정)**
>
> 통제할 것이 **세 가지**다. 전부 **기본 off**, **내 계정만 수동으로 DB UPDATE**, **어드민 화면은 나중에**.
> 1. **발송 자체 on/off**
> 2. **허용 채널** — SMS · LMS · MMS 중 무엇을 쓸 수 있는지 (단가가 13/29/60원대로 갈리므로 채널별로 막는다)
> 3. **발송 횟수 제한** — 계정별 월 상한
>
> **마이그레이션 초안 (V25)**
> ```sql
> ALTER TABLE users ADD COLUMN sms_enabled boolean NOT NULL DEFAULT false;
> -- 허용 채널. CSV 한 칸으로 두면 나중에 'ALIMTALK' 을 같은 자리에 추가할 수 있다.
> -- (대안: sms_allow_lms/sms_allow_mms boolean 3개 — 어드민 토글은 편하지만 채널이 늘면 컬럼이 늘어난다)
> ALTER TABLE users ADD COLUMN sms_allowed_channels varchar(40) NOT NULL DEFAULT '';
> ALTER TABLE users ADD COLUMN sms_monthly_limit integer NOT NULL DEFAULT 0;
> ```
> 배포 후 **내 계정만 수동 개방**(어드민 화면이 없으므로 DB 직접 UPDATE. 계정 email 은 착수 시 확인):
> ```sql
> UPDATE users SET sms_enabled = true, sms_allowed_channels = 'SMS,LMS,MMS', sms_monthly_limit = 500
>  WHERE email = '<운영자 계정>';
> ```
>
> ⚠️ **0 의 의미가 기존 코드와 반대다 — 사고 1순위.**
> 기존 `SmsService.quotaError` 는 **`limit <= 0` 을 "무제한"** 으로 해석한다(플랜 상수 기준).
> 새 `sms_monthly_limit` 은 **`0` = 발송 금지**로 쓸 것이므로, 두 규약이 섞이면 **권한 없는 계정이 무제한이 된다.**
> → 착수 시 **계정 컬럼을 유일한 기준으로 정리**하고 플랜 상수(`app.sms.monthly-limit.*`)는 상한/기본값으로만 남기거나 제거한다.
>
> **⚠️ 막아야 하는 지점 (UI만 숨기면 API 로 뚫린다 — 전수로 처리할 것)**
> 1. **`SmsService.send()`** — 최종 관문. 순서대로 검사하고 **막을 때마다 `SKIPPED` 로 사유를 남긴다**
>    (조용히 사라지면 안 된다는 기존 원칙 유지):
>    ① `sms_enabled` 꺼짐 → "문자 발송 권한이 없습니다"
>    ② 판정된 채널이 `sms_allowed_channels` 에 없음 → "이 계정은 LMS 발송이 허용되지 않았습니다"
>    ③ 월 한도 초과 → 기존 문구 유지
> 2. **`SmsController`** — `POST /api/sms/test`(테스트 발송), **첨부 업로드**(`uploadAttachment` 는
>    솔라피 저장소에 실제로 올라가므로 **MMS 권한이 없으면 업로드부터 막는다**).
>    현황·이력 **조회는 열어둬도 된다.**
> 3. **리드폼 저장(`FormService.update`)** — `settingsConfig.smsMarketerEnabled` 등이 `true` 로 들어오면
>    **서버에서 거부하거나 강제로 false 처리.** 첨부(`smsLeadImageId`)도 **MMS 권한이 있어야** 저장되게 한다.
>    화면만 숨기면 API 직접 호출로 켤 수 있다.
> 4. **화면** — 리드폼 편집의 '문자 발송' 카드와 `/sms` 진입을 권한 없는 계정에는 숨기고 안내를 띄운다.
>    권한·허용채널·남은 건수를 알려주는 API 가 필요하다(`GET /api/sms/permissions` 신설 또는 기존 현황 API 확장).
>
> **⚠️ 채널 권한의 함정 — 본문 길이에 따라 채널이 바뀐다.**
> SMS 만 허용된 계정이 본문을 90byte 넘게 쓰면 **저장은 되는데 발송 때 조용히 LMS 로 판정돼 차단된다.**
> → 리드폼 편집의 **byte 카운터 옆에 "이 계정은 LMS 발송 권한이 없습니다" 경고**를 붙여
>    저장 시점에 알 수 있게 한다. 첨부를 붙이면 MMS 가 되는 것도 같은 방식으로 경고한다.
>
> **주의**: 권한을 끄기 전에 **이미 켜 둔 리드폼**이 있으면 발송 시 `SKIPPED` 로 남는다 —
> 사유 문구를 "권한이 없어 보내지 않았습니다"처럼 명확히 해서 마케터가 오해하지 않게 한다.

> ### 💬 카카오 비즈니스 채널 인증 **승인됨** → 알림톡 붙이기 (2026-08-04)
>
> 반려됐던 비즈니스 채널 인증이 **승인**됐다(`/about` 페이지로 재신청한 건이 통과). 계획 정본은
> [MESSAGING-PLAN.md](MESSAGING-PLAN.md) **§9** — 착수 전 반드시 재정독(수신자·본문·변수 규칙이 문자와 다르다).
>
> **진행 상황 — 콘솔 작업은 끝났고 검수만 기다리는 상태다** (2026-08-04 API 로 실제 확인)
>
> | 값 | 내용 |
> |---|---|
> | **pfId (채널 ID)** | `KA01PF260804155252497tMhE0GwIYAy` |
> | **templateId** | `KA01TP260804155905596UWBE9zFG5Up` (이름: 리드 접수 알림) |
> | 채널 | `@leadpot` · 리드팟 · 담당번호 01062717059 |
> | **상태** | **`INSPECTING` = 검수진행중** → 승인되면 발송 가능 |
>
> 조회 방법(콘솔 없이도 확인 가능): `GET https://api.solapi.com/kakao/v2/channels` → `channelList[].channelId` 가 pfId.
> `GET https://api.solapi.com/kakao/v2/templates` → `status` 로 검수 상태. 인증은 문자와 같은 HMAC 헤더.
> 콘솔에서는 템플릿 우클릭 메뉴의 **'채널 ID 복사'** 가 pfId 다.
>
> **⚠️ 등록된 템플릿이 계획 문서(§9 초안)와 다르다 — 코드가 템플릿에 맞춰야 한다(템플릿은 승인 후 수정 불가)**
> - **변수 4개**: `#{리드폼}` · `#{접수시각}` · `#{미확인건수}` · `#{url}`
>   (§9 초안의 `#{리드폼명}` 이 아니라 **`#{리드폼}`** 이다. 이름이 틀리면 발송이 거부된다.)
> - **`#{미확인건수}` 를 계산하는 로직이 아직 없다** — 만들어야 한다.
> - **버튼 링크가 `https://app.lead-pot.com/leads/#{url}`** 이었고 그 라우트가 없어 대시보드로 튕겼다
>   → **`37ea4e7` 에서 `/leads`·`/leads/*` → `/inbox` 리다이렉트를 추가해 해결**했다.
>   `#{url}` 에는 아무 값이나 넣어도 리드 화면으로 간다(빈 값은 카카오가 거부할 수 있으니 리드 id 를 넣는다).
>
> **남은 단계**
> 1. **검수 승인 대기**(카카오, 영업일 1~3일). 광고성 문구면 반려된다.
> 2. **대체발송(SMS/LMS) 설정** 확인 — 실패 시에만 문자 단가로 나가므로 켜 두는 게 유리하다.
> 3. **코드** — 문자와 같은 `POST /messages/v4/send` 에 `kakaoOptions` 를 얹는다:
>    `{pfId, templateId, variables:{"#{리드폼}":"..."}, disableSms:false}`.
>    → `AlimtalkSender` 를 따로 두면 된다(`SmsSender` 인터페이스가 이미 분리돼 있다).
>    `pfId`·`templateId` 는 API 키와 같이 **환경변수로 주입**한다(코드·git 금지).
> 4. §9 대로 **수신자는 마케터·광고주만**(리드 본인 금지), 개인정보(이름·연락처·채무금액) 미포함.
>    ⚠️ 버튼이 마케터 화면(`/leads`)을 가리키므로 **광고주에게 보낼 때의 링크 처리**를 정해야 한다
>    (광고주는 `/client` 로 가야 한다 — 템플릿 버튼이 하나뿐이라 별도 템플릿이 필요할 수 있다).
>
> **💰 비용 (알림톡을 먼저 붙일 이유)** — 솔라피 공개 단가 페이지(2026-08-04 확인) 기준
> **알림톡 13원 < SMS 18원 < LMS 45원 < MMS 110원.** 마케터·광고주 접수 알림(지금 SMS 2건)을
> 알림톡으로 옮기면 건당 36원 → 26원으로 내려간다.
> ⚠️ **단가 수치가 문서와 어긋난다** — MESSAGING-PLAN §10 과 코드 주석에는 **13/29/60원**으로 적혀 있는데
> 공개 페이지는 **18/45/110원**이다(부가세 별도, 할인 구간 여부 불명). **실제 청구 단가를 콘솔 이용내역에서
> 확인한 뒤 문서를 바로잡을 것.** 위 '문자 권한 제한' 판단의 근거가 되는 숫자다.

> ### 🔥 리드폼 저장 장애 수정 · 전역 푸터 · 로그인 지연 진단 (2026-08-04 밤, gooin PC)
>
> **`main` 최신 = `e5d5e0a`** · 작업트리 클린 · 전부 배포됨 · **Flyway V24 그대로 → 다음 V25**
> 백엔드 테스트 153개 통과 · 프론트 타입체크·빌드 통과
>
> #### 1) 🔴 리드폼 저장 500 수정 (긴급, 배포 완료 `e1d2fcf`)
>
> **증상**: 항목이 있는 기존 리드폼을 저장하면 `PUT /api/forms/{id}` 가 500.
> `ERROR: duplicate key ... "ux_form_blocks_form_var_key"  Detail: Key (form_id, var_key)=(19, f1) already exists.`
>
> **원인**: 저장할 때 블록을 전부 지우고 새로 만드는데(`replaceBlocks`) 변수키(f1 …)는 그대로 유지한다.
> 그런데 **Hibernate 는 한 트랜잭션에서 INSERT 를 orphan DELETE 보다 먼저 실행**한다 →
> 옛 `f1` 행이 아직 살아 있는 상태로 새 `f1` 을 넣어 V22 의 부분 유니크 인덱스를 위반.
> **V22(08-02) 배포 이후 계속 깨져 있었던 것으로 보인다**(로그로는 form 19 시도만 확인됨).
>
> **수정**: `Form.replaceBlocks` 를 `clearBlocks()` + `addBlocks()` 로 쪼개고,
> `FormService.update` 가 **`clearBlocks()` → `formRepository.flush()` → `addBlocks()`** 순서로 부른다.
> flush 가 DELETE 를 INSERT 보다 먼저 DB 로 보낸다. 회귀 테스트 3개 추가(`FormVarKeyTest$TwoStepReplace`).
>
> ⚠️ **다음 사람 주의**: 블록을 "전부 지우고 다시 만드는" 구조가 그대로라 같은 함정이 또 생길 수 있다.
> 근본 해법은 **블록 id 를 살려 제자리 UPDATE** 로 바꾸는 것(범위가 커서 이번엔 안 했다).
> 그리고 **부분 유니크 인덱스는 DEFERRABLE 로 못 만든다**(PostgreSQL 제약) — 제약을 미루는 우회는 불가.
>
> #### 2) 사업자 정보 푸터 전역화 (배포 완료 `e5d5e0a`)
> - `components/ServiceLayout.tsx` 신설 — 레이아웃 라우트 한 곳에서 푸터를 붙인다. 페이지에 직접 넣지 말 것.
> - **붙는 곳**: 마케터 화면 전체 + 로그인·회원가입·`/about`
>   **일부러 빼는 곳**: 공개 폼·랜딩·서브도메인(고객의 페이지 — 운영주체 오인) /
>   광고주 포털 `/client/*`·광고주 미리보기(화이트라벨)
> - **'꾸스가 운영하는 서비스입니다' 문장 제거**(사용자 요청). 카카오가 요구하는 상호↔서비스명 연관성은
>   **`/about` 본문 "운영 주체" 절**이 담당한다 → **그 문장은 지우면 안 된다.**
> - 정렬: 넓은 화면 좌(사업자정보)↔우(소개·저작권), 주소만 아랫줄 / 모바일은 세로 스택.
>   검증: 375px 오버플로 0 · 1280px 좌우 정렬 · 제외 화면 미노출 · 콘솔 에러 0
>
> #### 3) ⏳ 로그인이 느린 원인 — 진단만 했고 **미수정**(사용자 결정 대기)
>
> | 측정(VM 내부, 네트워크 영향 제외) | 값 |
> |---|---|
> | `/api/health` (DB 안 탐) | **4ms** |
> | 로그인 = DB 조회 1회 | **166~285ms** |
> | 6분 유휴 후 첫 요청 | **740ms** (이후 330ms) |
>
> **원인은 DB 위치다.** Neon 이 **`ap-southeast-1`(싱가포르)**, 서버는 **서울(❓ 오사카일 수 있음 — 2026-08-05 절 참고)** → 쿼리 1회마다 170~280ms.
> 앱 자체는 4ms 로 멀쩡하다. 실제 로그인은 조회+BCrypt+(광고주면)감사로그 INSERT 로 왕복이 쌓인다.
> 부차 요인: **Neon 풀러(`-pooler`) 미사용** · **HikariCP 설정 전무**(keepalive 없어 유휴 뒤 커넥션 재수립 +400ms).
>
> **선택지**: ① Hikari `keepalive-time`·`minimum-idle` (5분, 유휴 +400ms 만 제거. ⚠️ Neon 무료 컴퓨트 한도 확인 필요)
> ② `-pooler` 엔드포인트로 변경(10분) ③ **DB 를 서울로 이전 — 이게 진짜 해법**(쿼리 170ms→5ms).
> Neon 은 리전 이동이 안 되므로 서울 프로젝트 신규 생성 + `pg_dump` 복원, 또는 VM 내 Postgres(⚠️ 메모리 956MB
> 가용 221MB 라 서버 업그레이드 선행).
>
> #### ✅ 정정: 솔라피 자격증명은 이미 들어가 있다
> 서버 `.env` 와 **실행 중 컨테이너 모두에 `APP_SMS_SOLAPI_API_KEY`·`_API_SECRET`·`_SENDER_PHONE` 3개가 있다.**
> 즉 **아래 2026-08-02 절의 STEP 0-3(자격증명 주입)은 끝났다** → 남은 건 **STEP 1 실발송 검증**뿐이다.
>
> #### 다음에 할 일
> 1. **리드폼 저장 실제로 눌러 확인**(form 19 저장 → 200, 변수키 유지 여부). 배포는 끝났고 실사용 확인만 남았다.
> 2. **`/sms` 테스트 발송으로 STEP 1 실발송 검증** — 자격증명이 이미 있으니 바로 가능하다.
> 3. **로그인 지연**: 위 ①②③ 중 무엇을 할지 결정.
> 4. 카카오 채널 인증 재신청(`/about` 시크릿 창 확인 후) — 아래 절 참고.

> ### 📱 문자 발송 UI·기능 보완 (2026-08-04, wincube PC)
>
> **아직 실발송 검증(STEP 1)은 안 끝났다.** 솔라피 자격증명이 서버 `.env` 에 들어가야 시작된다(아래 2026-08-02 절 STEP 0~1).
>
> **이 세션에 한 일**
> 1. **`/sms` 레이아웃 깨짐 수정** — 375px 화면이 643px 로 벌어지고 있었다. 범인은 **발송 이력 표**.
>    - `.card-table { overflow: hidden }` 은 넘친 걸 자를 뿐 **페이지가 넓어지는 걸 못 막는다** → `overflow-x: auto`.
>    - `.app-shell > *:not(.app-nav)` 에 **`width: 100%` 추가** — `min-width: 0` 만으로는 본문 폭이 max-content 로 잡혔다. **이게 진짜 원인.**
>    - KPI 3칸이 **인라인 style 이라 미디어쿼리를 이기고 있었다** → `.kpis-3` 클래스로 분리.
>    - ⚠️ 이 수정은 `.card-table` 을 쓰는 **모든 표 화면에 함께 적용**된다(같은 잠재 버그가 있던 자리).
>    - 실측: 375px 오버플로 0 / 1440px LNB 224 + 본문 1216 = 1440.
> 2. **수신번호를 리드폼별로** (`smsMarketerPhone`·`smsAdvertiserPhone`) — 비우면 계정 연락처 폴백.
>    광고주는 **번호를 직접 넣으면 광고주 계정 연결이 없어도 발송**된다. 마이그레이션 없음(settingsConfig).
>    → 기존 함정(계정 연락처가 비면 마케터 알림이 조용히 SKIP)이 해소됨.
> 3. **발신번호 칸 제거** — 위임 등록 전엔 시스템 번호밖에 못 써서 칸만 있고 쓸 수 없었다.
>    **백엔드의 `settingsConfig.smsSenderPhone` 읽는 구조는 남겨뒀다** — 위임이 끝나면 UI 만 되살리면 된다.
> 4. **고객향 문자 이미지 첨부(MMS)** — 계획 M6 중 첨부만 선반영. 상세는 [MESSAGING-PLAN.md](MESSAGING-PLAN.md) §12.
>    솔라피는 **JPG·200KB 이하만** 받는데 **서버가 자동 변환**한다(`SmsImages`). 첨부되면 **MMS 60원**.
>    ⚠️ **PDF·HEIC·SVG 는 붙일 수 없다.** ⚠️ 원본을 우리 서버에 안 두므로 **재접속 시 미리보기가 안 보인다**(id 만 저장).
>
> **배포 파이프라인 실측 (같은 날, 위 커밋을 배포하며 확인)**
>
> 문서(CLAUDE.md §6 · DEPLOY.md)가 **실제 구성과 어긋나 있었다. 코드 기준으로 바로잡았다** → 상세는 [DEPLOY.md 부록 C](DEPLOY.md).
> - **프론트는 Cloudflare Pages 가 아니다.** GitHub Actions 가 빌드해 **VM Nginx 웹루트(`/var/www/leadpot/`)로 rsync** 한다.
> - **백엔드도 자동 배포가 있다**(`deploy-backend.yml`). 수동 `docker compose` 는 필요 없다.
> - **서버 접속**: `ubuntu@129.225.198.2` · 저장소 `~/Leadpot` · 시크릿 `~/Leadpot/.env`(자동 배포 대상 아님).
> - **실측 소요**: 프론트 1~2분(**무중단**) / 백엔드 **10분 06초(08-02) → 16분 49초(08-04)**.
> - ⚠️ **백엔드 배포는 약 60~80초 실제로 끊긴다**(502). 컨테이너가 하나뿐이라 내리고 올리기 때문.
>   **그 순간 공개 폼 제출은 실패한다.** (프론트는 해시 자산을 먼저 올려 무중단)
> - **느린 원인은 서버 사양이 아니라 빌드 위치** — `backend/Dockerfile` 이 VM 안에서 Gradle 빌드를 돈다(1 OCPU/1GB).
>
> **개선안 (DEPLOY.md 부록 C-3)**
> 1. **빌드를 GitHub Actions 러너로 옮긴다 — 비용 0원, 10~17분 → 2~3분.** 이게 먼저다.
>    서버를 올려도 이걸 안 하면 여전히 3~4분 걸린다. **미착수.**
> 2. 무중단(새 컨테이너 먼저 띄우고 전환)은 **1GB 로는 메모리가 빠듯**해서 서버 업그레이드 후에 할 일.
> 3. 유료 서버 비용 조사: **Vultr 서울 2GB $10 / 4GB $20**(지연 ~5ms). Hetzner 는 €4.5 로 싸지만
>    아시아 리전이 없어 **한국에서 ~250ms → 탈락**(공개 폼 응답이 느려진다). 표는 부록 C-4.
> - ⚠️ **공인 IP 유형(임시/예약) 미확인.** 솔라피 허용 IP 등 외부에 IP 를 등록하기 전에 예약 IP 로 전환할 것
>   (전환하면 주소가 바뀌므로 Cloudflare A레코드도 함께 갱신 — 같은 주소 유지는 불가).
>
> **다음에 할 일**
> 1. **STEP 0~1 (실발송 검증)** — 이게 최우선. 아래 2026-08-02 절 참고.
> 2. **첨부 업로드는 실제로 호출해 본 적이 없다** — 솔라피 `POST /storage/v1/files` 규격은 공식 SDK 기준으로 맞췄을 뿐이다.
>    기본 발송부터 통과시킨 뒤 첨부를 시험할 것(안 그러면 실패 시 어느 층인지 안 보인다).
> 3. **변수 사라짐 안전장치**(MESSAGING-PLAN §2)는 여전히 미구현 — 항목을 지우면 조용히 빈칸으로 나간다. 사고 위험 1순위.
> 4. **리드 상태 변경 트리거**도 미구현 — 지금은 접수 직후만 동작.

> ### 🏢 사업자 정보 표기 + 서비스 소개 페이지 (2026-08-04) — 카카오 알림톡 반려 대응
>
> **왜**: 2026-08-02 세션에서 신청한 **카카오 비즈니스 채널 인증이 반려**됨(MESSAGING-PLAN M7 대기 항목).
> 사유 = "사업자-채널의 연관성 확인/검증 불가"
> (사업자 정보 · 채널명 · 콘텐츠(판매상품)가 **모두 확인되는 자료**를 요구). 제출 가능 자료 중
> 현실적인 선택이 **홈페이지 URL** 이었는데, 기존 `app.lead-pot.com` 은 루트가 로그인으로
> 리다이렉트돼서 심사자가 볼 콘텐츠가 없었고 사업자 정보 표기도 전무했다.
>
> - ✅ **공통 푸터 `components/SiteFooter.tsx`** — 사업자 정보를 `BUSINESS` 상수 한 곳에서 관리.
>   표기: 상호 **꾸스** · 대표자 **구인성** · 사업자등록번호 **392-08-03519** · 사업장 소재지.
>   맨 위에 **"리드팟(Leadpot)은 꾸스가 운영하는 서비스입니다"** — 상호와 서비스명이 다르므로
>   이 문장이 카카오가 요구한 "연관성"을 잇는 핵심이다. 전화번호는 사용자 결정으로 제외.
>   ⚠️ **주민(법인)등록번호는 표기 대상이 아니므로 넣지 않는다.**
>   ⚠️ **노출 범위**: 우리 서비스 화면(로그인·회원가입·`/about`)에만. **공개 폼(`/f/:id`)·랜딩(`/p/:slug`)·
>   서브도메인 사이트에는 넣지 않는다** — 그건 "고객의 페이지"라 방문자가 운영주체를 오인한다.
> - ✅ **서비스 소개 `/about`** (`pages/AboutPage.tsx` + `styles/features/about.css`) — 비로그인 공개.
>   히어로 + **제공 서비스 4개**(랜딩 제작 / 상담 폼·DB 수집 / 리드 관리 CRM / 통계·연동) + 대상 고객
>   + 운영 주체. **실제 구현된 기능만** 적는다(없는 기능·실적 금지). 푸터에 `/about` 링크로 상호 연결.
> - **카카오 재신청에 제출할 URL = `https://app.lead-pot.com/about`** (이 한 화면에 사업자 정보 ①
>   + 서비스명 ② + 판매상품 ③ 이 모두 보인다). [재신청 경로](https://kko.kakao.com/PQQvMs_goj)
>
> **다음에 할 일**
> 1. **배포 후 시크릿 창으로 `/about` 확인** → **카카오 비즈니스 채널 인증 재신청**(위 URL 첨부). 승인까지 며칠.
> 2. 승인되면 **알림톡(M7) 붙이기** — 발송 시스템은 이미 있다(아래 2026-08-02 절). 계획은
>    [MESSAGING-PLAN.md](MESSAGING-PLAN.md) §9. 채널 프로필 이미지 = `docs/design/leadpot-logo-640.png`.
>    ⚠️ 알림톡은 **정보성만** 허용 — 광고성 내용이 들어가면 템플릿 심사에서 반려된다(심사 영업일 2일 이내).
> 3. SMS 쪽은 별개로 **STEP 0~1(자격증명 주입 + 실발송 검증)** 이 여전히 남아 있다 — 아래 2026-08-02 절 참고.
>
> ⚠️ **문자 발송 시스템은 이미 만들어져 있다**(솔라피 어댑터·트리거 3종·`/sms` 화면, Flyway **V24**까지).
> 이 절은 **카카오 심사 통과만을 위한 작업**이고 발송 코드는 건드리지 않았다(프론트 전용, 마이그레이션 없음).
>
> **보류(사용자 결정으로 뒤로 미룸)**
> - **동의문서 링크 버그**: '보기' 링크가 상대경로 `/consent/{id}` 라서 **서브도메인·외부 임베드에서 404**.
>   서브도메인 라우터에는 `/:identifier` 한 칸짜리 경로만 있어 두 칸 경로가 `*`(404)로 떨어진다.
>   → 해결안 A(앱 도메인 절대 URL로 고정, 권장) / B(서브도메인에도 `/consent/:id` 라우트 추가). 미결정.
> - **구글시트 → 리드팟 역방향 연동**(메타 잠재고객 시트 취합): 인바운드 API + API 키 + 외부고유ID
>   중복방지가 기반. 현재는 `POST /api/leads/import`(엑셀·CSV 업로드)로 **수동만** 가능. 미착수.

> ### ⏸ 2026-08-02 세션 마감 (gooinsung PC) — 문자 발송 시스템 1차 완료
>
> **`main` 최신 = `70ec4a8`** · 작업트리 클린 · **전부 푸시·배포됨** · **Flyway V24 까지 → 다음 V25**
> 백엔드 테스트 전체 통과 · 프론트 타입체크·빌드 통과
> 계획 정본은 [MESSAGING-PLAN.md](MESSAGING-PLAN.md) (§9 알림톡 · §10 솔라피 근거 · §11 발송 계정 구조·발신번호)
>
> #### 🚀 내일 여기서부터 (순서대로)
>
> **STEP 0 — 사용자 준비물 (이게 없으면 아래를 못 한다)**
> 1. **티플러스 회선 eSIM 개통** — 「티플 가성비(300분/6GB)_평생요금」 평생 월 1,490원. eSIM 가능 확인됨.
>    ⚠️ **솔라피 계정 명의와 회선 명의를 반드시 일치**시킬 것(다르면 위임으로 분류돼 위임장·위수탁계약서가 필요해진다).
> 2. **솔라피 가입 + 발신번호 등록** — 콘솔 > 발신번호 > 위 번호 등록 → 인증문자 입력. API 키·시크릿 발급.
> 3. **서버 `.env` 에 자격증명 주입 후 재배포** — ⚠️ **이걸 안 하면 발송이 전부 `SKIPPED` 로 기록된다.**
>    ```
>    APP_SMS_SOLAPI_API_KEY=...
>    APP_SMS_SOLAPI_API_SECRET=...
>    APP_SMS_SOLAPI_SENDER_PHONE=01012345678   # 솔라피에 사전등록된 그 번호
>    ```
>    선택: `APP_SMS_MONTHLY_LIMIT_FREE`(기본 100) · `APP_SMS_MONTHLY_LIMIT_PRO`(기본 5000)
>
> **STEP 1 — 실발송 검증 (최우선. 여기서 막히면 아래는 의미 없다)**
> - `/sms` 화면 > **테스트 발송** 버튼. 실패 사유가 화면에 그대로 나오도록 만들어 뒀다.
> - ⚠️ **솔라피로 실제 발송을 한 번도 못 해봤다**(자격증명이 없었다). 요청 본문 `{"message":{to,from,text}}` ·
>   엔드포인트 `POST /messages/v4/send` · 서명 `HMAC(secret, date+salt)` 는 **문서 기준**으로 맞췄을 뿐 실물 확인 전이다.
>   실패하면 이 세 가지를 먼저 의심할 것. 코드는 [SolapiSmsSender.java](../backend/src/main/java/com/leadpot/sms/SolapiSmsSender.java).
> - 통과하면 **리드폼 편집 > 문자 발송**에서 3종(마케터/광고주/고객)을 켜고 공개 폼으로 실제 접수해 end-to-end 확인.
>
> **STEP 2 — 계획에 있는데 아직 안 만든 것 (우선순위 순)**
> 1. **변수 사라짐 안전장치** — 리드폼 저장 시 템플릿이 쓰는 변수키가 없어지면 발송을 끄고 이유를 보여준다
>    (MESSAGING-PLAN §2). **미구현이라 지금은 항목을 지우면 그 변수가 조용히 빈칸으로 나간다.** 사고 위험이 가장 크다.
> 2. **리드 상태 변경 트리거** — 지금은 **접수 직후만** 동작한다(`LeadSmsPlanner.plan` 이 접수 훅에서만 불린다).
> 3. **템플릿 CRUD(M2)** — 지금은 리드폼별 본문 1개(`settingsConfig.smsLeadBody`)다.
>    여러 리드폼에서 재사용하려면 `message_templates` 테이블이 필요하다.
> 4. **수동 발송·첨부(M6)** — 리드를 골라 보내기. 명함 이미지 첨부는 MMS.
> 5. **메일 발송(Resend, M5)** — 문자 뒤로 밀어둔 단계.
> 6. **알림톡(M7)** — 카카오 심사 신청 완료. 통과되면 붙인다(시스템 변수만 쓰므로 M1 과 무관).
>    채널 프로필 이미지는 [docs/design/leadpot-logo-640.png](design/leadpot-logo-640.png).
>
> #### 이 세션 결과 (전부 배포)
> 1. **로고 교체** — `LeadPot` 워드마크(`Lead` 그린 `#4ECB98` + `Pot` 은 `currentColor` → 어두운 LNB 흰색·밝은 배경 네이비).
>    팟 아이콘 컴포넌트와 `.mark` 클래스 제거(사용처 6곳 전수 확인). 파비콘은 네이비 반전, 정사각 640x640 은 2줄 스택.
> 2. **광고주 화면에서 리드팟 로고 제거**(화이트라벨) — 마케터 로고가 있으면 로고만, 없으면 이름만.
>    브랜드 설정 카드의 "비워두면 기본(리드팟)" 문구도 사실에 맞게 수정.
> 3. **M1 변수키(V22)** — `form_blocks.var_key` + `forms.var_key_seq`. **지운 키는 재사용하지 않는다**(카운터를 되돌리지 않음).
>    리드 접수·CSV 임포트 시 `answers` 에 `varKey` 기록(클라이언트가 보낸 값은 믿지 않고 서버가 다시 계산).
>    스텝형은 저장 시 CHOICE 를 `steps` 상태에서 재조립하므로 `StepData` 에도 varKey 를 들고 있게 했다 —
>    안 하면 저장마다 키가 새로 발급돼 템플릿이 깨진다.
> 4. **문자 발송 시스템(V23)** — 솔라피 어댑터 + 트리거 3종 + 현황·이력 화면. 상세는 MESSAGING-PLAN §11.
>    - **리드팟 계정 하나**로만 발송(환경변수 키). 우리 비용이므로 플랜별 월 한도 적용.
>      마케터 자기 키 경로는 V23 에서 컬럼만 만들고 저장 경로를 안 만들어 죽은 분기였다 → **V24 에서 제거**.
>    - 월 사용량은 `message_logs` 의 그 달 SENT 건수로 집계(별도 카운터를 두면 실제와 어긋난다).
>    - 보내지 못한 건도 `SKIPPED` 로 남긴다 — 자동 발송이 조용히 사라지면 마케터가 알 수 없다.
>
> #### 조사해서 확정한 것 (다시 조사하지 말 것)
> - **대행사 = 솔라피.** 알리고가 단가는 싸지만(8.4원 vs 13원) **비용은 마케터 부담**이라 우리 원가가 아니고,
>   알림톡까지 어댑터 하나로 끝나며 발신번호 목록 조회 API 와 Java SDK 가 있다. (MESSAGING-PLAN §10)
> - **발신번호 위임 방식은 접었다.** 우리가 대표 발송하려면 마케터마다 위임장·위수탁계약서·사업자등록증·신분증을 걷어야 한다.
> - **회선 = 티플러스 평생 월 1,490원.** "월 0~1,000원"짜리는 전부 6~7개월 프로모션이고 이후 2~3만원으로 뛴다.
> - **A2P ≠ P2P.** 요금제의 문자 무제한은 대행사 발송에 적용되지 않는다. 회선은 문자를 나르지 않고
>   **번호 명의 증빙 + 인증문자 수신**만 한다 → 문자 무제한 요금제를 살 이유가 없다.
> - **아톡(070)은 탈락.** 더 비싸고(3,300원), 070 은 고객이 광고로 인식해 열람률이 낮고,
>   발신번호 등록에 필요한 통신서비스 이용증명원 발급 여부가 불확실하다.
>
> #### ⚠️ 남은 판단거리 (사용자)
> - **고객향 문자의 발신번호가 리드팟 번호가 된다** → 고객 회신·수신거부가 우리에게 온다(MESSAGING-PLAN §11).
>   마케터 번호로 보내려면 위임 서류가 필요하다. 고객향을 실제로 쓰기 전에 결정해야 한다.
> - 광고주 포털 내부 실화면은 여전히 **미검증**(광고주 자격증명이 없다). GO-LIVE A-3 항목.

> ### ⏸ 2026-08-01 세션 마감 (gooinsung PC)
>
> **`main` 최신 = 아래 "이 세션 결과" 마지막 커밋** · 작업트리 클린 · **Flyway V21 까지 → 다음 V22**
>
> #### 이 세션 결과 (전부 배포)
> 1. **UI/UX 로드맵 U0~U7 완주** — 마케터 **Cockpit**(잉크 LNB·밀도 토글·스티키 필터바·성과 강조) / 공개 화면 **Daylight**(따뜻한 종이·페리윙클·큰 탭 타깃, 라이트 고정) / 광고주 포털 **Task-First**(할 일 큐·모바일)
> 2. **전역 접속 차단 신규**(V20) + **차단 시도 로그**(V21)
> 3. **결함 5건 수정** — 상세는 각 항목 참고
>    - 🔒 **XFF 위조**(보안) — 방문자가 헤더 한 줄로 IP 위조 가능 → IP차단·중복방지·통계 전부 우회 가능했다
>    - 🐞 **배포마다 전원 로그아웃** — 세션 복원 실패 시 이유를 안 가리고 토큰 삭제
>    - 🐞 **오류가 `404` 로 노출** — HTTP/2 엔 reason phrase 없음
>    - 🐞 **U4 회귀 2건** — 광고주 상단바(클래스 유실) · 인박스 셸 폭(비면 254px)
> 4. **[GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) 신설** — 오픈 전 점검을 A(지금 검증)/B(직전 실행)로 분리
>
> #### 이 세션의 교훈 (다음 사람이 같은 데 빠지지 않게)
> - **공용 클래스·레이아웃 규칙을 바꾸면 사용처를 전수 조사(grep)한다.** LNB 전환 후 마케터 화면만 보고 넘어가 회귀 2건이 실사용자에게 노출됐다.
> - **데이터가 빈 상태까지 확인한다.** 인박스 셸 폭 문제는 리드가 있을 때는 보이지 않았다.
> - **검증하다 발견한 것이 대부분이다.** 5건 중 4건이 다른 작업을 확인하던 중에 나왔다 — 배포 후 실제로 눌러보는 과정을 건너뛰면 안 된다.
>
> #### 🆕 다음 작업으로 확정 — **템플릿 기반 자동 발송(문자·메일·알림톡)**
> 정본 계획 = **[MESSAGING-PLAN.md](MESSAGING-PLAN.md)** (2026-08-01 신설, 사용자와 결정사항 확정). **2026-08-02 착수 예정** — 착수 전 그 문서 §5(먼저 고쳐야 하는 기존 구조)와 §7(열린 질문) 먼저 확인.
> - 핵심: 리드폼 항목값을 변수로 끼운 메시지를 **리드 본인·마케터·광고주**에게 자동 발송. 수신 번호도 리드 항목에서 뽑는다.
> - 1단계 = **문자·메일**(알림톡은 사용자가 카카오 심사 접수 예정).
> - ⚠️ **전제 작업(M1)**: `FormBlock.id` 가 리드폼 저장 시마다 재생성되고(`orphanRemoval` + `toEntity()` 가 id 미전달), 리드 답변은 `label` 로만 저장된다 → **항목에 불변 `var_key` 를 부여하고 answers 에도 기록**해야 한다. 이걸 먼저 하지 않으면 템플릿이 리드폼 수정 한 번에 전부 깨진다.
> - 다음 Flyway = **V22**.
>
> #### 다음 작업 (우선순위)
> 1. **[GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) A 항목 검증 시작** — 특히 🔴 **개발/운영 DB 분리**와 🔴 **오리진 방화벽(Cloudflare 대역 제한)**. 사용자가 "실배포까지 시간 있으니 지금부터 검증" 방침.
> 2. **광고주 포털 실화면 확인**(사용자) — 자격증명이 없어 포털 내부를 못 봤다.
> 3. **차단 로그 실동작 확인** — V21 배포 후 실제로 로그가 쌓이는지(예약 IP 로 시험할 것).
> 4. 카카오 알림톡·SMS = **추후 적용 결정**. 사전조사는 [BACKLOG.md](BACKLOG.md) H3 에 정리해 뒀다(사업자·템플릿 심사가 관문, 비용은 월 1,000건에 약 8,000원).
>
> #### ⚙️ 이어받을 때
> - **로컬 실행**: JDK21 + `backend/application-local.properties`(Neon 접속정보, gitignore·PC마다 별도) 필요. `cd backend; $env:SPRING_PROFILES_ACTIVE='local'; .\gradlew.bat bootRun` / `cd frontend; npm run dev`
> - ⚠️ **로컬 백엔드는 운영 DB(Neon 공유)를 건드린다** — 위 DB 분리 전까지 주의.
> - PowerShell here-string 커밋 메시지에 **따옴표(" ')를 넣으면 파싱이 깨진다**(이 세션에서 두 번 걸림).
> - CSS 주석에 `*/` 가 들어가면(`.topbar-*/.nav-link` 같은 표기) 주석이 조기 종료돼 빌드가 깨진다.

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
> #### ✅ 2026-08-01 세션 — **U4 내비게이션: 좌측 사이드바(LNB) 전환** (`8121f5f`·`6a1329c`, 배포 success)
>
> **결정 경위**: 처음엔 "상단바 유지 + 그룹핑"으로 정해 상단 드롭다운(`e934285`)까지 배포했는데, 실제로 보고 **LNB 로 전환**하기로 바꿨다(사용자). 드롭다운은 열어봐야 안이 보이고, LNB 는 전부 펼쳐놓고 섹션으로 위계를 준다.
>
> - **구성**: (대시보드·리드) / **제작**(리드폼·랜딩·요소·동의 문서) / **운영**(광고주·통계·연동). 하위 항목 한 줄 설명은 **존댓말 통일**(만듭니다·관리합니다·연결합니다 — 사용자 지시).
> - 계정(이메일·테마·로그아웃) = 사이드바 하단 메뉴 하나. 좁은 화면(≤900px) = 상단 바 + 드로어. 로그인 등 내비 없는 화면엔 사이드바 없음(`data-has-nav`).
> - **페이지는 손대지 않았다** — `TopBar` 컴포넌트만 교체하고 `.app-shell` 을 `:has()` 로 가로 배치. 라우팅·URL 그대로.
> - **🐞 인박스 4단 문제(예고했던 것)가 실제로 발생**: LNB 224 + rail 236 + 행 최소폭 524 + 패널 400 = **1384px** 필요 → 1265px 화면에서 **가로 119px 넘침**. 행이 최소폭 아래로 안 줄어 목록이 버틴 것. → **1400px 미만에서 rail 184 · 패널 344 · 행 최소 열 폭 축소**로 해소(`6a1329c`).
> - **실앱 검증**: LNB 224px · `.app-shell` flex-direction `row` · main 시작 x=224(겹침 없음) · 섹션 2개(제작·운영) · 링크 9개 전부 노출 · 설명 존댓말 확인 · 가로 넘침 0.
> - **섹션 접기/펼치기 추가**(`93822fe`, 사용자 요청 — 상단 내비의 드롭다운처럼): 섹션 제목이 토글이 되고 캐럿으로 상태 표시. **지금 보고 있는 페이지가 든 섹션은 강제로 열린다**(저장값이 접힘이어도). 펼침 상태는 `localStorage`(`lp.lnb.sections`)에 기억 — 없으면 페이지를 옮길 때마다 다시 접혀 성가시다. 제목 없는 섹션(대시보드·리드)은 항상 노출.
>   - 검증: 초기 둘 다 접힘(대시보드·리드만 노출) → '제작' 클릭 시 4개 노출·저장됨 → **저장값을 둘 다 false 로 강제하고 `/advertisers` 새로고침 시 제작은 접힘·운영만 열림**(강제 열림 동작 확인).
> - **남은 U4 조각**: `/advertisers` 행 액션 **8개**(권한·정보·활동이력·리포트·미리보기·비번재설정·정지·삭제) → 주요 2개 + `⋯` 더보기.
>
> ---
>
> ## ⏸ 2026-08-01 세션 마감 (gooinsung PC) — 이어받는 사람은 여기부터
>
> **`main` 최신 = `6a1329c`** · 작업트리 클린 · **프론트 자동배포 success** · **백엔드 변경 없음**(다음 Flyway 여전히 **V20**).
>
> **이 세션에서 한 일** (전부 배포·실앱 검증 완료)
> 1. U1~U3 실앱 검증 + 버그 2건 수정(연락처 마스킹 · 375px 넘침)
> 2. HTML 블록 **`<script>` 실행 지원** + 타이머·리스너 정리
> 3. HTML 블록 **CSS 자동 격리**(전역 리셋이 화면 깨뜨리던 문제)
> 4. 기기 미리보기 **iframe 전환**(미리보기 ≠ 실제 화면 문제)
> 5. U4 **LNB 전환**
>
> **✅ U4 완료** (`65c0d86`, 배포 success) — 마지막 조각인 **행 액션 더보기**까지 끝. `/advertisers` 한 행의 버튼 8개 → **`리드폼 권한` · `리포트` · `⋯`**. 나머지는 메뉴로, **계정 정지·삭제는 구분선 아래 빨간색**으로 분리.
> - 공용 **[`components/RowMenu.tsx`](../frontend/src/components/RowMenu.tsx)** 신설 — 다른 목록에도 끼우면 된다(아직 적용 안 함).
> - ⚠️ **함정**: 표를 감싼 `.card-table` 이 `overflow: hidden` 이라 행 안에서 드롭다운을 그리면 **잘린다** → `document.body` 포털 + `position: fixed` 로 띄우고 버튼 좌표에 맞춘다. 화면 아래로 넘치면 위로 뒤집고, 바깥 클릭·ESC·스크롤·리사이즈에 닫힌다.
> - 검증(실앱): 메뉴 부모 `BODY` · 6항목 · 위험 2개 분리 · 뷰포트 안에 완전히 들어옴 · `elementFromPoint` 로 **잘리지 않고 실제로 보이는지** 확인 · ESC 닫힘 · 항목 클릭 시 메뉴 닫히고 모달 열림 · 가로 넘침 0.
>
> **✅ U5 완료** (`9135333`·`5014214`·`4628f01`·`fc8889b`, 배포 success) — 상세 = [UIUX-PLAN.md](UIUX-PLAN.md) §U5
> - **토스트 신설**: **성공 피드백이 아예 없던 것**이 가장 큰 구멍이었다. [`lib/toast.ts`](../frontend/src/lib/toast.ts)는 **컨텍스트가 아니라 모듈 수준 저장소** — 편집 화면이 저장 후 목록으로 이동하므로 라우트가 바뀌어도 살아남아야 한다. 브라우저 기본 `alert()` 3곳도 교체.
> - **인박스 빈 화면**: 리드가 없는 건지 필터에 걸린 건지 구분 안 되던 것 → 전체 0건이면 리드폼 버튼, 필터 0건이면 **필터 초기화** 버튼.
> - **삭제 피드백·에러 처리**: 삭제는 성공해도 무반응이고 **실패해도 조용히 넘어갔다**(에러 처리 자체가 없었음) → try/catch + 토스트.
> - **로딩 일원화**: 세 갈래·정적 글자 → [`components/Loading.tsx`](../frontend/src/components/Loading.tsx) + 회전 표시, 25개 파일 교체.
> - **정정한 판단**: 착수 전엔 "빈 화면에 다음 행동 버튼이 없다"고 봤으나 **목록 화면들은 이미 갖추고 있었다**(grep 결과만 보고 성급히 판단 → 코드 확인 후 정정). 그래서 범위가 예고보다 작아졌다.
> - **손대지 않은 것**: `auth-error`(26개 파일 공유)는 이미 일관돼 이름만 어색할 뿐 → 전면 리네임은 위험 대비 이득 없음.
> - 🐞 검증 중 발견·수정(`fc8889b`): 필터 초기화가 검색어만 비우고 **입력칸 표시는 남겨** 아직 걸린 것처럼 보이던 문제.
> - **실앱 검증**: 토스트(표시→라우트 넘어 생존→3초 자동 사라짐, 검증용 요소 생성·삭제로 확인) · 인박스 빈 화면 문구·버튼 · 필터 초기화 후 검색창 비움·14건 복귀 · 스피너 CSS(`animation-name: spin`) 배포 확인.
>
> **✅ U7 완료 — Cockpit 적용(마케터 화면)** (`5ae4a93`·`43f1794`·`b7cfeb0`·`9166e67`, 배포 success) — 상세 = [UIUX-PLAN.md](UIUX-PLAN.md) §U7
> - 사용자 확정: **Cockpit** · 마케터 먼저 · LNB 유지 · **색 유지** · 톤은 **밀도·성과**.
> - **잉크 사이드바**(`--lnb-*` 토큰) · **행 밀도 토큰 + 촘촘/넉넉 토글** · **스티키 필터바** · **KPI 성과 강조** · **그린은 성과에만**.
> - 🐞 잉크 배경 전환 후 **섹션 제목 대비 4.03:1** 미달 발견·수정(라이트 5.81 / 다크 6.41). **밝은 배경에서 괜찮던 색이 어두운 패널에서 깨진다** — 패널 색을 바꿀 땐 그 위 글자 대비를 반드시 다시 잰다.
> - **인박스 후속**(사용자 요청): 상세를 **겹치는 서랍**으로 바꿔 목록이 늘 풀폭(실측 857px, 오른쪽 끝 = 뷰포트 끝) · **답변 요약 열 + 열 제목 줄** 추가 · **기본 보기 전체**.
> - **공개 화면(공개 폼·랜딩·스텝폼)에는 Cockpit 미적용** — "마케터 먼저" 결정 + 모바일 퍼스트 원칙이 걸려 별도 판단 필요.
>
> ✅ **공개 화면 = Daylight 적용**(`ff03af7`, 배포 success) — 상세 = [UIUX-PLAN.md](UIUX-PLAN.md) §공개 화면
> - **관리=Cockpit / 공개=Daylight 로 톤 분리**(사용자 승인). 종이 배경 `#FAF6F0` · 따뜻한 잉크 · 페리윙클 액센트 `#5B63D6` · 큰 탭 타깃(버튼 54px) · 여백 확대.
> - **공개 화면 라이트 고정**: 랜딩 HTML 블록에 붙는 사용자·AI 코드가 흰 배경·검은 글자를 전제하므로 다크에서 글자가 사라지는 사고를 막는다.
> - **공개 루트 안에서 표준 토큰 자체를 재정의** — 배경만 바꾸면 다크에서 흰 배경에 흰 글자가 된다(작업 중 실제로 만들었다가 고침). 이렇게 하면 기존 컴포넌트가 손대지 않아도 따라온다.
> - CTA·완료는 초록 유지(Daylight 그린). 전환에 직접 닿아 색 계열은 안 바꿈.
> - 검증(`/f/1`, 로그인 불필요): 토큰·radius·버튼 높이 일치 · **`data-theme="dark"` 에서도 라이트 유지, 대비 5.26:1**.
>
> ✅ **U6 광고주 포털 완료**(`ed4bd3a`, 배포 success) — 상세 = [UIUX-PLAN.md](UIUX-PLAN.md) §U6
> - **🐞 U4 회귀를 여기서 발견**: LNB 전환 때 지운 `.topbar-left`·`.topbar-nav`·`.nav-link` 를 **광고주 상단바가 아직 쓰고 있어 운영에서 내비가 스타일 없이 렌더되고 있었다**(U4 검증을 마케터 화면만 한 탓). 전용 `adv-*` 클래스로 완전 분리. **공용 클래스를 지울 땐 사용처를 전수 조사할 것.**
> - **Task-First 홈**: KPI 를 **누르면 그 목록으로 가는 할 일 큐**로(미확인·오늘·전체). 미확인이 남으면 앰버 강조, 누르면 다른 조건은 지운다.
> - **모바일**: 알약 탭 내비 · 필터 세로 스택(16px 입력) · 큐 2열(미확인 한 줄) · 전화 버튼 48px(`.call-btn` 클래스가 CSS 엔 있는데 JSX 에 안 붙어 죽어 있던 것도 수정).
> - **화이트라벨 존중** — 구조만 Daylight, 색은 마케터 브랜드.
> - ⚠️ **검증 한계**: 광고주 자격증명이 없어 **포털 내부 화면은 실제로 못 봤다.** `/client/login` 상단바 + 배포된 CSS 프로브 실측까지만. **실데이터 화면은 사용자 확인 필요.**
>
> **🎉 UI/UX 로드맵(U0~U7) 전부 완료** — 마케터 Cockpit · 공개 화면 Daylight · 광고주 포털 Task-First.
>
> #### ✅ 2026-08-01 세션 — **전역 접속 차단** (`1cd5c11`) + 인박스 후속
>
> **🆕 계정 전역 접속 차단**(사용자 요청) — 등록한 IP·대역이 **내 랜딩·공개 리드폼에 접속 자체를 못 하게** 한다.
> - 기존 IP 차단(K2)은 **리드폼별 '제출' 차단**이라 목적이 달라 **건드리지 않고 분리**했다.
>   · `ip_blocks` = 특정 리드폼에 제출 차단 / `site_ip_blocks` = 계정 공개 화면 접속 차단(신규)
> - **Flyway V20** 신설 → **다음은 V21**. `IpMatcher` 재사용.
> - **차단 지점 3곳**: 공개 랜딩 GET(서브도메인) · 공개 리드폼 GET · **리드 제출**
>   (외부 사이트 임베드는 우리 랜딩을 거치지 않으므로 제출 경로에서도 막아야 실제로 차단된다)
> - **설계 판단**: ① 차단 시 **404** — 비공개 랜딩과 같이 존재조차 알리지 않는다 ② **IP 를 모르면 막지 않는다**(정상 방문자 오탐 방지)
> - 화면 `/site-ip-blocks` + LNB 운영 섹션 '접속 차단'. 리드폼별 제출 차단과 헷갈리지 않게 화면에 차이를 적어 뒀다.
> - `SiteIpBlockTest` 6개(단일·CIDR 매칭 / 계정 격리 / IP 미상 통과 / 랜딩 404 / 리드폼 404 / 남의 규칙 삭제 불가) + **백엔드 전체 통과**.
>
> **🐞 U4 회귀 2건을 오늘 더 찾았다** — 둘 다 LNB 전환 때 마케터 화면만 검증한 탓.
> 1. **광고주 상단바**(위 U6 참고) — 지운 클래스를 계속 쓰고 있었다.
> 2. **인박스 셸 폭**(`65f1eac`) — `.app-shell` 을 가로 배치하며 `> main` 에만 `flex:1` 을 줬는데 인박스는 `div.inbox-shell` 이라 규칙에서 빠졌다. 리드가 많을 땐 내용이 넓어 티가 안 나다가 **목록이 비면 254px 로 쭈그러들어** 드러났다(사용자 제보). → 내비를 뺀 모든 본문이 남는 폭을 채우도록 일반화.
> - **교훈**: 공용 클래스·레이아웃 규칙을 바꿀 땐 **사용처를 전수 조사(grep)하고, 데이터가 빈 상태까지** 확인한다.
> - 함께: 인박스 빈 화면이 목록 자리를 채우도록(46vh 세로 중앙) · rail 보기 순서 **전체 → 오늘 → 미확인**.
>
> #### ✅ 전역 접속 차단 실동작 검증 + 그 과정에서 찾은 결함 3건
>
> **접속 차단 동작 확인**(예약 IP `203.0.113.5` 사용 — 실사용자를 막지 않기 위해): 추가·목록·삭제·토스트 정상 / **차단 IP → 랜딩·리드폼 모두 404** / 다른 IP → 200. 검증용 규칙은 삭제 완료.
>
> **🔒 보안: X-Forwarded-For 위조**(`8928b84`) — 차단을 시험하려고 `curl -H "X-Forwarded-For: ..."` 를 보냈더니 **서버가 그대로 믿었다.** Cloudflare 는 들어온 XFF 를 지우지 않고 뒤에 덧붙이는데 우리는 **첫 값**을 썼기 때문. 방문자가 헤더 한 줄로 자기 IP 를 위조할 수 있었다.
> - 영향: 전역 접속 차단 · 리드폼별 IP 차단(K2) 우회 / 중복 제출 방지(K3) 동일 IP 제한 우회 / 순방문·요소 클릭 통계 조작
> - 수정: **`CF-Connecting-IP` 최우선**(Cloudflare 가 항상 덮어써 위조 불가). 리드 제출·방문·이벤트 컨트롤러에 **같은 취약 로직이 복제**돼 있던 것도 공용 `ClientIp` 로 통일.
> - 검증: 수정 전 위조 시 404(차단됨) → **수정 후 200**(XFF 무시).
> - ⚠️ **남은 위험(인프라)**: Cloudflare 를 우회해 오리진 IP 로 직접 붙으면 이 헤더가 없다. **오리진 방화벽을 Cloudflare 대역으로 제한**해야 근본 차단된다 → 아래 오픈 전 항목.
>
> **🐞 배포할 때마다 전원 로그아웃**(`749e73c`) — 세션 복원 실패 시 이유를 안 가리고 토큰을 지우고 있었다(`getMe().catch(() => clearTokens())`). 백엔드 재배포 2~4분 동안 접속한 사람은 전부 튕겼다. → 401/403 일 때만 로그아웃, 그 외엔 토큰 유지 + 2회 재시도, `ProtectedRoute` 는 로그인 화면 대신 '다시 시도' 화면.
>
> **🐞 오류가 상태코드로 노출**(`6948855`) — 서버 메시지가 없으면 `status + statusText` 를 썼는데 HTTP/2 엔 reason phrase 가 없어 화면에 `404` 만 떴다. → 상태코드별 한국어 문구(전 화면 공통).
>
> **✅ 미검증 화면 훑기 완료** — 통계 · 연동 · 폼별 IP차단 · 리드폼 편집 · 동의문서 목록/편집 · 접속 차단: **전부 가로 넘침 0, 넘치는 요소 0, 에러 0**. LNB 옆 본문 폭도 정상(1041~1056px).
>
> **👉 다음 작업**
> 1. **광고주 포털 실화면 확인**(사용자) — U6 검증 한계 참고. 광고주 계정으로 로그인해 할 일 큐·모바일을 눈으로 볼 것.
> 2. ✅ **접속 차단 로그 완료**(`2aebe20`) — Flyway **V21** `site_ip_block_hits`. 시각·IP·**걸린 규칙**·시도한 곳(랜딩 열람/리드폼 열람/리드 제출)·UA 를 남기고 화면에 표로 보여준다. 최근 500건, 비우기 가능.
>    - `recordHit` 은 **REQUIRES_NEW** — 리드 제출은 차단 시 트랜잭션이 롤백되므로 별도 트랜잭션이어야 로그가 남는다. 로그 실패가 차단을 막지 않도록 예외는 삼킨다.
>    - 테스트 3개 추가(총 9개): 차단 시 로그(규칙·UA·source) / 허용 시 로그 없음 / 계정별 분리·비우기.
>    - **다음 Flyway 는 V22.**
> 3. (선택) `RowMenu` 를 다른 목록(리드폼·랜딩·동의문서·요소·IP차단)에도 적용.
>
> ✅ **인박스 기간 필터 추가**(`d551f4c`) — 사용자가 기간만 요청(태그는 안 함). 백엔드 `getInbox` 가 이미 `from/to` 를 받아 **프론트만 추가, 백엔드 변경 없음**. 날짜를 고르면 보기를 '오늘'에서 '전체'로 넘긴다(둘이 겹치면 어느 조건 때문에 걸러졌는지 알 수 없다). 필터 초기화에도 포함.
> - 검증: 기간 칸 2개 · '오늘'(0건)에서 날짜 선택 → 자동 '전체'(14건) 전환 · 과거 구간(2020) → 0건 + 빈 화면 안내 · 초기화 시 날짜 칸 비워지고 14건 복귀.
>
> **⏳ 사용자가 "일단 빼자"고 한 것(나중에 필요해짐)**
> - **HTML 블록 id·`@keyframes` 충돌 방지**: CSS 는 블록별로 격리됐지만 **JS 는 같은 문서를 공유**한다. 같은 id 를 두 블록에 쓰면 `document.getElementById` 가 문서 전체에서 먼저 나온 것을 집어 서로의 요소를 갱신한다. `@keyframes` 이름도 전역. → 지금 규칙 = **클래스는 겹쳐도 되지만 id·애니메이션 이름은 블록마다 다르게**. 해결안 = 스크립트를 함수로 감싸 `document` 를 블록 전용 프록시로 교체(대가: 최상위 `return` 같은 특이 코드가 문법 오류, `onclick="fn()"` 처럼 전역 함수를 쓰는 코드가 깨질 수 있어 **실제 충돌 시에만 이름을 바꾸는 방식**을 검토 중이었다).
>
> **🚧 오픈 전 점검 → 정본은 [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md)** (2026-08-01 신설)
> A(지금부터 검증)와 B(오픈 직전 실행)로 나눠 정리했다. 아래 목록은 요약이며 **체크는 그 문서에서** 한다.
> - **🔒 오리진 방화벽을 Cloudflare 대역으로 제한** — 지금은 오리진 IP(`129.225.198.2`)에 직접 붙을 수 있고, 그러면 `CF-Connecting-IP` 가 없어 위조 가능한 XFF 로 되돌아간다(IP 차단·중복방지·통계에 영향). VM iptables 또는 Nginx 에서 Cloudflare IP 대역만 허용할 것.
> - **개발/운영 DB 분리** — 지금은 로컬에서 서버만 켜도 실데이터가 바뀐다(Neon 1대 공유). **사용자가 "DB 싹 갈아도 된다"고 했으므로**(2026-08-01) 새로 만들 때 Neon 브랜치로 분리하면 된다.
> - Neon 백업·복구 설정 확인 / 비밀번호 변경 시 리프레시 토큰 무효화(`token_version`)
>
> **⚠️ 이 세션에서 알아낸 함정 (다음 사람이 같은 데 빠지지 않게)**
> - **iframe 안에서 DOM 을 다루는 코드**: iframe 은 문서·`window`·**CSSOM 클래스가 전부 다른 객체**다. 전역 `document` 로 만든 script 는 엉뚱한 문서에 붙고 `rule instanceof CSSStyleRule` 판정도 실패한다. 항상 `host.ownerDocument` / 그 창 기준으로.
> - **미리보기 = 실제 화면이 아니다**: 박스만 좁히면 `@media` 는 브라우저 창 폭을 본다. 기기 미리보기는 iframe 이어야 맞다.
> - **브라우저 패널이 표시되지 않으면** 좌표 클릭이 페이지에 전달되지 않고 **CSS 애니메이션도 진행되지 않는다**(첫 프레임에 멈춤). 검증은 `read_page`·`get_page_text`·DOM 이벤트 디스패치·fetch 인터셉트로 했다.
> - PowerShell here-string 커밋 메시지에 **큰따옴표를 넣으면 파싱이 깨진다**.
>
> ---
>
> #### 👉 (이전 기록) 이어받는 사람은 여기부터 (다음에 할 일, 우선순위 순)
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
