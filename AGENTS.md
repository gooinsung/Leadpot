# AGENTS.md — Leadpot(리드팟) 작업 지침 (AI 에이전트용)

> **Codex·Claude Code 등 이 저장소에서 일하는 모든 에이전트는 작업 전에 이 문서를 먼저 읽는다.**
> 이 문서는 **진입점**이다. 상세 규칙·배경은 [CLAUDE.md](CLAUDE.md),
> 코드 지도는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), 진행 기록은 [docs/PROGRESS.md](docs/PROGRESS.md).
>
> 규칙이 바뀌면 **이 문서와 CLAUDE.md 를 같은 커밋에서 함께** 고친다.
>
> ℹ️ `renderer/AGENTS.md` 는 별개다 — Next.js 가 `next dev` 때 **자동 생성·복원**하는 블록이라
> 사람이 관리하는 규칙이 아니다. 지워도 다시 생기니 그대로 두고 커밋한다.

---

## 0. 이 프로젝트가 무엇인가 (30초)

**Leadpot(리드팟)** — 랜딩페이지를 만들어 공개 URL로 뿌리고, 방문자가 남긴 상담 신청(리드)을 모아
관리하는 **B2B 웹 서비스**. `dbcart.net`(디비카트) 벤치마킹.

🔴 **실서비스다.** 실고객(법률사무소 등)이 이 랜딩으로 **실제 광고비를 태우고 있고**, 실제 개인정보
(이름·연락처)가 DB에 쌓인다. 장난 데이터가 아니다. 되돌리기 어려운 작업은 반드시 확인받는다.

- 역할 3종: **마케터**(주 고객) / **광고주**(마케터의 하위계정, 배정받은 리드폼만 열람) / **운영자**(우리)
- 모노레포: `backend`(Spring Boot) · `frontend`(React SPA 관리앱) · `renderer`(Next.js 공개랜딩 SSR) ·
  `packages/public-ui`(둘이 공유하는 공개 렌더링 컴포넌트)
- 운영: Cloudflare(Pages·Workers) + Railway(API·Postgres) + R2(이미지) + Solapi(문자·알림톡)

---

## 1. ⚠️ 최상위 지침 — 다른 모든 규칙에 우선

**애매하거나 확인이 필요한 부분은 절대 임의로 진행하지 않는다. 반드시 사용자에게 먼저 물어본다.**

- 해당: 판단이 갈리는 설계·범위·기술 선택 / 되돌리기 어렵거나 외부에 영향 주는 작업 /
  사용자 의도가 불확실한 경우 / 여러 갈래가 있는 결정.
- **명백하고 안전하며 이미 합의된 범위**의 작업만 자율적으로 진행한다.
- 확신이 서지 않으면 **멈추고 질문한 뒤 답을 기다린다.** "일단 진행하고 나중에 되돌리기"는 하지 않는다.
- 선택지를 제시할 때는 추측하지 말고 **명확한 선택지로 물어본다** — 과거에 추측으로 진행했다가
  요구사항이 4번 뒤집힌 기능이 있다(랜딩 배경 컬러, PROGRESS.md 2026-09-08).

### 📱 모바일 퍼스트 (제품 최상위 원칙)

**우리가 만든 공개 폼·랜딩은 99%가 모바일에서 열린다.** 모든 공개 화면(`go.lead-pot.com/{sub}/{id}`,
`/f/{id}`, 동의 뷰)은 **모바일 최적화가 최우선**이다. 새 공개 화면은 항상 375px에서 먼저 확인한다
(입력창 16px = iOS 자동확대 방지, 큰 탭 타깃, 풀폭, safe-area).
관리 화면(대시보드·빌더)은 데스크톱 우선이어도 된다. **공개 화면은 예외 없다.**

---

## 2. 작업 시작 전 순서

1. **[docs/PROGRESS.md](docs/PROGRESS.md)** 의 "📍 지금 위치" + "👉 다음에 할 일" 을 읽는다. ← 항상 여기부터
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** 로 코드 위치를 잡는다.
3. 손댈 영역의 기획 문서를 읽는다(§9 문서 지도).
4. **§5 "같이 고쳐야 하는 곳"** 에 걸리는 작업인지 확인한다.
5. 작업 → 검증 → 커밋 → **PROGRESS.md 갱신**.

> ⚠️ **git log 로 히스토리를 추적할 수 없다.** 이 클론은 **shallow**(2026-09-01 이후만)다.
> 그 이전 경위는 전부 `docs/PROGRESS.md` 에 있다.

