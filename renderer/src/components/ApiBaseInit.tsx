"use client";
import { setApiBaseUrl, setAppBaseUrl } from "@leadpot/public-ui";

/**
 * @leadpot/public-ui 는 서버 번들과 브라우저(클라이언트) 번들에 **각각 따로** 포함된다 —
 * 서버 컴포넌트에서 setApiBaseUrl 을 불러도 브라우저 쪽 모듈 인스턴스는 여전히 기본값
 * ("http://localhost:8080")이다. 그래서 클라이언트 쪽도 똑같이 한 번 설정해줘야 한다
 * (LandingView·PublicFormView 가 하이드레이션 뒤 브라우저에서 submitLead·recordVisit 등을 부른다).
 *
 * 모듈 최상단(컴포넌트 함수 밖)에서 실행 — ES 모듈은 트리 안 다른 컴포넌트가 렌더되기 전에
 * import 그래프 순서대로 한 번 평가되므로, LandingView 의 effect 가 API 를 부르기 전에
 * 반드시 먼저 끝나 있다(useEffect 안에 넣으면 실행 순서가 보장되지 않는다).
 */
setApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080");
if (process.env.NEXT_PUBLIC_APP_BASE_URL) {
  setAppBaseUrl(process.env.NEXT_PUBLIC_APP_BASE_URL);
}

/** 렌더 트리에 실제로 넣어 위 모듈 코드가 클라이언트 번들에 확실히 포함되게 한다. 화면엔 아무것도 안 그린다. */
export function ApiBaseInit() {
  return null;
}
