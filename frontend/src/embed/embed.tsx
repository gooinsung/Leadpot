import { createRoot } from "react-dom/client";
import { getPublicForm, recordVisit } from "../api/client";
import { PublicFormView } from "../components/PublicFormView";
import { initPixels } from "../lib/pixels";
import { parseUtm } from "../lib/utm";
// 스타일 레이어를 개별 인라인으로 가져온다(구조: styles/README.md).
// tokens 만 :root→:host 로 치환하므로 따로 두고, 나머지는 그대로 이어붙인다.
import tokensCss from "../styles/tokens.css?inline";
import baseCss from "../styles/base.css?inline";
import componentsCss from "../styles/components.css?inline";
import layoutCss from "../styles/layout.css?inline";
import authCss from "../styles/features/auth.css?inline";
import statsCss from "../styles/features/stats.css?inline";
import formBuilderCss from "../styles/features/form-builder.css?inline";
import landingCss from "../styles/features/landing.css?inline";
import publicCss from "../styles/features/public.css?inline";
import leadsCss from "../styles/features/leads.css?inline";
import advertiserCss from "../styles/features/advertiser.css?inline";
import calculatorCss from "../styles/features/calculator.css?inline";

/**
 * 외부 사이트 임베드(M6) 진입점 — 자립 스크립트로 빌드된다(vite.embed.config.ts, IIFE).
 * 사용법(임베드 코드):
 *   <div data-leadpot-form="{리드폼번호}"></div>
 *   <script src="https://app.도메인/embed.js" async></script>
 *
 * 각 컨테이너에 Shadow DOM 을 붙이고 그 안에 공개 폼(PublicFormView)을 렌더한다.
 * Shadow DOM 으로 대상 사이트의 CSS 와 완전히 격리된다. iframe 을 쓰지 않는다.
 */
const ATTR = "data-leadpot-form";

// tokens.css 는 :root 에 CSS 변수를 정의 → Shadow DOM 에선 :host 로 매핑해야 변수가 트리에 적용된다.
// base.css 의 타이포 기준은 body 에 있으나 Shadow 루트엔 body 가 없으므로 래퍼(.lp-embed)에 다시 준다.
const SHADOW_CSS = [
  tokensCss.replace(/:root/g, ":host"),
  baseCss,
  componentsCss,
  layoutCss,
  authCss,
  statsCss,
  formBuilderCss,
  landingCss,
  publicCss,
  leadsCss,
  advertiserCss,
  calculatorCss,
  `.lp-embed{display:block;width:100%;font-family:var(--sans);color:var(--text);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;}
   .lp-embed .public-form-card{min-height:0;max-width:100%;}`,
].join("\n");

function mountOne(el: HTMLElement) {
  const formId = Number(el.getAttribute(ATTR));
  if (!formId || el.getAttribute("data-lp-mounted") === "1") return;
  el.setAttribute("data-lp-mounted", "1");

  const shadow = el.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);
  const root = document.createElement("div");
  root.className = "lp-embed";
  shadow.appendChild(root);

  getPublicForm(formId)
    .then((form) => {
      // 임베드는 iframe 이 아니라 Shadow DOM 이라 location 이 고객 사이트 URL 이다 → 파라미터가 잡힌다.
      recordVisit({ formId: form.id, utm: parseUtm() });
      initPixels(form.trackingConfig);
      createRoot(root).render(
        // "public-form" 클래스가 있어야 public.css 의 라이트 고정(color-scheme: light)이 걸린다 —
        // 없으면 고객 사이트 방문자의 기기가 다크모드일 때 관리자 앱용 다크 팔레트가 새어 들어온다.
        <div className="public-form public-form-card">
          <PublicFormView form={form} trackingConfig={form.trackingConfig} />
        </div>,
      );
    })
    .catch(() => {
      root.textContent = "리드폼을 불러오지 못했습니다.";
    });
}

function init() {
  document.querySelectorAll<HTMLElement>(`[${ATTR}]`).forEach(mountOne);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
