import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useParams } from "react-router-dom";
import { getPublicConsentDoc, type ConsentDocument } from "../api/client";

/** 동의 문서 공개 뷰(/consent/:id) — 비로그인. 리드폼의 '보기' 링크가 여는 페이지. */
export function ConsentViewPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<ConsentDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicConsentDoc(Number(id))
      .then(setDoc)
      .catch(() => setError("문서를 찾을 수 없습니다."));
  }, [id]);

  return (
    <div className="consent-view">
      <div className="consent-view-inner">
        {error ? (
          <p className="auth-error">{error}</p>
        ) : !doc ? (
          <Loading />
        ) : (
          <>
            <h1 className="consent-view-title">{doc.title}</h1>
            <div className="consent-doc-body" dangerouslySetInnerHTML={{ __html: doc.content }} />
          </>
        )}
      </div>
    </div>
  );
}
