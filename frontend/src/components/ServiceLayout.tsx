import { Outlet } from "react-router-dom";
import { SiteFooter } from "./SiteFooter";

/**
 * 우리 서비스 화면의 공통 셸 — 페이지 아래에 사업자 정보 푸터를 항상 붙인다.
 * 푸터를 페이지마다 넣지 않고 여기 한 곳에서만 붙인다(App.tsx 의 레이아웃 라우트).
 *
 * ✅ 붙이는 화면: 마케터 화면 전체 + 로그인 · 회원가입 · 서비스 소개(/about)
 *
 * ❌ 일부러 빼는 화면 (넓히기 전에 아래 이유를 먼저 확인할 것)
 *  - 공개 폼(/f/:id) · 랜딩(/p/:slug) · 서브도메인 사이트
 *    → "고객(마케터)의 페이지"다. 우리 사업자 정보가 뜨면 방문자가 운영주체를 오인한다.
 *  - 광고주 포털(/client/*) 과 광고주 미리보기(/advertisers/:id/preview)
 *    → 화이트라벨(마케터 브랜드)로 만든 화면이라 리드팟 정보를 넣지 않는다.
 *      미리보기는 광고주가 실제로 보는 화면과 같아야 하므로 함께 제외한다.
 */
export function ServiceLayout() {
  return (
    <div className="site-root">
      <Outlet />
      <SiteFooter />
    </div>
  );
}
