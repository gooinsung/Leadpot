// @leadpot/public-ui — 공개 랜딩·리드폼 렌더링 공용 패키지.
// frontend(관리앱·/f/{id}·서브도메인 미리보기·임베드)와 renderer(SSR 공개 랜딩)가 함께 쓴다.
// 두 앱이 같은 컴포넌트를 쓰게 해 "크롤러가 보는 화면 ≠ 실사용자가 보는 화면" 드리프트를 막는다.
// (docs/SSR-LANDING-PLAN.md §5-2)

export * from "./api/client";

export { LandingView } from "./components/LandingView";
export { PublicFormView } from "./components/PublicFormView";
export { HtmlBlock } from "./components/HtmlBlock";
export { PhoneInput3 } from "./components/PhoneInput3";

export { ConsentItemRow } from "./components/formRenderers/ConsentItemRow";
export { CompletionView } from "./components/formRenderers/CompletionView";
export { CalcFollowUp, CalcGateView, CalcLoadingView, CalcResultView } from "./components/formRenderers/CalcResultView";
export {
  DEFAULT_SUBMIT_LABEL,
  descEmphasisClass,
  descEmphasisLevel,
  isChoiceAnswerType,
  isMultiAnswerType,
  resolveStyle,
  resolveSubmitLabel,
  textOn,
  type DescEmphasis,
  type ResolvedStyle,
} from "./components/formRenderers/formStyle";

export { parseUtm } from "./lib/utm";
export { initPixels, firePixelLead, type PixelConfig } from "./lib/pixels";
export { currentSubdomain, appBaseUrl, consentDocUrl, publicSiteUrl } from "./lib/site";
export { findCalculator, CALCULATORS } from "./lib/calculators/registry";
export type { CalcView, CalculatorDef } from "./lib/calculators/types";
