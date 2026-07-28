# docs/PROGRESS.md — 이어서 작업하는 지점 (RESUME HERE)

> **이 파일만 보면 "어디서부터 이어서 하면 되는지" 알 수 있다.**
> 규칙: 작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 **이 파일을 갱신하고 커밋**한다. (CLAUDE.md의 진행 기록 규칙 참고)
> 상세 로드맵은 [ROADMAP.md](ROADMAP.md).

---

## 📍 지금 위치

- **✅ 서브도메인 관리(D3) 검증 완료 (2026-07-24, gooinsung PC)**: 백엔드 빌드+테스트 통과 / API 스모크 전부 통과 / 브라우저에서 `{sub}.localhost:5173/{id}` 공개 렌더·루트 404 확인. 브랜치 `feature/d3-subdomain`(코드 커밋 ce10518).
  - **DB = Neon(무료 호스팅 Postgres)로 전환** — "모든 환경 공유 DB 한 대". 접속정보는 `backend/application-local.properties`(**gitignore됨·커밋금지**)에 저장, profile `local`로 기동. Flyway V1~V10 Neon에 적용됨(리전 ap-southeast-1).
  - **⚙️ 이 PC 환경 세팅(gooinsung PC = `C:\Users\gooinsung\git\Leadpot`)**: JDK21(`C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`, winget) 설치, `npm install` 완료. Docker/WSL은 미설치(Neon 쓰므로 불필요).
  - **❗ 로컬 실행 필수 플래그**: 이 PC는 기본 임시폴더 경로가 길어 JDK21 NIO의 AF_UNIX self-pipe가 실패("Unable to establish loopback connection") → **사용자 환경변수 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\Temp` 설정으로 해결**(설정 완료). 새 셸부터 자동 적용. (Java NIO 서버 전반에 필요)
  - **▶️ 로컬 실행법(현재)**: `C:\Temp` 존재 + 위 env 적용 상태에서 — 백엔드 `cd backend; $env:SPRING_PROFILES_ACTIVE='local'; .\gradlew.bat bootRun` (→ :8080, Neon 연결) / 프론트 `cd frontend; npm run dev` (→ :5173). 서브도메인 테스트는 `http://{내서브도메인}.localhost:5173/{랜딩번호}`.
  - **✅ D3 `main` 병합 완료**(현재 main에 `auth/Subdomains.java`·`PublicSiteController` 포함). 남은 것: SPEC·FEATURES 문서에 D3 반영 / 배포용 와일드카드 DNS·SSL(사용자 리소스, 나중).
- **현재 위치**: **핵심 루프(폼 공개→제출→리드 수집→조회) 완성 ✅** — 실제 데이터가 쌓임(방문자정보 포함) + **통계 대시보드 ✅**
- **완료**: Phase 1 인증 ✅ / Phase 2 폼 빌더 ✅ / **리드 수집(Phase 4 앞당김) ✅** / **Phase 3 랜딩 빌더 & 폼 연결 ✅** / **리드 상태변경·CSV 내보내기 ✅** / **이미지 업로드 R2 연동(경로 구조화 landing-image/YYYY/MM/DD) ✅** / **통계 고도화(방문 추적+전환율+순방문·트래픽 분리+일/주/월+호버툴팁+기간/대상 필터+랜딩/폼별) ✅** / **동의문서 이름/제목/내용 분리 ✅** / **IP 차단(K2) — 리드폼별·CIDR·사유·차단 로그 ✅**
- **추가 폼 개선(2026-07-24)**: 공개 폼 이름 숨김 · 동의 항목 기본체크 설정 · 공개 폼 모바일 최적화(1차) · **스텝형 답변 방식 확장**(카드 단일/다중 + 선택박스·텍스트·장문·연락처·이메일·숫자·날짜) · **마지막 단계 커스텀 안내문구**(typeConfig.contactMessage) · 스텝 입력형 간격 개선 · **중복 제출 방지(K3)**: 항목별 중복허용/유효기간 + 폼 동일IP 접수허용(settings_config, Flyway V6)

## 👉 다음에 할 일 (이어받는 세션은 여기부터)

> ### ⭐ 지금 순서 (사용자 확정 2026-07-27)
> **1) 배포 = ✅ 완료(2026-07-28)** → **2) 다음 작업 = 광고주 페이지 + 관리자 페이지(멀티포털)**.
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
