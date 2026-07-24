import { useState, type ChangeEvent } from "react";
import { ApiError, uploadImage } from "../api/client";

/** 이미지 입력 — 파일 업로드(로컬/VM 저장) + URL 직접 입력 겸용. 리드폼·랜딩 이미지 블록 공용. */
export function ImageUploadField({
  url,
  alt,
  onChange,
}: {
  url: string;
  alt: string;
  onChange: (patch: { url?: string; alt?: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const res = await uploadImage(file);
      onChange({ url: res.url });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="block-fields">
      <div className="field">
        <label>이미지</label>
        <div className="img-upload-row">
          <label className="btn btn-ghost btn-sm img-upload-btn">
            {uploading ? "업로드 중…" : "📁 파일 업로드"}
            <input type="file" accept="image/*" hidden onChange={onFile} disabled={uploading} />
          </label>
          {url && <img className="img-upload-thumb" src={url} alt="" />}
        </div>
        {err && <span className="field-error">{err}</span>}
        <input
          className="input"
          style={{ marginTop: 8 }}
          placeholder="또는 이미지 URL 직접 입력"
          value={url}
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </div>
      <div className="field">
        <label>대체 텍스트</label>
        <input className="input" value={alt} onChange={(e) => onChange({ alt: e.target.value })} />
      </div>
    </div>
  );
}
