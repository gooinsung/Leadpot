import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FormsListPage } from "./pages/FormsListPage";
import { FormEditPage } from "./pages/FormEditPage";
import { ConsentDocsListPage } from "./pages/ConsentDocsListPage";
import { ConsentDocEditPage } from "./pages/ConsentDocEditPage";
import { ConsentViewPage } from "./pages/ConsentViewPage";
import { LeadsListPage } from "./pages/LeadsListPage";
import { IpBlocksPage } from "./pages/IpBlocksPage";
import { PublicFormPage } from "./pages/PublicFormPage";
import { LandingsListPage } from "./pages/LandingsListPage";
import { LandingEditPage } from "./pages/LandingEditPage";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { PublicSitePage, SiteNotFound } from "./pages/PublicSitePage";
import { StatsPage } from "./pages/StatsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { currentSubdomain } from "./lib/site";
import "./App.css";

function App() {
  // 사용자 서브도메인({subdomain}.도메인)으로 접속한 경우 → 공개 사이트 전용 라우팅.
  const subdomain = currentSubdomain();
  if (subdomain) {
    return (
      <Routes>
        <Route path="/:identifier" element={<PublicSitePage subdomain={subdomain} />} />
        {/* 루트(식별자 없음) 및 기타 경로 → 404 (사용자 확정) */}
        <Route path="*" element={<SiteNotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
      {/* 공개 (비로그인) */}
      <Route path="/consent/:id" element={<ConsentViewPage />} />
      <Route path="/f/:id" element={<PublicFormPage />} />
      <Route path="/p/:slug" element={<PublicLandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
