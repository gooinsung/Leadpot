import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// 외부 임베드용 자립 스크립트(embed.js) 빌드 — 단일 IIFE 로 React+폼을 번들.
// 메인 앱 빌드(vite build)와 별개로 실행하며, 같은 dist 에 embed.js 를 추가한다(emptyOutDir=false).
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/embed/embed.tsx"),
      name: "LeadpotEmbed",
      formats: ["iife"],
      fileName: () => "embed.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
