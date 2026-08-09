import type { ChangeEvent } from "react";

const PLATFORMS: { key: string; label: string; ph: string }[] = [
  { key: "google", label: "구글 (GA4 측정ID / Google Ads ID)", ph: "예: G-XXXXXXX 또는 AW-XXXXXXXXX" },
  { key: "googleAds", label: "구글 Ads 전환 (선택)", ph: "예: AW-17818553855/R3jqCMa2mZccEP-bxrBC" },
  { key: "meta", label: "메타 (페이스북/인스타) 픽셀 ID", ph: "예: 123456789012345" },
  { key: "tiktok", label: "틱톡 픽셀 ID", ph: "예: CXXXXXXXXXXXXXXXXXXX" },
  { key: "kakao", label: "카카오 픽셀 ID", ph: "예: 1234567890123456789" },
  { key: "daangn", label: "당근 픽셀 ID", ph: "당근 비즈니스 픽셀 ID" },
];

/**
 * 당근 전환 이벤트 — 리드 제출 시 발사할 이벤트를 고른다.
 * 당근 광고 관리자에서 잡고 싶은 전환 유형에 맞춰야 한다(안 맞으면 엉뚱한 전환으로 집계된다).
 */
export const DAANGN_EVENTS: { value: string; label: string }[] = [
  { value: "Purchase", label: "구매 (Purchase)" },
  { value: "Lead", label: "잠재고객 수집 (Lead)" },
  { value: "SubmitApplication", label: "서비스 신청 (SubmitApplication)" },
];
/** 미설정 리드폼의 기본 전환 이벤트. pixels.ts 의 기본값과 반드시 같아야 한다. */
export const DAANGN_EVENT_DEFAULT = "Purchase";

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
    // 기존 값을 먼저 펼친다 — PLATFORMS 에 없는 키(daangnEvent 등)가 저장에서 사라지지 않게.
    const next: Record<string, string> = {};
    for (const k of Object.keys(v)) next[k] = get(k);
    for (const p of PLATFORMS) next[p.key] = get(p.key);
    next[key] = val;
    onChange(next);
  }

  return (
    <div>
      {PLATFORMS.map((p) => (
        <div key={p.key}>
          <div className="field">
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
          {/* 당근만 전환 이벤트를 고를 수 있다 — 다른 플랫폼은 표준 전환 이벤트가 하나로 정해져 있다. */}
          {p.key === "daangn" && (
            <div className="field">
              <label>당근 전환 이벤트</label>
              <select
                className="input"
                value={get("daangnEvent") || DAANGN_EVENT_DEFAULT}
                onChange={(e) => set("daangnEvent", e.target.value)}
              >
                {DAANGN_EVENTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="field-optional" style={{ marginTop: 4 }}>
                리드 제출 시 당근에 보낼 전환 이벤트입니다. <b>당근 광고 관리자에서 설정한 전환 유형과 같아야</b> 성과로 잡힙니다.
              </span>
            </div>
          )}
        </div>
      ))}
      <p className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
        입력한 픽셀은 공개 페이지에 삽입되어 방문(PageView)과 리드 제출 시 전환(Lead)을 각 플랫폼에 전송합니다.
        전환 귀속은 각 플랫폼이 광고 클릭 기준으로 자체 판단하므로 여러 개를 동시에 넣어도 됩니다. 비워두면 미사용.
        <br />
        <b>구글 Ads 전환</b>: Google Ads 전환 스니펫의 <code>send_to</code> 값(<code>AW-전환ID/전환라벨</code>)을 붙여넣으세요.
        스니펫 전체를 붙여넣어도 값만 자동 추출합니다. 리드 제출 시 <code>conversion</code> 이벤트로 발사됩니다.
      </p>
    </div>
  );
}
