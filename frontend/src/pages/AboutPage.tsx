import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { LeadpotWordmark } from "../components/LeadpotWordmark";

/**
 * 서비스 소개 — 로그인 없이 열리는 공개 페이지. `/`(비로그인) 와 `/about` 두 곳에서 같은 화면을 쓴다.
 *
 * 용도 3가지:
 *  1) 서비스가 무엇인지(제공 서비스 = 판매상품) 외부에 설명한다.
 *  2) **네이버 GFA 광고 심사** — 광고 랜딩 URL(`https://app.lead-pot.com`)이 서비스 소개로 열려야 한다.
 *     그래서 `/` 에서 비로그인 방문자는 로그인 화면으로 튕기지 않고 이 페이지를 본다(RoleHomeRedirect).
 *  3) **카카오 비즈니스 채널 인증**에 제출하는 "사업자-채널 연관성" 증빙 URL(`/about`).
 *     카카오는 한 화면에서 ①사업자 정보 ②채널명과 같은 서비스명 ③판매상품이
 *     모두 확인돼야 승인한다. ①은 공통 푸터(ServiceLayout 이 붙인다), ②③은 이 페이지 본문이 담당한다.
 *     특히 "운영 주체" 절이 상호(꾸스)와 서비스명(리드팟)을 잇는 문장을 담고 있다 — 지우지 말 것.
 *
 * 구성은 레퍼런스(easyl.net)를 따른다: 히어로 → 기능 섹션(제목·부제·화면 목업) 반복 → 마무리 CTA.
 * 화면 목업은 스크린샷 대신 CSS 로 그린 도식이다(이미지 관리 부담 없음, 다크모드 자동 대응).
 *
 * 공개 화면이므로 모바일 우선으로 검증한다(CLAUDE.md 모바일 퍼스트).
 * 기재 내용은 실제 구현된 기능만 쓴다 — 없는 기능/실적/요금을 적지 않는다.
 */

type Feature = {
  kicker: string;
  title: ReactNode;
  sub: string;
  points: string[];
  mock: ReactNode;
};

const FEATURES: Feature[] = [
  {
    kicker: "랜딩페이지 제작",
    title: (
      <>
        코딩 없이 쉽고 빠르게,
        <br />
        블록만 쌓으면 완성
      </>
    ),
    sub: "이미지·문단·버튼·상담 신청 폼을 블록으로 쌓아 광고용 랜딩페이지를 만듭니다.",
    points: ["이미지만 올려도 완성되는 블록 편집기", "자주 쓰는 요소는 재사용", "모바일 화면 미리보기"],
    mock: <BuilderMock />,
  },
  {
    kicker: "배포",
    title: (
      <>
        도메인·호스팅,
        <br />
        신경 쓰지 마세요
      </>
    ),
    sub: "저장하는 순간 공개 URL이 생깁니다. 서버·SSL 설정 없이 광고에 바로 연결하세요.",
    points: ["고객별 전용 주소 자동 발급", "무료 SSL(https) 기본 적용", "모바일에 최적화된 빠른 페이지"],
    mock: <PublishMock />,
  },
  {
    kicker: "연동",
    title: (
      <>
        픽셀, 문자, 텔레그램,
        <br />
        구글 시트까지 연결
      </>
    ),
    sub: "새 상담이 들어오면 필요한 곳으로 바로 전달됩니다.",
    points: [
      "메타·구글·카카오 광고 픽셀 설치",
      "텔레그램 알림 · 문자 발송",
      "구글 스프레드시트 자동 기록 · 외부 API 전달",
    ],
    mock: <IntegrationsMock />,
  },
  {
    kicker: "리드 관리 (CRM)",
    title: (
      <>
        수집한 상담 DB 관리,
        <br />
        자체 CRM 기능까지
      </>
    ),
    sub: "여러 캠페인에서 들어온 상담 신청을 한 화면에서 관리하고 성과를 확인합니다.",
    points: [
      "진행 상태·메모·태그로 상담 관리",
      "엑셀·CSV 내보내기와 가져오기",
      "방문수·전환율·유입경로 통계, 광고주 공유",
    ],
    mock: <CrmMock />,
  },
];

