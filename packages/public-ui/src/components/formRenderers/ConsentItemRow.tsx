import { useState, type ReactNode } from "react";
import { getPublicConsentDoc, type ConsentDocument, type ConsentItem } from "../../api/client";
import { consentDocUrl } from "../../lib/site";

/**
 * 동의 항목 한 줄 — 체크박스(children) + '보기'. 공개 폼과 빌더 미리보기가 함께 쓴다.
 *
 * <p>내부 동의문서(linkType=document)는 **새 페이지로 보내지 않고 그 자리에서 펼친다.**
 * 폼을 채우던 도중 다른 페이지로 이동하면 입력하던 값이 사라져 그대로 이탈로 이어지기 때문이다
 * (모바일에서 특히 심하다 — 뒤로가기로 돌아와도 처음부터 다시 쓴다).
 *
 * <p>외부 URL(linkType=external)은 우리가 내용을 가져올 수 없으므로 예전처럼 새 탭으로 연다.
 */
export function ConsentItemRow({ item, children }: { item: ConsentItem; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<ConsentDocument | null>(null);
  const [error, setError] = useState("");
  const documentId = item.linkType === "document" ? item.documentId ?? null : null;

  function toggle() {
    const next = !open;
    setOpen(next);
    // 처음 펼칠 때만 불러온다(닫았다 다시 열면 이미 받아둔 내용을 그대로 쓴다).
    if (!next || doc || documentId == null) return;
    setError("");
    getPublicConsentDoc(documentId)
      .then(setDoc)
      .catch(() => setError("문서를 불러오지 못했습니다."));
  }

  return (
    <div className="fr-consent-item">
      <div className="fr-consent-row">
        {children}
        {item.linkType === "external" && item.url && (
          <a className="fr-view-link" href={item.url} target="_blank" rel="noreferrer">
            보기
          </a>
        )}
        {documentId != null && (
          <button type="button" className="fr-view-link" aria-expanded={open} onClick={toggle}>
            {open ? "닫기" : "보기"}
          </button>
        )}
      </div>
      {open && documentId != null && (
        <div className="fr-consent-doc">
          {error ? (
            <p className="fr-consent-doc-msg">
              {error}{" "}
              <a href={consentDocUrl(documentId)} target="_blank" rel="noreferrer">
                새 창에서 보기
              </a>
            </p>
          ) : !doc ? (
            <p className="fr-consent-doc-msg">불러오는 중…</p>
          ) : (
            <div className="consent-doc-body" dangerouslySetInnerHTML={{ __html: doc.content }} />
          )}
        </div>
      )}
    </div>
  );
}
