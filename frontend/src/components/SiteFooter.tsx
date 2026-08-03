import { Link } from "react-router-dom";

/**
 * 서비스 공통 푸터 — 사업자 정보 표기.
 *
 * 목적 2가지:
 *  1) 전자상거래법상 사업자 정보 표시(상호·대표자·사업자등록번호·사업장 소재지).
 *  2) **카카오 비즈니스 채널 인증**의 "사업자-채널 연관성" 증빙.
 *     상호(꾸스)와 서비스명(리드팟)이 다르므로, 둘을 잇는 문장을 반드시 노출한다.
 *     → 카카오 심사에 제출할 URL 은 **로그인 없이** 이 푸터가 보이는 페이지여야 한다.
 *
 * ⚠️ 노출 범위: 우리 서비스 화면(로그인·회원가입 등)에만 쓴다.
 *    사용자가 만든 공개 폼(/f/:id)·랜딩(/p/:slug)·서브도메인 사이트에는 넣지 않는다.
 *    그 화면들은 "고객의 페이지"이므로 우리 사업자 정보가 뜨면 방문자가 운영주체를 오인한다.
 *
 * ⚠️ 주민(법인)등록번호는 표기 대상이 아니다. 절대 넣지 않는다.
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
        <p className="site-footer-lead">
          <strong>{BUSINESS.serviceName}</strong>은 <strong>{BUSINESS.companyName}</strong>가 운영하는
          서비스입니다.
        </p>
        <ul className="site-footer-biz">
          <li>
            상호 <span>{BUSINESS.companyName}</span>
          </li>
          <li>
            대표자 <span>{BUSINESS.owner}</span>
          </li>
          <li>
            사업자등록번호 <span>{BUSINESS.registrationNo}</span>
          </li>
          <li className="site-footer-addr">
            사업장 소재지 <span>{BUSINESS.address}</span>
          </li>
        </ul>
        <p className="site-footer-copy">
          <Link to="/about">서비스 소개</Link>
          <span aria-hidden="true"> · </span>© {new Date().getFullYear()} {BUSINESS.companyName}. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
}
