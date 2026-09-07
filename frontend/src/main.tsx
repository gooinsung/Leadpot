import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { setAppBaseUrl } from "@leadpot/public-ui";
import { AuthProvider } from "./lib/auth";
import "./index.css";
import App from "./App.tsx";

// consentDocUrl 등이 앱 도메인 절대 URL을 만들 때 쓴다(site.ts 주석 참고) — Vite 전용
// import.meta.env 를 여기(진입점)에서만 읽고 공용 패키지에는 넣지 않는다.
if (import.meta.env.VITE_APP_BASE_URL) setAppBaseUrl(import.meta.env.VITE_APP_BASE_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
