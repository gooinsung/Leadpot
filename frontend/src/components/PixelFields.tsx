import type { ChangeEvent } from "react";

const PLATFORMS: { key: string; label: string; ph: string }[] = [
  { key: "google", label: "구글 (Google Ads / GA4)", ph: "예: G-XXXXXXX 또는 AW-XXXXXXXXX" },
  { key: "meta", label: "메타 (페이스북/인스타) 픽셀 ID", ph: "예: 123456789012345" },
  { key: "tiktok", label: "틱톡 픽셀 ID", ph: "예: CXXXXXXXXXXXXXXXXXXX" },
  { key: "kakao", label: "카카오 픽셀 ID", ph: "예: 1234567890123456789" },
  { key: "daangn", label: "당근 픽셀 ID", ph: "당근 비즈니스 픽셀 ID" },
];

/** 광고 픽셀 ID 입력(구글·메타·틱톡·카카오·당근). value/onChange 로 상위 tracking 상태와 연결. */
export function PixelFields({
  value,
  onChange,
}: {
  value?: Record<string, unknown> | null;
  onChange: (next: Record<string, string>) => void;
}) {
  const v = (value ?? {}) as Record<string, unknown>;
  const get = (k: string) => (v[k] == null ? "" : String(v[k]));

  function set(key: string, val: string) {
    const next: Record<string, string> = {};
    for (const p of PLATFORMS) next[p.key] = p.key === key ? val : get(p.key);
    onChange(next);
  }

  return (
    <div>
      {PLATFORMS.map((p) => (
        <div className="field" key={p.key}>
          <label>{p.label}</label>
          <input
            className="input"
            value={get(p.key)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set(p.key, e.target.value)}
            placeholder={p.ph}
            spellCheck={false}
            autoCapitalize="none"
          />
        </div>
      ))}
      <p className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
        입력한 픽셀은 공개 페이지에 삽입되어 방문(PageView)과 리드 제출 시 전환(Lead)을 각 플랫폼에 전송합니다.
        전환 귀속은 각 플랫폼이 광고 클릭 기준으로 자체 판단하므로 여러 개를 동시에 넣어도 됩니다. 비워두면 미사용.
      </p>
    </div>
  );
}
