import { useEffect, useState, type ChangeEvent } from "react";

const PLATFORMS: { key: string; label: string; ph: string }[] = [
  { key: "google", label: "구글 (GA4 측정ID / Google Ads ID)", ph: "예: G-XXXXXXX 또는 AW-XXXXXXXXX" },
  { key: "googleAds", label: "구글 Ads 전환", ph: "예: AW-17818553855/R3jqCMa2mZccEP-bxrBC" },
  { key: "meta", label: "메타 (페이스북/인스타) 픽셀 ID", ph: "예: 123456789012345" },
  { key: "tiktok", label: "틱톡 픽셀 ID", ph: "예: CXXXXXXXXXXXXXXXXXXX" },
  { key: "kakao", label: "카카오 픽셀 ID", ph: "예: 1234567890123456789" },
  { key: "daangn", label: "당근 픽셀 ID", ph: "당근 비즈니스 픽셀 ID" },
];

/** 칩에 쓸 짧은 이름 — 위 label 은 입력칸용이라 길다. */
const SHORT: Record<string, string> = {
  google: "구글",
  googleAds: "구글 Ads 전환",
  meta: "메타",
  tiktok: "틱톡",
  kakao: "카카오",
  daangn: "당근",
};

/**
 * 메타 전환 이벤트 — 리드 제출 시 발사할 표준 이벤트.
 * 상담·문의형 전환에 쓰이는 것만 담았다. Purchase 는 value·currency 파라미터가 필요해
 * 빈 값으로 쏘면 경고가 나므로 넣지 않았다.
 */
export const META_EVENTS: { value: string; label: string }[] = [
  { value: "Lead", label: "잠재고객 (Lead)" },
  { value: "CompleteRegistration", label: "가입 완료 (CompleteRegistration)" },
  { value: "SubmitApplication", label: "신청서 제출 (SubmitApplication)" },
  { value: "Contact", label: "문의 (Contact)" },
  { value: "Schedule", label: "예약 (Schedule)" },
];
/** 미설정 리드폼의 기본 메타 전환 이벤트. pixels.ts 기본값과 반드시 같아야 한다. */
export const META_EVENT_DEFAULT = "Lead";

/**
 * 당근 전환 이벤트 — 당근 광고 관리자에서 잡고 싶은 전환 유형에 맞춰야 한다.
 * 안 맞으면 엉뚱한 전환으로 집계된다.
 */
export const DAANGN_EVENTS: { value: string; label: string }[] = [
  { value: "Purchase", label: "구매 (Purchase)" },
  { value: "Lead", label: "잠재고객 수집 (Lead)" },
  { value: "SubmitApplication", label: "서비스 신청 (SubmitApplication)" },
];
/** 미설정 리드폼의 기본 당근 전환 이벤트. pixels.ts 기본값과 반드시 같아야 한다. */
export const DAANGN_EVENT_DEFAULT = "Purchase";

/** 전환 이벤트를 고를 수 있는 플랫폼만 여기 둔다(나머지는 표준 이벤트가 하나로 고정). */
const EVENT_PICKERS: Record<string, { field: string; label: string; options: typeof META_EVENTS; def: string; help: string }> = {
  meta: {
    field: "metaEvent",
    label: "메타 전환 이벤트",
    options: META_EVENTS,
    def: META_EVENT_DEFAULT,
    help: "리드 제출 시 메타에 보낼 표준 이벤트입니다. 광고 세트의 최적화 이벤트와 같아야 성과로 잡힙니다.",
  },
  daangn: {
    field: "daangnEvent",
    label: "당근 전환 이벤트",
    options: DAANGN_EVENTS,
    def: DAANGN_EVENT_DEFAULT,
    help: "리드 제출 시 당근에 보낼 전환 이벤트입니다. 당근 광고 관리자에서 설정한 전환 유형과 같아야 성과로 잡힙니다.",
  },
};

/**
 * 광고 픽셀 설정 — 쓸 플랫폼만 골라 입력한다.
 * 값이 들어 있는 플랫폼은 자동으로 선택된 상태로 표시되고, 선택을 끄면 그 값은 지워진다(미사용).
 */