export function AboutPage() {
  return (
    <div className="lp-home">
      <header className="lp-nav">
        <div className="lp-container lp-nav-in">
          <Link to="/" className="lp-nav-brand" aria-label="리드팟 홈">
            <LeadpotWordmark size={20} />
          </Link>
          <Link to="/login" className="lp-nav-login">
            로그인
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero-in">
            <p className="lp-pill">광고 마케터를 위한 랜딩 · DB 수집 · CRM</p>
            <h1 className="lp-hero-title">
              랜딩페이지 제작부터
              <br />
              상담 DB 관리까지 한 번에
            </h1>
            <p className="lp-hero-sub">
              <strong>리드팟(Leadpot)</strong>은 광고용 랜딩페이지를 만들고, 상담 신청(리드)을 모아, 관리까지
              한곳에서 하는 서비스입니다.
            </p>
            {/* 공개 회원가입 닫힘(2026-08-06) — 계정은 운영자가 발급한다. CTA 는 로그인으로 보낸다. */}
            <Link to="/login" className="lp-btn">
              리드팟 시작하기 <span aria-hidden="true">→</span>
            </Link>
            <a href="#features" className="lp-scroll" aria-label="기능 소개로 이동">
              <span />
            </a>
          </div>
        </section>

        <div id="features">
          {FEATURES.map((f, i) => (
            <section className={`lp-feature${i % 2 ? " alt" : ""}`} key={f.kicker}>
              <div className="lp-container">
                <p className="lp-kicker">{f.kicker}</p>
                <h2 className="lp-feature-title">{f.title}</h2>
                <p className="lp-feature-sub">{f.sub}</p>
                <ul className="lp-points">
                  {f.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="lp-mock-wrap" aria-hidden="true">
                  {f.mock}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="lp-feature">
          <div className="lp-container">
            <p className="lp-kicker">이런 분들이 씁니다</p>
            <ul className="lp-audience">
              <li>광고를 운영하며 상담 신청을 받아야 하는 광고 대행사·마케터</li>
              <li>랜딩페이지를 외부에 맡기지 않고 직접 빠르게 만들고 싶은 담당자</li>
              <li>여러 캠페인의 상담 DB를 한곳에 모아 광고주와 함께 관리하려는 팀</li>
            </ul>
          </div>
        </section>

        <section className="lp-owner">
          <div className="lp-container">
            <h2 className="lp-owner-title">운영 주체</h2>
            <p className="lp-owner-body">
              리드팟은 광고 대행업을 하는 <strong>꾸스</strong>가 직접 개발·운영하는 서비스입니다. 사업자
              정보는 아래에서 확인하실 수 있습니다.
            </p>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-container">
            <h2 className="lp-final-title">
              광고 운영은 더 빠르게,
              <br />
              상담 DB는 놓치지 않게
            </h2>
            <Link to="/login" className="lp-btn">
              리드팟 시작하기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- 화면 목업 (CSS 도식) ---------- */

function Window({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="lp-mock">
      <div className="lp-mock-bar">
        <i />
        <i />
        <i />
        <span className="lp-mock-url">{url}</span>
      </div>
      <div className="lp-mock-body">{children}</div>
    </div>
  );
}

function BuilderMock() {
  return (
    <Window url="app.lead-pot.com/landings/edit">
      <div className="mk-builder">
        <div className="mk-side">
          <b>블록 추가</b>
          {["이미지", "문단", "버튼", "상담 폼"].map((t) => (
            <span className="mk-chip" key={t}>
              + {t}
            </span>
          ))}
        </div>
        <div className="mk-canvas">
          <div className="mk-phone">
            <div className="mk-img" />
            <div className="mk-line w80" />
            <div className="mk-line w60" />
            <div className="mk-input" />
            <div className="mk-input" />
            <div className="mk-cta">상담 신청하기</div>
          </div>
        </div>
      </div>
    </Window>
  );
}

function PublishMock() {
  return (
    <Window url="app.lead-pot.com/landings">
      <div className="mk-publish">
        <div className="mk-publish-card">
          <span className="mk-badge">공개 중</span>
          <b>봄 시즌 상담 이벤트</b>
          <div className="mk-url">
            <span>https://yourbrand.lead-pot.com/12</span>
            <em>복사</em>
          </div>
          <div className="mk-row">
            <span className="mk-dot" /> SSL 적용됨
            <span className="mk-dot" /> 모바일 최적화
          </div>
        </div>
      </div>
    </Window>
  );
}

function IntegrationsMock() {
  const rows: [string, boolean][] = [
    ["메타 픽셀", true],
    ["구글 태그", true],
    ["카카오 픽셀", false],
    ["텔레그램 알림", true],
    ["구글 스프레드시트", true],
  ];
  return (
    <Window url="app.lead-pot.com/integrations">
      <div className="mk-list">
        {rows.map(([name, on]) => (
          <div className="mk-toggle-row" key={name}>
            <span>{name}</span>
            <span className={`mk-toggle${on ? " on" : ""}`}>
              <i />
            </span>
          </div>
        ))}
      </div>
    </Window>
  );
}

function CrmMock() {
  const rows = [
    ["김**", "010-****-1234", "상담완료", "ok"],
    ["이**", "010-****-5678", "진행중", "ing"],
    ["박**", "010-****-9012", "신규", "new"],
    ["최**", "010-****-3456", "신규", "new"],
  ];
  return (
    <Window url="app.lead-pot.com/inbox">
      <div className="mk-crm">
        <div className="mk-crm-head">
          <b>리드</b>
          <span className="mk-seg">전체 128</span>
          <span className="mk-seg">오늘 12</span>
          <span className="mk-xls">엑셀 내보내기</span>
        </div>
        <table className="mk-table">
          <tbody>
            {rows.map(([n, p, s, k]) => (
              <tr key={p}>
                <td>{n}</td>
                <td>{p}</td>
                <td>
                  <span className={`mk-status ${k}`}>{s}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Window>
  );
}
