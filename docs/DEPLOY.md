# docs/DEPLOY.md — Leadpot 배포 체크리스트

> 아키텍처: **프론트=Cloudflare Pages** / **백엔드=Oracle Cloud VM(Docker)** / **DB=PostgreSQL**.
> 상세 배경은 [CLAUDE.md](../CLAUDE.md) §3(아키텍처)·§6(배포법) 참고. 이 문서는 실제 배포 시 순서대로 체크한다.
> 코드/설정은 **환경변수로 시크릿을 주입**하도록 이미 외부화돼 있음(코드·깃에 시크릿 없음).

---

## 0. 준비물 (사용자 계정/리소스)

- [ ] **도메인** 1개 (예: `lead-pot.com`) — 없으면 서브도메인(D3)·커스텀 도메인(D2)은 보류하고 Pages 기본 도메인으로 먼저 시작 가능.
- [ ] **Cloudflare 계정** (무료) — DNS + Pages.
- [ ] **Oracle Cloud "Always Free" VM** (또는 다른 VPS) — Docker 실행.
- [ ] **DB 결정**: 현재 개발은 **Neon(공유 Postgres)** 사용 중. 운영도 Neon을 쓸지, VM 안 Postgres 컨테이너로 옮길지 결정.
- [ ] (선택) **Cloudflare R2** — 이미지 업로드를 디스크 대신 R2로 쓸 경우.

---

## 1. 백엔드 (Oracle VM, Docker)

### 1-1. 서버 기본
- [ ] VM에 Docker + Docker Compose 설치.
- [ ] 저장소 clone → 백엔드는 `docker compose up -d --build` 또는 `backend/Dockerfile` 로 이미지 빌드/기동.
- [ ] **아웃바운드 443 허용 확인** ⚠️ 신규: 리드 알림이 `api.telegram.org`·`script.google.com`(구글시트 웹훅)로 **외부 HTTPS 요청**을 보낸다. VM 방화벽/보안목록에서 egress 443이 열려 있어야 알림이 나간다. (인바운드는 8080만 Nginx 경유)

### 1-2. 환경변수 (운영에서 반드시 주입)
- [ ] `APP_JWT_SECRET` — **32바이트 이상 강한 랜덤값**. (기본값은 개발용이므로 반드시 교체)
- [ ] `APP_CORS_ALLOWED_ORIGINS` — 프론트 오리진. 예: `https://app.lead-pot.com`
      - 서브도메인(D3) 공개 페이지를 쓰면 와일드카드 패턴도 추가: `https://app.lead-pot.com,https://*.lead-pot.com`
      - (SecurityConfig 는 `allowedOriginPatterns` 사용 → 와일드카드 지원. `/api/public/**` 는 이미 모든 오리진 허용=임베드용)
- [ ] `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
      - Neon 사용 시 URL에 **SSL 필수**: `jdbc:postgresql://<host>/<db>?sslmode=require`
- [ ] `APP_UPLOADS_DIR` — 컨테이너 내 경로(볼륨 마운트). 예: `/app/uploads` (docker-compose 에 볼륨 정의됨)
- [ ] (R2 사용 시) `APP_STORAGE_TYPE=r2` + `APP_STORAGE_R2_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/PUBLIC_BASE_URL`
- [ ] (선택) `APP_JWT_ACCESS_TTL` / `APP_JWT_REFRESH_TTL`

> ⚠️ 시크릿은 `.env`(gitignore) 또는 배포 플랫폼 환경변수로만. **절대 커밋 금지.**

### 1-3. Flyway / DB
- [ ] 백엔드 기동 시 Flyway 가 마이그레이션을 자동 적용(`ddl-auto=validate`). **현재 최신 = V16**.
- [ ] 운영 DB가 개발과 **다른 DB면** V1~V16 이 처음 적용된다(빈 DB에서 자동). Neon 공유를 그대로 쓰면 이미 V16 적용됨.

