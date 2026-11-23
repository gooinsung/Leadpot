import { Link } from "react-router-dom";
import type { LandingSummary } from "../api/client";

/** 리드폼을 쓰는 랜딩 — 없으면 '미사용', 있으면 랜딩 편집으로 가는 링크(기본 최대 2개 + 외 N개). */
export function FormUsageCell({ landings, loaded, max = 2 }: { landings: LandingSummary[]; loaded: boolean; max?: number }) {
  if (!loaded) return <span className="dash-sub">—</span>;
  if (landings.length === 0) return <span className="dash-sub">미사용</span>;
  const shown = landings.slice(0, max);
  const rest = landings.length - shown.length;
  return (
    <span className="form-usage" title={landings.map((l) => l.title).join("\n")}>
      {shown.map((l, i) => (
        <span key={l.id}>
          {i > 0 && ", "}
          <Link to={`/landings/${l.id}/edit`} onClick={(e) => e.stopPropagation()}>
            {l.title}
          </Link>
          {l.status === "published" && <span className="pill g" style={{ marginLeft: 4 }}>공개</span>}
        </span>
      ))}
      {rest > 0 && <span className="dash-sub"> 외 {rest}개</span>}
    </span>
  );
}
