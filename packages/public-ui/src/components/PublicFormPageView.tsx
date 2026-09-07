"use client";
import { useEffect, useRef } from "react";
import { recordVisit, type FormDetail } from "../api/client";
import { initPixels } from "../lib/pixels";
import { parseUtm } from "../lib/utm";
import { PublicFormView } from "./PublicFormView";

/**
 * 단독 공개 리드폼 페이지(`/f/{id}`)의 렌더 + 방문 기록 + 픽셀 초기화를 한데 묶은 컴포넌트.
 * frontend(CSR, React Router `/f/:id`)와 renderer(SSR, `app/f/[identifier]/page.tsx`)가
 * 같이 쓴다 — 크롤러가 보는 화면과 실사용자가 보는 화면이 갈라지지 않게 하기 위함
 * (docs/SSR-LANDING-PLAN.md §5-2 와 같은 이유로 `/f/{id}` 도 SSR 범위에 포함, 2026-09-08).
 *
 * 방문 기록(`recordVisit`)·픽셀 초기화(`initPixels`)는 브라우저에서만 의미가 있어(방문자 통계·
 * 광고 픽셀은 실제 브라우저 세션 기준) `useEffect` 로 마운트 시 1회만 실행한다 — SSR 이든 CSR 이든
 * 이 컴포넌트가 하이드레이션된 뒤 브라우저에서 실행되는 건 동일하다.
 */
export function PublicFormPageView({ form }: { form: FormDetail }) {
  const visited = useRef(false);

  useEffect(() => {
    if (visited.current) return;
    visited.current = true;
    recordVisit({ formId: form.id, utm: parseUtm() });
    initPixels(form.trackingConfig);
  }, [form.id, form.trackingConfig]);

  return (
    <div className="public-form">
      <div className="public-form-card">
        <PublicFormView form={form} trackingConfig={form.trackingConfig} />
      </div>
    </div>
  );
}