### 1-4. Nginx 리버스 프록시 + SSL
- [ ] VM에 Nginx 설치 → `api.도메인` → `localhost:8080` 프록시.
- [ ] `X-Forwarded-For` 전달(리드 IP/차단·통계 정확도). `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- [ ] Cloudflare 에서 `api.도메인` A레코드 → VM 공인 IP, **프록시 ON** → 무료 SSL.

---

## 2. 프론트엔드 (Cloudflare Pages)

- [ ] Pages 프로젝트를 GitHub `main` 에 연결(자동 빌드/배포).
- [ ] 빌드 설정: **루트 디렉터리** `frontend`, **빌드 명령** `npm run build`, **출력** `dist`.
- [ ] 환경변수 `VITE_API_BASE_URL` = `https://api.도메인`.
- [x] **SPA 폴백** `frontend/public/_redirects` 추가됨(`/*  /index.html  200`) — 딥링크·서브도메인 라우팅 404 방지. (`embed.js` 등 실제 파일은 우선 서빙되어 임베드 정상)
- [ ] 배포 후 `embed.js` 접근 확인: `https://app.도메인/embed.js` 200.

---

## 3. DNS / 도메인

- [ ] `api.도메인` → VM (A레코드, 프록시 ON).
- [ ] `app.도메인`(또는 apex) → Cloudflare Pages 커스텀 도메인 연결.
- [ ] (D3 서브도메인 쓸 때) **와일드카드** `*.도메인` → Pages + **와일드카드 SSL**. 이게 있어야 `{sub}.도메인/{landingId}` 공개 페이지가 열림. 준비 전엔 서브도메인 기능은 보류.

---

## 4. 배포 후 스모크 테스트

- [ ] `https://api.도메인/api/health` → `{"status":"UP"}`
- [ ] Pages 사이트 접속 → 로그인/가입 → 대시보드.
- [ ] 리드폼 생성 → 공개 URL `/f/{id}` **새로고침해도 404 안 남**(=_redirects 동작) → 제출 → 리드 목록에 표시.
- [ ] 리드 상세/메모/태그 동작.
- [ ] **연동**: `/integrations` 에서 텔레그램/구글시트 저장 → **테스트 발송** 성공 → 실제 리드 제출 시 알림 도착.
- [ ] CORS: 브라우저 콘솔에 CORS 에러 없는지(프론트→api 호출).

---

## 5. 신규 기능(리드 고도화·연동) 관련 배포 유의사항

- **아웃바운드 egress**(§1-1): 알림 발송에 외부 HTTPS 필요. Oracle VM 보안목록 egress 443 확인.
- **연동 토큰 저장**: 텔레그램 봇 토큰·시트 웹훅 URL 은 사용자별 `integration_settings` 테이블에 저장(사용자 본인 리소스). DB 접근 보호 = DB 자격증명·네트워크로 통제.
- **알림 실패는 무해**: 발송은 커밋 후 비동기 best-effort 라 실패해도 리드 접수·응답에 영향 없음(로그만 남음). 배포 직후 알림이 안 와도 리드 수집 자체는 정상.

---

## 부록 A. Oracle Always Free + Neon 실전 절차 (이 프로젝트 기준)

> 결정(2026-07-27): 백엔드=**Oracle Always Free VM**(상시 켜짐 — 실광고 트래픽 테스트), DB=**Neon 유지**, 프론트=**Cloudflare Pages**. 준비 파일: [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`deploy/nginx-leadpot-api.conf`](../deploy/nginx-leadpot-api.conf).

### A-1. VM 만들기
- [ ] Oracle Cloud 가입(카드로 본인확인, Always Free 안이면 청구 없음). **홈 리전 = 한국(ap-chuncheon-1 또는 ap-seoul-1)** 권장.
- [ ] Compute → Instance 생성. **Shape = Ampere ARM(VM.Standard.A1.Flex)** 권장(무료 한도 4 OCPU/24GB 중 1 OCPU/6GB 정도면 충분). 이미지=Ubuntu 22.04/24.04.
      - ⚠️ ARM 무료 물량이 "out of capacity" 로 막히면: 다른 가용 도메인/리전 재시도, 또는 AMD 무료(VM.Standard.E2.1.Micro, 1GB)로 대체(메모리 빠듯 — JVM `-XX:MaxRAMPercentage=75` 권장).
