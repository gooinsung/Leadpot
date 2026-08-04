import { Link } from "react-router-dom";
import { TopBar } from "../components/TopBar";

/**
 * 서비스 소개(/about) — 로그인 없이 열리는 공개 페이지.
 *
 * 용도 2가지:
 *  1) 서비스가 무엇인지(제공 서비스 = 판매상품) 외부에 설명한다.
 *  2) **카카오 비즈니스 채널 인증**에 제출하는 "사업자-채널 연관성" 증빙 URL.
 *     카카오는 한 화면에서 ①사업자 정보 ②채널명과 같은 서비스명 ③판매상품이
 *     모두 확인돼야 승인한다. ①은 공통 푸터(ServiceLayout 이 붙인다), ②③은 이 페이지 본문이 담당한다.
 *     특히 "운영 주체" 절이 상호(꾸스)와 서비스명(리드팟)을 잇는 문장을 담고 있다 — 지우지 말 것.
 *
 * 공개 화면이므로 모바일 우선으로 검증한다(CLAUDE.md 모바일 퍼스트).
 * 기재 내용은 실제 구현된 기능만 쓴다 — 없는 기능/실적을 적지 않는다.
 */

/** 제공 서비스 — 실제 구현된 기능 기준. */
const SERVICES = [
  {
    title: "랜딩페이지 제작",
    body: "코딩 없이 블록을 쌓아 광고용 랜딩페이지를 만들고, 공개 URL로 바로 배포합니다. 이미지·버튼·문단 등 요소를 재사용할 수 있습니다.",
  },
  {
    title: "상담 신청 폼 · DB 수집",
    body: "이름·연락처 등을 받는 리드폼을 만들어 랜딩에 넣거나 외부 사이트에 임베드합니다. 방문자가 남긴 상담 신청은 실시간으로 수집됩니다.",
  },
  {
    title: "리드 관리 (CRM)",
    body: "수집된 상담 DB를 한 화면에서 관리합니다. 진행 상태·메모·태그·휴지통, 엑셀·CSV 내보내기와 가져오기를 지원합니다.",
  },
  {
    title: "통계 · 연동",
    body: "방문수·전환율·유입경로를 집계하고, 광고 픽셀을 설치할 수 있습니다. 새 상담이 들어오면 텔레그램 알림과 구글 스프레드시트 자동 전송으로 연결됩니다.",
  },
];

export function AboutPage() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap about-wrap">
        <section className="about-hero">
          <p className="eyebrow">서비스 소개</p>
          <h1 className="about-title">리드팟(Leadpot)</h1>
          <p className="about-lead">
            광고용 랜딩페이지를 만들고, 상담 신청(리드)을 모아, 관리까지 한곳에서 하는 서비스입니다.
          </p>
          <div className="about-cta">
            <Link className="btn btn-primary" to="/signup">
              무료로 시작하기
            </Link>
            <Link className="btn btn-ghost" to="/login">
              로그인
            </Link>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-h2">제공 서비스</h2>
          <div className="about-grid">
            {SERVICES.map((s) => (
              <div className="card card-pad about-item" key={s.title}>
                <h3 className="about-item-title">{s.title}</h3>
                <p className="about-item-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-h2">이런 분들이 씁니다</h2>
          <ul className="about-list">
            <li>광고를 돌려 상담 신청을 받아야 하는 광고 대행사·마케터</li>
            <li>랜딩페이지를 외부에 맡기지 않고 직접 빠르게 만들고 싶은 담당자</li>
            <li>여러 캠페인에서 들어온 상담 DB를 한곳에 모아 관리하려는 팀</li>
          </ul>
        </section>

        <section className="about-section">
          <h2 className="about-h2">운영 주체</h2>
          <p className="about-owner">
            리드팟은 광고 대행업을 하는 <strong>꾸스</strong>가 직접 개발·운영하는 서비스입니다. 사업자
            정보는 아래에서 확인하실 수 있습니다.
          </p>
        </section>
      </main>
    </div>
  );
}
