# docs/DEPLOY.md — Leadpot 배포 체크리스트

> ⚠️ **현재 실제로 돌고 있는 구성은 [부록 C](#부록-c-실제-배포-파이프라인-2026-08-04-실측) 다. 거기부터 읽어라.**
> 본문·부록 A·B 는 **초기 계획**이라 실제와 다른 곳이 있다(프론트=Pages ❌, DB=VM 내 Postgres ❌).
>
> 계획 당시 아키텍처: ~~프론트=Cloudflare Pages~~ / **백엔드=Oracle Cloud VM(Docker)** / ~~DB=VM 내 PostgreSQL~~(→ Neon).
> 상세 배경은 [CLAUDE.md](../CLAUDE.md) §3(아키텍처)·§6(배포법) 참고.
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

### A-5. ~~프론트(Cloudflare Pages) + 연결~~ — **폐기됨. 부록 C 참고**

> Cloudflare Pages 는 쓰지 않는다. 프론트는 GitHub Actions 가 빌드해 **VM 의 Nginx 웹루트**로 rsync 한다.
> 아래 체크리스트는 초기 계획의 흔적이며 실제 구성과 다르다.
- [ ] Pages 프로젝트 → GitHub `main` 연결, 루트 `frontend`, 빌드 `npm run build`, 출력 `dist`, env `VITE_API_BASE_URL=https://api.<도메인>`.
- [ ] 배포되면 Pages 도메인(예: `leadpot.pages.dev`) 확인 → 서버 `.env` 의 `APP_CORS_ALLOWED_ORIGINS` 에 그 주소 넣고 `docker compose -f docker-compose.prod.yml up -d`(재기동).
- [ ] 스모크(§4): health / 가입·로그인 / 공개폼 제출·새로고침 / 연동 알림.

### A-6. 갱신 배포(코드 바뀔 때)
```bash
cd Leadpot && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

---

## 부록 B. AMD Micro(1GB) 전환 — 저사양 세팅 (2026-07-28 결정)

> ARM(A1.Flex 6GB) 이 서울에서 계속 out-of-capacity → **AMD `VM.Standard.E2.1.Micro`(1 OCPU, 1GB, Always Free)** 로 전환.
> DB=Neon(외부), 프론트=Cloudflare Pages 라 서버는 **백엔드 컨테이너 1개만** 실행 → 1GB 로도 가능(메모리 튜닝 필수).

### B-1. VM 생성 (A-1 과 동일, Shape 만 다름)
- [ ] Shape = **VM.Standard.E2.1.Micro** (AMD, 1GB) — 거의 항상 생성됨.
- [ ] Fault domain = **비워둠(자동)**. Image = Ubuntu 22.04/24.04.
- [ ] SSH 키 **Generate → private key 저장**(필수). 네트워킹 = 새 VCN + Public IPv4 ON.
- [ ] 공인 IP 확인.

### B-2. 스왑 2GB 추가 (SSH 접속 직후 — 빌드·기동 OOM 방지)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # 재부팅 후에도 유지
free -h   # Swap 2.0Gi 확인
```

### B-3. JVM 메모리 상한
- 이미 `docker-compose.prod.yml` 에 `JAVA_TOOL_OPTIONS=-Xmx512m` 반영됨(1GB 대비 힙 512MB 상한).
- 이후 서버는 A-2~A-6 절차 동일. **빌드가 느릴 수 있음**(1GB+스왑) — 인내심. 빌드가 OOM 으로 죽으면 스왑을 4G 로 늘리거나(위 명령 2G→4G), 로컬에서 이미지 빌드 후 전송 검토.

### B-4. 처리량 참고
- 정적 자산=Cloudflare CDN, DB=Neon 이므로 서버는 **가벼운 JSON API 만** 처리 → 실광고 테스트(수천 방문/일) 수준은 무난.
- 부족해지면 Docker 그대로 **Hetzner(2~4GB, 월 ~€4)** 등으로 이전(코드 무수정, `.env` 만 이동).

---

## 부록 C. 실제 배포 파이프라인 (2026-08-04 실측)

> 본문·부록 A 는 **초기 계획**이다. 실제로 돌고 있는 건 이 부록이다. 계획과 다른 점:
> **프론트는 Cloudflare Pages 가 아니고**(VM Nginx), **DB 는 VM 안 컨테이너가 아니다**(Neon).
> Cloudflare 는 DNS·SSL 프록시만 한다.

### C-1. 서버 접속

| 항목 | 값 |
|---|---|
| 공인 IP | `129.225.198.2` (Oracle Cloud) |
| 계정 | `ubuntu` |
| 저장소 위치 | `~/Leadpot` |
| 시크릿 | `~/Leadpot/.env` (gitignore · **자동 배포 대상 아님**) |
| 웹루트(프론트) | `/var/www/leadpot/` |

```bash
ssh -i <개인키> ubuntu@129.225.198.2
```

- ⚠️ **공인 IP 유형이 `임시(Ephemeral)` 인지 `예약됨(Reserved)` 인지 확인되지 않았다.** 기본값은 임시다.
  임시라도 재부팅·중지/시작에는 유지되고 **인스턴스 종료 시에만** 바뀐다. 다만 솔라피 허용 IP 같은
  **외부에 IP 를 등록하기 전에는 예약 IP 로 전환**해 두는 게 안전하다(전환하면 주소가 바뀌므로
  Cloudflare A레코드도 함께 갱신해야 한다 — 같은 주소로 전환하는 방법은 없다).

### C-2. 자동 배포 (main push → 경로별 트리거)

| 워크플로 | 경로 | 실측 소요 | 다운타임 |
|---|---|---|---|
| `deploy-frontend.yml` | `frontend/**` | 1~2분 | **없음** |
| `deploy-backend.yml` | `backend/**`·`docker-compose.prod.yml` | **10분 06초(08-02) / 16분 49초(08-04)** | **약 60~80초** |

저장소 시크릿: `VM_SSH_KEY` · `VM_HOST` · `VM_USER`.

**프론트가 무중단인 이유**: 해시 붙은 새 자산을 먼저 올려 옛 자산을 남겨둔 채, 마지막에 `index.html` 만
교체한다(`--delete` 를 쓰지 않는다). 배포 중에 열려 있던 페이지가 참조하는 옛 자산이 살아 있어 화면이 안 깨진다.
→ 옛 자산이 누적되지만 해시명이라 무해. 가끔 수동 정리.

**백엔드가 끊기는 이유**: 컨테이너가 하나뿐이라 `up -d --build` 가 옛 컨테이너를 내리고 새 것을 올린다.
그 사이 Nginx 가 502 를 낸다(2026-08-04 실측 60~80초). **이 순간 공개 폼 제출은 실패한다.**

### C-3. ⚠️ 백엔드 배포가 느린 원인과 개선안

원인은 서버 사양이 아니라 **빌드 위치**다. [`backend/Dockerfile`](../backend/Dockerfile) 이 멀티스테이지로
**VM 안에서 `./gradlew bootJar` 를 돈다.** 1 OCPU/1GB 인스턴스에서 이게 10분 이상을 먹는다.
백엔드 파일이 많이 바뀌면 의존성 캐시 레이어까지 무효화돼 더 길어진다(08-04 에 16분 49초).

**개선안 1 — 빌드를 러너로 옮긴다 (비용 0원, 10~17분 → 2~3분)**
GitHub Actions 러너(4코어/16GB, 공개 저장소 무료)에서 JAR 또는 이미지를 만들고 VM 은 받아서 재기동만 한다.
지금 워크플로가 이미 SSH 로 붙으므로 바꿀 범위는 "VM 에서 build" → "러너에서 build 후 전송" 정도다.
**서버를 올려도 이걸 안 하면 여전히 3~4분 걸린다. 이게 먼저다.**

**개선안 2 — 무중단 (서버 업그레이드 후)**
새 컨테이너를 먼저 띄우고 헬스 통과 후 Nginx 를 전환한다. 컨테이너 둘을 동시에 띄워야 해서
**1GB 에서는 메모리가 빠듯하다**(현재 `-Xmx512m` 으로 묶여 있다). 서버를 올린 뒤에 할 일.

### C-4. 유료 서버로 옮길 때의 월 비용 (2026-08-04 조사)

한국 방문자가 공개 폼을 여는 서비스라 **API 지연이 그대로 체감된다.** 그래서 지연을 먼저 본다.

| 옵션 | 사양 | 월 비용 | 한국 지연 |
|---|---|---|---|
| **Vultr 서울** | 1vCPU / 2GB | **$10** (약 1.4만원) | ~5ms |
| **Vultr 서울** | 2vCPU / 4GB | **$20** (약 2.8만원) | ~5ms |
| Linode 도쿄 | 2vCPU / 4GB | $24 | ~35ms |
| 카페24 VPS(국내) | — | 11,000원~ | 최저 |
| Oracle 유료(춘천·서울) | 유연 | 무료 한도 초과분만 | ~5ms |
| ~~Hetzner CX22~~ | 2vCPU / 4GB | €4.5 (약 6,500원) | **~250ms — 탈락** |

- Hetzner 가 3~5배 싸지만 **아시아 리전이 없다.** 가격만 보고 고르면 공개 폼 응답이 느려진다.
- 이전은 Docker 라 코드 수정 없이 `.env` 만 옮기면 된다(이식성 원칙, CLAUDE.md §2).
- 출처: [Vultr 요금](https://www.vultr.com/pricing/) · [VPS 가격 비교 2026](https://apicalculators.com/cloud-vps-comparison) · [카페24 가상서버](https://hosting.cafe24.com/?controller=new_product_page&page=virtual)