- [ ] SSH 공개키 등록(접속용). 생성 후 **공인 IP** 확인.
- [ ] **네트워킹**: VCN 보안 목록(또는 NSG)에서 **인그레스 80, 443 허용**. (8080 은 열지 않음 — Nginx 뒤에만 둠) + 아웃바운드 443 허용(텔레그램/시트 알림).
      - 우분투 자체 방화벽(iptables) 때문에 막힐 수 있음 → 필요 시 `sudo iptables` 규칙 또는 netfilter-persistent 조정.

### A-2. 서버 세팅(SSH 접속 후)
```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # 재로그인 후 sudo 없이 docker 사용

# 저장소 clone
git clone https://github.com/gooinsung/Leadpot.git
cd Leadpot

# 시크릿 .env 작성 (docker-compose.prod.yml 과 같은 폴더 = 저장소 루트)
nano .env    # 아래 A-3 템플릿 붙여넣고 값 채우기 (gitignore 되어 커밋 안 됨)

# 백엔드 기동(빌드 포함) — 컨테이너 안에서 bootJar 빌드 → 실행
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f   # 기동 로그 확인(Flyway·health)
curl http://127.0.0.1:8080/api/health                # {"status":"UP"}
```

### A-3. `.env` 템플릿 (서버에만 두기 · 커밋 금지)
```dotenv
APP_JWT_SECRET=<32바이트 이상 랜덤 문자열>
APP_CORS_ALLOWED_ORIGINS=https://<pages 도메인>       # 프론트 배포 후 확정(예: https://leadpot.pages.dev)
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-host>/<db>?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon-user>
SPRING_DATASOURCE_PASSWORD=<neon-password>
APP_UPLOADS_DIR=/app/uploads
```
> Neon 접속정보는 지금 로컬 `backend/application-local.properties` 에 있는 값과 동일(호스트/DB/유저/비번). URL 은 `jdbc:postgresql://` + `?sslmode=require` 형태로.

### A-4. Nginx + Cloudflare (HTTPS)
- [ ] `sudo apt install nginx` → `deploy/nginx-leadpot-api.conf` 를 `/etc/nginx/sites-available/` 에 복사, `server_name` 을 실제 `api.<도메인>` 으로 수정 → `sites-enabled` 링크 → `sudo nginx -t && sudo systemctl reload nginx`.
- [ ] Cloudflare DNS: `api.<도메인>` A레코드 → VM 공인 IP, **프록시 ON(주황 구름)**. SSL/TLS 모드 우선 **Flexible**(빠른 시작) → 이후 **Full** 로 강화.
- [ ] 도메인이 없으면: 임시로 VM 공인 IP:80(http) 로 프론트 env 를 맞춰 테스트도 가능하나, 브라우저 혼합콘텐츠 때문에 프론트(https)에서 http API 호출은 막힘 → **도메인+CF 프록시(https)** 를 권장.

### A-5. 프론트(Cloudflare Pages) + 연결
- [ ] Pages 프로젝트 → GitHub `main` 연결, 루트 `frontend`, 빌드 `npm run build`, 출력 `dist`, env `VITE_API_BASE_URL=https://api.<도메인>`.
- [ ] 배포되면 Pages 도메인(예: `leadpot.pages.dev`) 확인 → 서버 `.env` 의 `APP_CORS_ALLOWED_ORIGINS` 에 그 주소 넣고 `docker compose -f docker-compose.prod.yml up -d`(재기동).
- [ ] 스모크(§4): health / 가입·로그인 / 공개폼 제출·새로고침 / 연동 알림.

### A-6. 갱신 배포(코드 바뀔 때)
```bash
cd Leadpot && git pull && docker compose -f docker-compose.prod.yml up -d --build
```
