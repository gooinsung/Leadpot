import type { ConsentItem } from "../../api/client";

/** 동의 항목 렌더 — 체크박스 + 제목(필수/선택) + '보기' 링크(외부 URL / 내부 동의문서). */
export function ConsentView({ config, accent }: { config?: Record<string, unknown> | null; accent?: string }) {
  const items = (config?.items as ConsentItem[]) ?? [];
  if (!items.length) return null;
  return (
    <div className="fr-consent">
      {items.map((it, i) => (
        <div className="fr-consent-row" key={i}>
          <label className="fr-check">
            <input type="checkbox" defaultChecked={Boolean(it.defaultChecked)} readOnly style={accent ? { accentColor: accent } : undefined} /> {it.title}{" "}
            <span className={it.required ? "req" : "field-optional"}>({it.required ? "필수" : "선택"})</span>
          </label>
          {linkHref(it) && (
            <a className="fr-view-link" href={linkHref(it)!} target="_blank" rel="noreferrer">
              보기
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function linkHref(it: ConsentItem): string | null {
  if (it.linkType === "external" && it.url) return it.url;
  if (it.linkType === "document" && it.documentId) return `/consent/${it.documentId}`;
  return null;
}