export function PixelFields({
  value,
  onChange,
}: {
  value?: Record<string, unknown> | null;
  onChange: (next: Record<string, string>) => void;
}) {
  const v = (value ?? {}) as Record<string, unknown>;
  const get = (k: string) => (v[k] == null ? "" : String(v[k]));

  // 값이 있는 플랫폼은 선택됨으로 본다. 폼 데이터가 나중에 도착하므로 effect 로 맞춘다.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const p of PLATFORMS) if (get(p.key)) next.add(p.key);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /** 기존 값을 보존한 채 한 키만 바꾼다 — PLATFORMS 밖의 키(metaEvent 등)가 사라지지 않게. */
  function patch(changes: Record<string, string>) {
    const next: Record<string, string> = {};
    for (const k of Object.keys(v)) next[k] = get(k);
    for (const p of PLATFORMS) next[p.key] = get(p.key);
    Object.assign(next, changes);
    onChange(next);
  }

  function toggle(key: string) {
    const on = picked.has(key);
    const next = new Set(picked);
    if (on) {
      next.delete(key);
      // 선택을 끄면 값도 비운다 — 화면에서 사라진 값이 조용히 남아 발사되면 안 된다.
      const clear: Record<string, string> = { [key]: "" };
      const picker = EVENT_PICKERS[key];
      if (picker) clear[picker.field] = "";
      patch(clear);
    } else {
      next.add(key);
    }
    setPicked(next);
  }

  return (
    <div>
      <div className="field">
        <label>사용할 픽셀 선택</label>
        <div className="pixel-chips">
          {PLATFORMS.map((p) => (
            <label key={p.key} className={`pixel-chip${picked.has(p.key) ? " on" : ""}`}>
              <input type="checkbox" checked={picked.has(p.key)} onChange={() => toggle(p.key)} />
              <span>{SHORT[p.key]}</span>
            </label>
          ))}
        </div>
        <span className="field-optional" style={{ marginTop: 6 }}>
          쓸 플랫폼만 고르세요. 여러 개를 동시에 켜도 됩니다 — 전환 귀속은 각 플랫폼이 광고 클릭 기준으로 자체 판단합니다.
        </span>
      </div>

      {PLATFORMS.filter((p) => picked.has(p.key)).map((p) => {
        const picker = EVENT_PICKERS[p.key];
        return (
          <div className="pixel-box" key={p.key}>
            <div className="field" style={{ marginBottom: picker ? 12 : 0 }}>
              <label>{p.label}</label>
              <input
                className="input"
                value={get(p.key)}
                onChange={(e: ChangeEvent<HTMLInputElement>) => patch({ [p.key]: e.target.value })}
                placeholder={p.ph}
                spellCheck={false}
                autoCapitalize="none"
              />
              {p.key === "googleAds" && (
                <span className="field-optional" style={{ marginTop: 4 }}>
                  Google Ads 전환 스니펫의 <code>send_to</code> 값(<code>AW-전환ID/전환라벨</code>)을 붙여넣으세요.
                  스니펫 전체를 붙여넣어도 값만 자동 추출합니다.
                </span>
              )}
            </div>
            {picker && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{picker.label}</label>
                <select
                  className="input"
                  value={get(picker.field) || picker.def}
                  onChange={(e) => patch({ [picker.field]: e.target.value })}
                >
                  {picker.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="field-optional" style={{ marginTop: 4 }}>{picker.help}</span>
              </div>
            )}
          </div>
        );
      })}

      <p className="dash-sub" style={{ fontSize: 12, marginTop: 10 }}>
        선택한 픽셀은 공개 페이지에 삽입되어 <b>방문(PageView)</b>과 <b>리드 제출 시 전환</b>을 각 플랫폼에 전송합니다.
        전환 이벤트를 고를 수 있는 곳은 메타·당근뿐입니다 — 구글은 <code>generate_lead</code>(+Ads 전환라벨),
        틱톡은 <code>SubmitForm</code>, 카카오는 가입완료로 고정 전송됩니다.
        <br />
        ⚠️ 미리보기 주소(<code>/p/…</code>)에서는 픽셀이 발사되지 않습니다. 테스트는 공개 URL에서 하세요.
      </p>
    </div>
  );
}
