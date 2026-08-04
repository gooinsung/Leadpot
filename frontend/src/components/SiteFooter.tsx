import { Link } from "react-router-dom";

/**
 * 서비스 공통 푸터 — 사업자 정보 표기. 전자상거래법상 표시 의무(상호·대표자·사업자등록번호·소재지).
 *
 * ⚠️ 이 컴포넌트를 페이지에 직접 넣지 않는다. 붙이는 곳은 components/ServiceLayout.tsx 한 곳이며
 *    노출 범위(넣는 화면·빼는 화면)와 그 이유도 거기 주석에 모아 뒀다.
 *
 * ⚠️ 주민(법인)등록번호는 표기 대상이 아니다. 절대 넣지 않는다.
 *
 * 참고: 카카오 비즈니스 채널 인증이 요구하는 "사업자↔서비스명 연관성"은
 *       /about 본문(운영 주체 절)이 담당한다. 여기서는 사업자 정보만 담는다.
 */

/** 사업자등록증 기준 사업자 정보. 값이 바뀌면 여기만 고친다. */
export const BUSINESS = {
  serviceName: "리드팟(Leadpot)",
  companyName: "꾸스",
  owner: "구인성",
  registrationNo: "392-08-03519",
  address: "인천광역시 연수구 하모니로178번길 22, 7층 707-사89호(송도동, 송도GTX센트럴빌딩)",
} as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-inner">
        <ul className="site-footer-biz">
          <li>
            <span className="site-footer-k">상호</span>
            <span className="site-footer-v">{BUSINESS.companyName}</span>
          </li>
          <li>
            <span className="site-footer-k">대표자</span>
            <span className="site-footer-v">{BUSINESS.owner}</span>
          </li>
          <li>
            <span className="site-footer-k">사업자등록번호</span>
            <span className="site-footer-v">{BUSINESS.registrationNo}</span>
          </li>
          <li className="site-footer-addr">
            <span className="site-footer-k">사업장 소재지</span>
            <span className="site-footer-v">{BUSINESS.address}</span>
          </li>
        </ul>
        <div className="site-footer-meta">
          <Link to="/about">서비스 소개</Link>
          <span className="site-footer-copy">
            © {new Date().getFullYear()} {BUSINESS.companyName}
          </span>
        </div>
      </div>
    </footer>
  );
}
