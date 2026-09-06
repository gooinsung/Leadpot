import type { ConsentItem } from "../../api/client";
import { ConsentItemRow } from "./ConsentItemRow";

/** 동의 항목 렌더(빌더 미리보기) — 체크박스 + 제목(필수/선택) + '보기'. 실제 공개 폼과 같은 방식으로 펼쳐진다. */
export function ConsentView({ config, accent }: { config?: Record<string, unknown> | null; accent?: string }) {
  const items = (config?.items as ConsentItem[]) ?? [];
  if (!items.length) return null;
  return (
    <div className="fr-consent">
      {items.map((it, i) => (
        <ConsentItemRow item={it} key={i}>
          <label className="fr-check">
            <input type="checkbox" defaultChecked={Boolean(it.defaultChecked)} readOnly style={accent ? { accentColor: accent } : undefined} /> {it.title}{" "}
            <span className={it.required ? "req" : "field-optional"}>({it.required ? "필수" : "선택"})</span>
          </label>
        </ConsentItemRow>
      ))}
    </div>
  );
}
