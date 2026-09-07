"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicForm, PublicFormPageView, type FormDetail } from "@leadpot/public-ui";

/**
 * SSR 실패 시 SPA 셸로 자동 폴백 — `site/[subdomain]/[identifier]/error.tsx` 와 같은 이유·같은
 * 패턴(§5-5, docs/SSR-LANDING-PLAN.md). 진짜 404(미존재/IP차단)는 여기로 오지 않고 `notFound()` 로
 * 처리되며, 그 밖의 진짜 실패(백엔드 장애 등)일 때만 여기서 브라우저가 직접 재요청해 복구한다.
 */
export default function PublicFormError({ error }: { error: Error & { digest?: string } }) {
  const params = useParams<{ identifier: string }>();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[renderer] 공개 폼 SSR 실패, 클라이언트 폴백으로 전환:", error);
    const identifier = Array.isArray(params.identifier) ? params.identifier[0] : params.identifier;
    const id = Number(identifier);
    if (!Number.isFinite(id)) {
      setFailed(true);
      return;
    }
    getPublicForm(id)
      .then(setForm)
      .catch(() => setFailed(true));
  }, [error, params]);

  if (failed) {
    return (
      <div className="public-form">
        <div className="public-form-card">
          <p className="auth-error">리드폼을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="public-form">
        <div className="public-form-card">
          <p>불러오는 중…</p>
        </div>
      </div>
    );
  }

  return <PublicFormPageView form={form} />;
}