---

## 3. 🚫 하지 말 것 (실제 사고가 났던 것들)

| 금지 | 왜 |
|---|---|
| **이미 적용된 Flyway 마이그레이션 파일 삭제·수정** | Flyway 검증 실패로 **앱이 아예 안 뜬다**. 롤백은 코드만 되돌린다 |
| **`renderer/src/proxy.ts` 의 `proxyToAdminApp()` 제거** | 와일드카드 Workers 라우트가 `app.lead-pot.com` 도 가로채 **관리 앱이 빈 페이지가 된다**(실제 장애) |
| **공개 화면 코드를 `frontend/` 에만 추가** | 실서비스 공개 랜딩은 `renderer`(SSR)가 그린다 → **조용히 반영 안 됨**. 광고 픽셀이 이 이유로 죽어 있었다 |
| **시크릿·키·개인정보 커밋** | 환경변수로만 관리(Railway Variables · Cloudflare Variables) |
| **테스트를 건너뛰거나 skip 처리해서 통과시키기** | — |
| **`main` 에 직접 push** | 작업 브랜치 → PR 병합. `main` push = **즉시 실서비스 배포** |
| **확인 없이 광고주·리드 데이터 삭제/변경 스크립트 실행** | 실고객 개인정보다 |
| **"결정된 사항(다시 논의하지 말 것)" 뒤집기** | PROGRESS.md 에 있다. 바꿔야 하면 **먼저 사용자와 상의** |

---

## 4. 검증 없이 "완료"라고 하지 않는다

```bash
npm install                                      # 루트에서 (npm workspaces)

cd backend  && ./gradlew test                    # DB 필요(@SpringBootTest)
cd frontend && npx tsc -b && npx vitest run
cd packages/public-ui && npx vitest run
cd renderer && npx next build
```

- **못 돌린 검증은 "못 돌렸다"고 명시한다.** 원격/샌드박스 환경엔 **Docker 데몬·브라우저가 없을 수
  있다** → `@SpringBootTest`(DB 필요)와 실제 화면 확인은 불가능하다. 그럴 땐
  `./gradlew compileJava compileTestJava` + 순수 단위 테스트까지만 하고 **남은 확인 항목을
  PROGRESS.md 에 적는다.** 통과했다고 말하지 않는다.
- **UI 변경은 브라우저로 직접 봐야 끝난다.** 타입체크·테스트는 코드 정합성이지 기능 정합성이 아니다.

---

## 5. ⚠️ 같이 고쳐야 하는 곳 (한 곳만 고치면 조용히 어긋난다)

전체 표는 [docs/ARCHITECTURE.md §9](docs/ARCHITECTURE.md). 가장 자주 걸리는 것:

- **광고 URL 파라미터 키** → `frontend/src/lib/adUrl.ts` + `packages/public-ui/src/lib/utm.ts` +
  `backend/.../common/TrackingParams.java` + 빌더 UI + 통계 6곳
- **공개 화면 렌더링** → 반드시 `packages/public-ui/`
- **DB 스키마** → Flyway 새 파일 + 엔티티 + DTO + 프론트 타입 (`ddl-auto=validate`)
- **리드 상태** → `LeadStatuses` + `LeadStatusService`(단일 관문) + 프론트 라벨·색
- **공용 CSS 클래스 삭제** → `grep` 전수 조사 (과거 회귀 사고)

---

## 6. 컨벤션

**언어** — 문서·주석·커밋 메시지·UI 텍스트는 **한국어**. 코드 식별자는 영어.

**브랜치** — `main`은 배포 가능 상태. 작업은 `feature/<요약>`·`fix/<요약>`·`docs/<요약>` 에서 하고
PR로 병합. 🔴 **`main` push = 즉시 실서비스 배포**(§8).

**커밋** — Conventional Commits, 작은 단위로 원자적으로.
```
feat: 새 기능 / fix: 버그 수정 / docs: 문서 / refactor: 리팩터링 / chore: 잡무 / test: 테스트
```

**코드**
- 백엔드: Controller → Service → Repository. DTO로 요청/응답 분리(엔티티 직접 노출 금지).
  예외는 공통 핸들러.
- 프론트: 함수형 컴포넌트 + 훅. **API 호출은 `src/api/client.ts` 에 모은다**(컴포넌트에서 fetch 남발 금지).
- 새 코드는 **주변 코드 스타일을 따른다.** 재사용 우선, 불필요한 재작성 지양.
- 주석은 **"왜"** 를 쓴다. 이 저장소는 주석에 결정 배경·함정을 남기는 문화다 — 그 관행을 따른다.

