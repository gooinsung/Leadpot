import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
// SignupPage 는 회원가입을 닫으면서 라우트에서 뺐다(아래 /signup 주석). 파일은 남아 있다.
import { AboutPage } from "./pages/AboutPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadInboxPage } from "./pages/LeadInboxPage";
import { FormsListPage } from "./pages/FormsListPage";
import { FormEditPage } from "./pages/FormEditPage";
import { ConsentDocsListPage } from "./pages/ConsentDocsListPage";
import { ConsentDocEditPage } from "./pages/ConsentDocEditPage";
import { ConsentViewPage } from "./pages/ConsentViewPage";
import { HtmlComponentsListPage } from "./pages/HtmlComponentsListPage";
import { HtmlComponentEditPage } from "./pages/HtmlComponentEditPage";
import { LeadsListPage } from "./pages/LeadsListPage";
import { IpBlocksPage } from "./pages/IpBlocksPage";
import { SiteIpBlocksPage } from "./pages/SiteIpBlocksPage";
import { SmsPage } from "./pages/SmsPage";
import { PublicFormPage } from "./pages/PublicFormPage";
import { LandingsListPage } from "./pages/LandingsListPage";
import { LandingEditPage } from "./pages/LandingEditPage";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { PublicSitePage, SiteNotFound } from "./pages/PublicSitePage";
import { StatsPage } from "./pages/StatsPage";
import { StatsReportPage } from "./pages/StatsReportPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { AdvertisersPage } from "./pages/AdvertisersPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminUserDetailPage } from "./pages/AdminUserDetailPage";
import { AdvertiserPreviewPage } from "./pages/AdvertiserPreviewPage";
import { AdvertiserLeadsPage } from "./pages/AdvertiserLeadsPage";
import { AdvertiserIntegrationsPage } from "./pages/AdvertiserIntegrationsPage";
import { AdvertiserReportPage } from "./pages/AdvertiserReportPage";
import { AdvertiserGuidePage } from "./pages/AdvertiserGuidePage";
import { ClientLoginPage } from "./pages/ClientLoginPage";
import { ClientResetPasswordPage } from "./pages/ClientResetPasswordPage";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";
import { ProtectedRoute, RoleHomeRedirect } from "./components/ProtectedRoute";
import { ServiceLayout } from "./components/ServiceLayout";
import { Toaster } from "./components/Toaster";
import { currentSubdomain } from "./lib/site";
// 전역 스타일은 main.tsx 의 index.css 진입점에서 모두 로드된다(styles/README.md 참고).

