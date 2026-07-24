import { useEffect } from "react";

/**
 * 저장하지 않은 변경이 있을 때(when=true) 페이지 이탈(새로고침/탭닫기/주소이동) 시
 * 브라우저 기본 "변경 사항이 저장되지 않을 수 있습니다" 경고를 띄운다.
 */
export function useUnsavedGuard(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