**문서** — 의사결정이 바뀌면 `CLAUDE.md`·`AGENTS.md`·관련 `docs/*` 를 **같은 PR에서** 갱신한다.

### ⭐ 진행 기록 (필수 — 이어받기의 핵심)

**작업을 멈추거나 / 단계가 끝나거나 / 세션을 마칠 때 반드시 [docs/PROGRESS.md](docs/PROGRESS.md) 를
갱신하고 커밋한다.** 항상 **"지금 위치 / 방금 한 일 / 다음에 할 일 / 블로커"** 를 최신으로 둔다.
새 기록은 "📍 지금 위치" 맨 위에 넣는다(최신이 위).

---

## 7. 로컬 실행

```bash
npm install                                # 루트 (npm workspaces)

docker compose up -d db                    # postgres:18 → :5432
cd backend
cp src/main/resources/application-local.properties.example \
   src/main/resources/application-local.properties
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun     # → :8080 (Flyway가 V1~V43 자동 적용)

cd frontend && npm run dev                 # → :5173
cd renderer && cp .env.local.example .env.local && npm run dev   # → :3000
```

로컬 DB는 **프로덕션과 완전히 분리돼 있다**(2026-08-18 확립). 프로덕션 DB는 Railway 내부망 전용이라
외부에서 접근 자체가 안 된다. 빈 DB에 Flyway가 스키마를 전부 만들어주므로 덤프가 필요 없다.

---

## 8. 배포 (🔴 `main` push = 실서비스 즉시 반영)

| 바뀐 경로 | 어디로 나가나 |
|---|---|
| `frontend/**` · `packages/public-ui/**` | Cloudflare Pages (`app.lead-pot.com`) |
| `renderer/**` · `packages/public-ui/**` | Cloudflare Workers (`go.lead-pot.com` 공개 랜딩) |
| `backend/**` | **Railway** 자체 GitHub 연동(이 저장소 워크플로 아님) |

`packages/public-ui/**` 를 고치면 **Pages·Workers 둘 다** 나간다 = 공개 화면 전체 영향.
배포 후에는 GitHub Actions 결과를 확인하고, **실제 화면 확인이 필요하면 그렇다고 남긴다.**

---

## 9. 문서 지도

| 문서 | 언제 |
|---|---|
| **[docs/PROGRESS.md](docs/PROGRESS.md)** | **항상 먼저** — 지금 위치·다음 할 일·결정 사항 |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | 코드 어디에 뭐가 있나 · API·DB·라우트 전체 |
| [CLAUDE.md](CLAUDE.md) | 규칙 정본(상세·배경) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 진행 상황 |
| [docs/SPEC.md](docs/SPEC.md) · [docs/FEATURES.md](docs/FEATURES.md) · [docs/BACKLOG.md](docs/BACKLOG.md) | 기능 명세·카탈로그·선택 목록 |
| [docs/SSR-LANDING-PLAN.md](docs/SSR-LANDING-PLAN.md) | 공개 랜딩 SSR·Cloudflare 전환 배경(함정 포함) |
| [docs/ADVERTISER-PORTAL-PLAN.md](docs/ADVERTISER-PORTAL-PLAN.md) | 광고주 기능 정본 |
| [docs/MESSAGING-PLAN.md](docs/MESSAGING-PLAN.md) | 문자·알림톡 설계·법적 제약 |
| [docs/META-LEADS-PLAN.md](docs/META-LEADS-PLAN.md) | 인바운드 웹훅 리드 수신 |
| [docs/GO-LIVE-CHECKLIST.md](docs/GO-LIVE-CHECKLIST.md) | 오픈 전 보안·운영 점검 |
| [docs/UIUX-PLAN.md](docs/UIUX-PLAN.md) | 디자인 컨셉(관리=Cockpit / 공개=Daylight) |

---

## 10. 지금 진행 중인 것

**[docs/PROGRESS.md](docs/PROGRESS.md) 와 [docs/ARCHITECTURE.md §13](docs/ARCHITECTURE.md) 을 볼 것.**
요약(2026-09-15): 구글 광고 재심사 대응(고정 호스트 전환 후 각 광고 플랫폼 Final URL 갱신은
사용자 몫) · SSR 전환 후 회귀 확인 잔여분 · Oracle VM 종료 및 레거시 워크플로 정리 ·
GO-LIVE 점검표 미완 항목.
