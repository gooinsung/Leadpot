import type { Metadata } from "next";
import "./globals.css";
import { ApiBaseInit } from "../components/ApiBaseInit";

export const metadata: Metadata = {
  title: "Leadpot",
  description: "Leadpot — 랜딩페이지로 상담 DB(리드)를 모으고 관리하는 도구",
};

/**
 * 공개 랜딩 SSR 렌더러 루트 레이아웃. frontend/index.html 의 <head> 와 맞춘다
 * (Pretendard 폰트 — 네트워크 불가 시 시스템 폰트로 자동 대체).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <ApiBaseInit />
        {children}
      </body>
    </html>
  );
}
