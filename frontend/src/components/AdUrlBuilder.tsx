import { useMemo, useState } from "react";
import { toast } from "../lib/toast";
import { AD_PARAM_KEYS, buildAdUrl, type AdParamKey } from "../lib/adUrl";

/**
 * 광고 URL 빌더 (모달).
 *
 * 광고 매체별로 랜딩 주소를 나눠 만들지 않고, **URL 뒤에 파라미터를 붙여** 어디서 접수된
 * 리드인지 구분한다. 여기서 만든 주소로 들어온 방문·리드에는 아래 3개 값이 함께 저장되고
 * 리드 상세 패널과 CSV 내보내기에 그대로 표시된다(`lib/utm.ts` → `TrackingParams`).
 *
 * **입력값을 저장하지 않는다** — 만들어서 복사하는 도구다(사용자 결정 2026-08-18).
 * 그래서 API 호출도, 서버 상태도 없다.
 *
 * ⚠️ 파라미터 이름을 바꾸려면 `lib/utm.ts` 와 백엔드 `TrackingParams.ALLOWED_KEYS` 를
 * **함께** 고쳐야 한다. 여기만 고치면 값이 URL 에는 붙지만 저장되지 않는다.
 */

/**
 * 항목별 표시 문구. 키 자체는 `lib/adUrl.ts` 가 갖는다 —
 * 여기서 키를 또 적으면 두 곳이 어긋날 수 있다(순서도 그쪽을 따른다).
 */
const LABELS: Record<AdParamKey, { label: string; placeholder: string; hint: string }> = {
  media_from: {
    label: "광고 매체",
    placeholder: "meta",
    hint: "광고를 집행하는 매체. 통계에서 매체별로 묶인다.",
  },
  campaign_name: {
    label: "캠페인 이름",
    placeholder: "summer-sale",
    hint: "묶어서 보고 싶은 단위. 매체 계정의 캠페인 이름과 맞추면 대조하기 쉽다.",
  },
  ads_name: {
    label: "광고 이름",
    placeholder: "banner-a",
    hint: "소재·광고 단위. 어떤 소재가 잘 먹히는지 볼 때 쓴다.",
  },
};

/**
 * 매체 이름 빠른 선택.
 *
 * **왜 필요한가**: 손으로 적으면 `danggun`·`dangn`·`당근` 으로 갈려서 통계가 쪼개진다.
 * 한 번 오타가 나면 나중에 되돌릴 방법이 없다(이미 접수된 리드에 그 값이 박힌다).
 * 자유 입력도 계속 가능하다 — 목록에 없는 매체를 쓸 수 있어야 하므로 강제하지 않는다.
 */
const MEDIA_PRESETS = ["meta", "google", "danggun", "kakao", "naver", "tiktok", "toss"];

type Values = Partial<Record<AdParamKey, string>>;

export function AdUrlBuilder({
  baseUrl,
  title,
  onClose,
}: {
  /** 파라미터를 붙일 원본 주소(공개 랜딩 URL). */
  baseUrl: string;
  /** 모달 머리말에 보여줄 대상 이름(랜딩 제목). */
  title: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Values>({});

  const url = useMemo(() => buildAdUrl(baseUrl, values), [baseUrl, values]);

  const hasParams = url !== baseUrl;

  function set(key: AdParamKey, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("광고 URL을 복사했습니다.");
    } catch {
      // 클립보드 권한이 없거나 http 로 접속한 경우 — 주소는 화면에 있으니 직접 복사하면 된다.
      toast.error("복사에 실패했습니다. 주소를 직접 선택해 복사해주세요.");
    }
  }

  return (
    <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card lead-modal adurl-modal" role="dialog" aria-modal="true" aria-label="광고 URL 만들기">
        <div className="lead-modal-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              광고 URL 만들기
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{title}</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="lead-modal-body">
          <p className="dash-sub" style={{ marginTop: 0 }}>
            매체별로 다른 주소를 만들어 광고에 넣으면, 접수된 리드에 어디서 왔는지 함께 저장됩니다. 비워둔 항목은 주소에
            붙지 않습니다.
          </p>

          {AD_PARAM_KEYS.map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`adurl-${key}`}>
                {LABELS[key].label} <span className="adurl-key">{key}</span>
              </label>
              <input
                id={`adurl-${key}`}
                className="input"
                value={values[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder={LABELS[key].placeholder}
                autoComplete="off"
              />
              <span className="adurl-hint">{LABELS[key].hint}</span>
              {key === "media_from" && (
                <div className="adurl-presets">
                  {MEDIA_PRESETS.map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={`adurl-chip${values.media_from === m ? " on" : ""}`}
                      onClick={() => set("media_from", m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="field">
            <label htmlFor="adurl-result">만들어진 주소</label>
            <div className="adurl-copy">
              <input id="adurl-result" className="input adurl-url" value={url} readOnly onFocus={(e) => e.target.select()} />
              <button className="btn btn-primary" onClick={onCopy}>
                복사
              </button>
            </div>
            {!hasParams && (
              <span className="adurl-hint">
                아직 값을 입력하지 않아 원본 주소와 같습니다. 위 항목을 채우면 파라미터가 붙습니다.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