function App() {
  // 사용자 서브도메인({subdomain}.도메인)으로 접속한 경우 → 공개 사이트 전용 라우팅.
  const subdomain = currentSubdomain();
  if (subdomain) {
    return (
      <>
        <Routes>
          <Route path="/:identifier" element={<PublicSitePage subdomain={subdomain} />} />
          {/* 루트(식별자 없음) 및 기타 경로 → 404 (사용자 확정) */}
          <Route path="*" element={<SiteNotFound />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  return (
    <>
    <Routes>
      {/* 사업자 정보 푸터가 붙는 우리 서비스 화면. 범위와 제외 이유는 ServiceLayout 주석 참고. */}
      <Route element={<ServiceLayout />}>
      {/* 루트는 역할에 따라 분기(마케터→대시보드 / 광고주→/client) */}
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      {/* 마케터 비밀번호 재설정(V36) — 비로그인 공개, 가입 휴대폰 인증번호로 본인 확인 */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/*
        공개 회원가입 닫힘 (2026-08-06 사용자 결정 — 운영자가 계정을 직접 관리).
        pages/SignupPage.tsx 는 지우지 않고 남겨둔다 — 다시 열 때 import 와 이 줄만 되돌리면 된다.
        ⚠️ 화면만 막는 것으로는 부족하다. 서버도 app.auth.signup-enabled=false 로 거부한다.
      */}
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      {/* 서비스 소개 — 비로그인 공개(카카오 채널 인증 제출 URL) */}
      <Route path="/about" element={<AboutPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <LeadInboxPage />
          </ProtectedRoute>
        }
      />
      {/* 알림 링크 호환 — 문자·알림톡 본문이 `/leads` 를 가리킨다. 실제 리드 화면은 `/inbox` 다.
          ⚠️ 카카오 알림톡 템플릿은 승인되면 수정할 수 없으므로(버튼 링크가 `/leads/#{url}`)
             앱이 그 주소를 받아주는 쪽으로 맞춘다. `/leads/{값}` 꼴도 함께 흡수한다.
             이 라우트가 없으면 `*` 로 떨어져 대시보드로 튕긴다(2026-08-04 실제 그 상태였다). */}
      <Route path="/leads" element={<Navigate to="/inbox" replace />} />
      <Route path="/leads/*" element={<Navigate to="/inbox" replace />} />
      <Route
        path="/forms"
        element={
          <ProtectedRoute>
            <FormsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/new"
        element={
          <ProtectedRoute>
            <FormEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id/edit"
        element={
          <ProtectedRoute>
            <FormEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consent-docs"
        element={
          <ProtectedRoute>
            <ConsentDocsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consent-docs/new"
        element={
          <ProtectedRoute>
            <ConsentDocEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consent-docs/:id/edit"
        element={
          <ProtectedRoute>
            <ConsentDocEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/html-components"
        element={
          <ProtectedRoute>
            <HtmlComponentsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/html-components/new"
        element={
          <ProtectedRoute>
            <HtmlComponentEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/html-components/:id/edit"
        element={
          <ProtectedRoute>
            <HtmlComponentEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id/leads"
        element={
          <ProtectedRoute>
            <LeadsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:id/ip-blocks"
        element={
          <ProtectedRoute>
            <IpBlocksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landings"
        element={
          <ProtectedRoute>
            <LandingsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landings/new"
        element={
          <ProtectedRoute>
            <LandingEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landings/:id/edit"
        element={
          <ProtectedRoute>
            <LandingEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <StatsPage />
          </ProtectedRoute>
        }
      />
      {/* 인쇄/PDF 저장용 보고서 화면 — 통계 페이지의 [보고서·엑셀] 모달이 새 탭으로 연다 */}
      <Route
        path="/stats/report"
        element={
          <ProtectedRoute>
            <StatsReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/site-ip-blocks"
        element={
          <ProtectedRoute>
            <SiteIpBlocksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sms"
        element={
          <ProtectedRoute>
            <SmsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/advertisers"
        element={
          <ProtectedRoute>
            <AdvertisersPage />
          </ProtectedRoute>
        }
      />
      {/* 운영자 전용 — 계정·문자 권한 관리. 서버는 /api/admin/** 를 ROLE_ADMIN 으로만 열어둔다.
          ⚠️ 지금은 경로로 두고, 나중에 admin 서브도메인 + Cloudflare Access 를 씌울 때
             이 라우트를 그 호스트에 매핑한다(2026-08-05 결정). */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      {/* 계정 상세 — 리드폼·랜딩·리드 읽기 전용 열람(2026-08-19 정책 변경). 리드 열람은 감사 이력에 남는다. */}
      <Route
        path="/admin/users/:id"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminUserDetailPage />
          </ProtectedRoute>
        }
      />
      </Route>
      {/* ↓ 여기부터는 푸터를 붙이지 않는다(ServiceLayout 주석의 제외 목록) */}
      {/* 광고주 미리보기 — 광고주가 실제로 보는 화면과 같아야 하므로 화이트라벨 유지 */}
      <Route
        path="/advertisers/:id/preview"
        element={
          <ProtectedRoute>
            <AdvertiserPreviewPage />
          </ProtectedRoute>
        }
      />
      {/* 광고주 전용 로그인·비밀번호 재설정 (비로그인 공개) */}
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/client/reset/:token" element={<ClientResetPasswordPage />} />
      {/* 광고주 포털 (ROLE_ADVERTISER 전용) */}
      <Route
        path="/client"
        element={
          <ProtectedRoute role="ADVERTISER">
            <AdvertiserLeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/integrations"
        element={
          <ProtectedRoute role="ADVERTISER">
            <AdvertiserIntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/report"
        element={
          <ProtectedRoute role="ADVERTISER">
            <AdvertiserReportPage />
          </ProtectedRoute>
        }
      />
      {/* 광고주 사용 안내(2026-08-08) — 포털 기능 설명 정적 페이지 */}
      <Route
        path="/client/guide"
        element={
          <ProtectedRoute role="ADVERTISER">
            <AdvertiserGuidePage />
          </ProtectedRoute>
        }
      />
      {/* 공개 (비로그인) — 고객의 페이지이므로 우리 사업자 정보를 넣지 않는다 */}
      <Route path="/consent/:id" element={<ConsentViewPage />} />
      <Route path="/f/:id" element={<PublicFormPage />} />
      <Route path="/p/:slug" element={<PublicLandingPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Toaster />
    </>
  );
}

export default App;
