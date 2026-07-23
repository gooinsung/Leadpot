# Leadpot (리드팟)

랜딩페이지로 리드(DB)를 수집·관리하는 웹 서비스. 실제 서비스 **디비카트(dbcart.net)** 를 벤치마킹해 직접 구현하고 확장한다.

**차별점**: 입력폼을 랜딩과 **독립적으로 만들어 여러 랜딩에서 재사용**, 폼 유형 확장 구조(**기본형 / 선택형(스텝)** …), 폼 본문에 **이미지·HTML 콘텐츠 블록** 삽입.

## 기술 스택

| 구성 | 기술 | 배포(무료 시작) |
|---|---|---|
| 프론트엔드 | React + Vite (TypeScript) | Cloudflare Pages |
| 백엔드 | Spring Boot (REST) + Docker | Oracle Cloud 무료 VM |
| DB | PostgreSQL | VM 내 컨테이너 |

이식성 원칙: Docker + 표준 Postgres → 유료 VPS/Cloud Run/AWS 등으로 자유 이전.

## 문서 (먼저 읽기)

- [CLAUDE.md](CLAUDE.md) — 작업 규칙 (이어받기 시작점)
- [docs/ROADMAP.md](docs/ROADMAP.md) — 1차 범위 + Phase 로드맵 + **진행상황**
- [docs/SPEC.md](docs/SPEC.md) — 서비스 기능 명세 + 데이터 모델
- [docs/FEATURES.md](docs/FEATURES.md) — 디비카트 전체 기능 카탈로그
- [docs/BACKLOG.md](docs/BACKLOG.md) — 기능 선택 목록 (1차/백로그)
- [docs/DBCART-ANALYSIS.md](docs/DBCART-ANALYSIS.md) — 실제 디비카트 구조 분석

## 로컬 실행 (스캐폴딩 완료 후)

```bash
# 사전: JDK 21, Node 20, Docker
docker-compose up                      # 백엔드 + PostgreSQL
cd frontend && npm install && npm run dev
```

> 현재 상태: **기획/설계 문서화 완료. 다음 = Phase 0(프로젝트 셋업 & 배포 파이프라인).** 진행상황은 [docs/ROADMAP.md](docs/ROADMAP.md) 참고.
