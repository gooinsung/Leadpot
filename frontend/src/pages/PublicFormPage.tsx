import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useParams } from "react-router-dom";
import { getPublicForm, type FormDetail } from "../api/client";
import { PublicFormPageView } from "@leadpot/public-ui";

/**
 * 리드폼 단독 공개 페이지 (/f/{id}).
 * ⚠️ 운영에서는 이 라우트에 실제로 도달하지 않는다 — `app.lead-pot.com/f/*` 는 렌더러가
 * SSR 로 먼저 처리한다(`renderer/src/proxy.ts`, 2026-09-08). 이 라우트는 로컬 개발(`npm run dev`,
 * 렌더러 없이 frontend 만 띄웠을 때)과 만약을 위한 이중 방어선으로 남겨둔다.
 */
export function PublicFormPage() {
  const { id } = useParams();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicForm(Number(id))
      .then(setForm)
      .catch(() => setError("리드폼을 찾을 수 없습니다."));
  }, [id]);

  if (error)
    return (
      <div className="public-form">
        <div className="public-form-card">
          <p className="auth-error">{error}</p>
        </div>
      </div>
    );
  if (!form) return <Loading full />;

  return <PublicFormPageView form={form} />;
}
