import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
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
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { AdvertisersPage } from "./pages/AdvertisersPage";
import { AdvertiserPreviewPage } from "./pages/AdvertiserPreviewPage";
import { AdvertiserLeadsPage } from "./pages/AdvertiserLeadsPage";
import { AdvertiserIntegrationsPage } from "./pages/AdvertiserIntegrationsPage";
import { AdvertiserReportPage } from "./pages/AdvertiserReportPage";
import { ClientLoginPage } from "./pages/ClientLoginPage";
import { ClientResetPasswordPage } from "./pages/ClientResetPasswordPage";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";
import { ProtectedRoute, RoleHomeRedirect } from "./components/ProtectedRoute";
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
      {/* 루트는 역할에 따라 분기(마케터→대시보드 / 광고주→/client) */}
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
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
      {/* 공개 (비로그인) */}
      <Route path="/about" element={<AboutPage />} />
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
