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
import { PublicFormPage } from "./pages/PublicFormPage";
import { LandingsListPage } from "./pages/LandingsListPage";
import { LandingEditPage } from "./pages/LandingEditPage";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { StatsPage } from "./pages/StatsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import "./App.css";

function App() {
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
