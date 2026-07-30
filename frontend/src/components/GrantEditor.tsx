import { useEffect, useState } from "react";
import {
  ApiError,
  listGrants,
  replaceGrants,
  type AdvertiserSummary,
  type GrantInput,
  type GrantView,
} from "../api/client";

interface Props {
  advertiser: AdvertiserSummary;
  onClose: () => void;
  onSaved: () => void;
}

/** 로컬 편집 상태 (GrantView + 체크 여부) */
interface Row extends GrantView {
  checked: boolean;
}

/**
 * 리드폼 권한 부여 편집기.
 * 마케터의 리드폼 전체를 보여주고 이 광고주에게 줄 폼을 고른다.
 * 1리드폼:1광고주 이므로 다른 광고주가 쓰는 폼은 선택할 수 없다.
 */
export function GrantEditor({ advertiser, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const views = await listGrants(advertiser.id);
        if (alive) setRows(views.map((v) => ({ ...v, checked: v.granted })));
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [advertiser.id]);

  function patch(formId: number, next: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.formId === formId ? { ...r, ...next } : r)));
  }

  const selected = rows.filter((r) => r.checked);

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      const grants: GrantInput[] = selected.map((r) => ({
        formId: r.formId,
        displayName: r.displayName?.trim() ? r.displayName.trim() : null,
        expiresAt: r.expiresAt || null,
        canStatus: r.canStatus,
        canMemo: r.canMemo,
        canExport: r.canExport,
      }));
      await replaceGrants(advertiser.id, grants);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lead-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card lead-modal grant-modal" role="dialog" aria-modal="true">
        <div className="lead-modal-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {advertiser.company || advertiser.name}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>리드폼 권한</h2>
            <p className="dash-sub" style={{ margin: "4px 0 0" }}>
              체크한 리드폼의 리드만 이 광고주가 볼 수 있습니다. 해제하면 즉시 회수됩니다.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="lead-modal-body">
          <div className="notice-box">
            ⚖️ <strong>개인정보 제3자 제공 확인</strong>
            <br />
            리드를 광고주에게 보여주는 것은 제3자 제공입니다. 해당 리드폼의{" "}
            <strong>동의 문서에 이 광고주가 제공받는 자로 명시</strong>되어 있는지 확인해주세요.
          </div>

          {error && <p className="auth-error" style={{ marginTop: 12 }}>{error}</p>}

          {loading ? (
            <p className="dash-sub">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="dash-sub">만든 리드폼이 없습니다. 먼저 리드폼을 만들어주세요.</p>
          ) : (
            <div className="grant-list">
              {rows.map((r) => {
                const disabled = !!r.takenBy;
                const open = expanded === r.formId;
                return (
                  <div key={r.formId} className={disabled ? "grant-row is-taken" : "grant-row"}>
                    <div className="grant-main">
                      <label className="grant-check">
                        <input
                          type="checkbox"
                          checked={r.checked}
                          disabled={disabled}
                          onChange={(e) => patch(r.formId, { checked: e.target.checked })}
                        />
                        <span className="grant-name">{r.formName}</span>
                      </label>
                      {disabled && <span className="pill w">{r.takenBy} 사용중</span>}
                      {r.checked && !disabled && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpanded(open ? null : r.formId)}
                        >
                          {open ? "옵션 닫기" : "옵션"}
                        </button>
                      )}
                    </div>

                    {r.checked && !disabled && open && (
                      <div className="grant-options">
                        <div className="field">
                          <label>광고주에게 보일 이름 (비우면 원래 이름)</label>
                          <input
                            className="input"
                            value={r.displayName ?? ""}
                            placeholder={r.formName}
                            onChange={(e) => patch(r.formId, { displayName: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label>권한 만료일 (비우면 무기한)</label>
                          <input
                            className="input"
                            type="date"
                            value={r.expiresAt ? r.expiresAt.slice(0, 10) : ""}
                            onChange={(e) =>
                              patch(r.formId, {
                                expiresAt: e.target.value
                                  ? new Date(`${e.target.value}T23:59:59`).toISOString()
                                  : null,
                              })
                            }
                          />
                        </div>
                        <div className="grant-perms">
                          <label>
                            <input
                              type="checkbox"
                              checked={r.canStatus}
                              onChange={(e) => patch(r.formId, { canStatus: e.target.checked })}
                            />
                            상태 변경 허용
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={r.canMemo}
                              onChange={(e) => patch(r.formId, { canMemo: e.target.checked })}
                            />
                            메모 작성 허용
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={r.canExport}
                              onChange={(e) => patch(r.formId, { canExport: e.target.checked })}
                            />
                            엑셀 내려받기 허용
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grant-foot">
            <span className="dash-sub">선택 {selected.length}개</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                취소
              </button>
              <button className="btn btn-primary" disabled={saving || loading} onClick={onSave}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
