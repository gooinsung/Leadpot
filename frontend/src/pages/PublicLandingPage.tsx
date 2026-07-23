import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicLanding, type FormDetail, type LandingBlock, type PublicLanding } from "../api/client";
import { PublicFormView } from "../components/PublicFormView";

/** 공개 랜딩 페이지 (/p/{slug}). 모바일 최적화. 블록 렌더 + 인라인 폼 / CTA 오버레이. */
export function PublicLandingPage() {
  const { slug } = useParams();
  const [landing, setLanding] = useState<PublicLanding | null>(null);
  const [error, setError] = useState("");
  const [overlayForm, setOverlayForm] = useState<FormDetail | null>(null);

  useEffect(() => {
    getPublicLanding(String(slug))
      .then(setLanding)
      .catch(() => setError("페이지를 찾을 수 없습니다."));
  }, [slug]);

  if (error) return <div className="landing-public"><p className="auth-error" style={{ padding: 40 }}>{error}</p></div>;
  if (!landing) return <div className="page-loading">불러오는 중…</div>;

  const formOf = (b: LandingBlock): FormDetail | undefined => {
    const fid = b.formId;
    return fid == null ? undefined : landing.forms[String(fid)];
  };

  return (
    <div className="landing-public">
      <div className="landing-public-inner">
        {landing.content.map((b, i) => {
          if (b.type === "IMAGE") {
            const url = b.url as string;
            return url ? <img key={i} className="landing-img" src={url} alt={(b.alt as string) || ""} /> : null;
          }
          if (b.type === "TEXT") return <p key={i} className="landing-text">{(b.text as string) || ""}</p>;
          if (b.type === "HTML") return <div key={i} className="landing-html" dangerouslySetInnerHTML={{ __html: (b.html as string) || "" }} />;
          if (b.type === "FORM") {
            const form = formOf(b);
            if (!form) return null;
            if (b.trigger === "overlay") {
              return (
                <button key={i} className="btn btn-green landing-cta" type="button" onClick={() => setOverlayForm(form)}>
                  {(b.buttonLabel as string) || "신청하기"}
                </button>
              );
            }
            return (
              <div key={i} className="landing-form-card">
                <PublicFormView form={form} landingPageId={landing.id} />
              </div>
            );
          }
          return null;
        })}
      </div>

      {overlayForm && (
        <div className="landing-overlay" onClick={() => setOverlayForm(null)}>
          <div className="landing-overlay-card" onClick={(e) => e.stopPropagation()}>
            <button className="landing-overlay-close" type="button" onClick={() => setOverlayForm(null)} aria-label="닫기">×</button>
            <PublicFormView form={overlayForm} landingPageId={landing.id} onSubmitted={() => { /* 완료 화면은 폼 내부에서 표시 */ }} />
          </div>
        </div>
      )}
    </div>
  );
}
