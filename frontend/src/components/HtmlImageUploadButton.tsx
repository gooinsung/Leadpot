import { useState, type ChangeEvent } from "react";
import { ApiError, uploadImage } from "../api/client";
import { toast } from "../lib/toast";

/**
 * HTML 편집기용 이미지 업로드 버튼 — 파일을 R2 저장소에 올리고,
 * 공개 URL 로 만든 <img> 태그를 onInsert 로 전달 + URL 을 클립보드에 복사한다.
 * 랜딩·리드폼 HTML 블록, HTML 요소 편집기에서 공용.
 */
export function HtmlImageUploadButton({
  onInsert,
  type,
}: {
  onInsert: (html: string) => void;
  /** 저장 경로 프리픽스({type}-image/…) — landing(기본)/form/component */
  type?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file, type);
      // 공개 화면은 모바일 우선 — 기본은 컨테이너 폭에 맞는 풀폭 이미지
      onInsert(`<img src="${url}" alt="" style="display:block;width:100%;height:auto;" />`);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("이미지 태그를 삽입하고 URL을 클립보드에 복사했습니다.");
      } catch {
        toast.success("이미지 태그를 삽입했습니다. (URL은 태그의 src에 있습니다)");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <label className="btn btn-ghost btn-sm img-upload-btn" title="이미지를 저장소에 올리고 <img> 태그로 삽입">
      {uploading ? "업로드 중…" : "🖼 이미지 업로드"}
      <input type="file" accept="image/*" hidden onChange={onFile} disabled={uploading} />
    </label>
  );
}
