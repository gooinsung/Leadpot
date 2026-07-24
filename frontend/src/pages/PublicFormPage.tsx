import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicForm, recordVisit, type FormDetail } from "../api/client";
import { parseUtm } from "../lib/utm";
import { initPixels } from "../lib/pixels";
import { PublicFormView } from "../components/PublicFormView";

/** 리드폼 단독 공개 페이지 (/f/{id}). 모바일 최적화된 카드 안에 실제 제출 가능한 리드폼을 렌더. */
export function PublicFormPage() {
  const { id } = useParams();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [error, setError] = useState("");
  const visited = useRef(false);

  useEffect(() => {
    getPublicForm(Number(id))
      .then((f) => {
        setForm(f);
        if (!visited.current) {
          visited.current = true;
          recordVisit({ formId: f.id, utm: parseUtm() });
          initPixels(f.trackingConfig);
        }
      })
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
  if (!form) return <div className="page-loading">불러오는 중…</div>;

  return (
    <div className="public-form">
      <div className="public-form-card">
        <PublicFormView form={form} trackingConfig={form.trackingConfig} />
      </div>
    </div>
  );
}
