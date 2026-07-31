import { useEffect, useState, type ChangeEvent } from "react";
import { ApiError, getBrand, updateBrand, uploadImage } from "../api/client";
import { LeadpotMark } from "./LeadpotMark";

/**
 * 화이트라벨 설정 카드(마케터 전용). 여기서 정한 로고·색상이 광고주 화면(`/client`) 상단에 표시된다.
 * 광고주에게는 "리드팟"이 아니라 마케터 브랜드로 보이게 하는 것이 목적이다.
 */
export function BrandSettingsCard() {
  const [logoUrl, setLogoUrl] = useState("");
  const [color, setColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getBrand()
      .then((b) => {
        setLogoUrl(b.logoUrl ?? "");
        setColor(b.color ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function dirty() {
    setSaved(false);
    setError("");
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    dirty();
    try {
      const res = await uploadImage(file);
      setLogoUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSave() {
    setSaving(true);
    setError("");
    try {
      const b = await updateBrand({ logoUrl: logoUrl.trim() || null, color: color.trim() || null });
      setLogoUrl(b.logoUrl ?? "");
      setColor(b.color ?? "");
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const validColor = !color || /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color.trim());

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div
        className="card-h"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>브랜드 설정 (화이트라벨)</span>
        <span className="dash-sub" style={{ fontSize: 13 }}>{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </div>
      <p className="dash-sub" style={{ marginTop: 0 }}>
        광고주 화면 상단에 표시될 <b>내 로고·색상</b>을 설정합니다. 비워두면 기본(리드팟)으로 표시됩니다.
      </p>

      {open && !loading && (
        <>
          <div style={{ display: "grid", gap: 16, maxWidth: 620, marginTop: 8 }}>
            <div className="field">
              <label>로고 이미지</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label className="btn btn-ghost btn-sm img-upload-btn">
                  {uploading ? "업로드 중…" : "파일 선택"}
                  <input type="file" accept="image/*" hidden onChange={onFile} disabled={uploading} />
                </label>
                {logoUrl && (
                  <button
                    className="btn btn-ghost btn-sm danger"
                    onClick={() => {
                      setLogoUrl("");
                      dirty();
                    }}
                  >
                    로고 제거
                  </button>
                )}
              </div>
              <input
                className="input"
                style={{ marginTop: 8 }}
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  dirty();
                }}
                placeholder="또는 이미지 URL 직접 입력"
              />
            </div>

            <div className="field">
              <label>브랜드 색상</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={validColor && color ? color : "#4f46e5"}
                  onChange={(e) => {
                    setColor(e.target.value);
                    dirty();
                  }}
                  style={{ width: 44, height: 36, padding: 2, border: "none", background: "none" }}
                  aria-label="색상 선택"
                />
                <input
                  className="input"
                  style={{ maxWidth: 160 }}
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    dirty();
                  }}
                  placeholder="#4f46e5"
                />
                {!validColor && <span className="dash-sub" style={{ color: "var(--danger, #e5484d)" }}>#RRGGBB 형식</span>}
              </div>
            </div>

            {/* 미리보기: 광고주 화면 상단바 모습 */}
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: 6 }}>미리보기</label>
              <div
                className="topbar"
                style={{
                  borderBottom: `2px solid ${validColor && color ? color : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span className="brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="로고 미리보기" className="brand-logo" />
                  ) : (
                    <LeadpotMark />
                  )}
                  내 브랜드
                </span>
              </div>
            </div>
          </div>

          {error && <p className="auth-error" style={{ marginTop: 12 }}>{error}</p>}

          <div className="edit-actions" style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onSave} disabled={saving || !validColor}>
              {saving ? "저장 중…" : saved ? "저장됨!" : "저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
