import { useState, type CSSProperties } from "react";
import { recordEvent, type FormDetail, type LandingBlock, type PublicLanding } from "../api/client";
import { PublicFormView } from "./PublicFormView";

/** 블록 여백(위/아래/좌우, px) → 인라인 스타일. */
function blockStyle(b: LandingBlock): CSSProperties {
  const px = (v: unknown) => (v == null || v === "" ? undefined : `${Number(v)}px`);
  return { marginTop: px(b.mt), marginBottom: px(b.mb), marginLeft: px(b.mx), marginRight: px(b.mx) };
}

/** 공개 랜딩 렌더(모바일 최적화). 블록 렌더 + 인라인 리드폼 / CTA 오버레이. 데이터 로딩은 상위 페이지가 담당. */
export function LandingView({ landing }: { landing: PublicLanding }) {
  const [overlayForm, setOverlayForm] = useState<FormDetail | null>(null);

  const formOf = (b: LandingBlock): FormDetail | undefined => {
    const fid = b.formId;
    return fid == null ? undefined : landing.forms[String(fid)];
  };

  // I5 자동 클릭 추적: 랜딩 콘텐츠의 이미지·버튼·링크 클릭을 자동 수집.
  // 폼 내부·오버레이·오버레이 CTA(form_open으로 별도 집계)는 제외해 중복을 막는다.
  function handleContentClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement | null)?.closest("a, button, img") as HTMLElement | null;
    if (!el) return;
    if (el.classList.contains("landing-cta")) return; // 오버레이 CTA = form_open
    if (el.closest(".landing-form-card, .landing-overlay, form")) return; // 폼 내부 클릭 제외
    const tag = el.tagName.toLowerCase();
    let target =
      tag === "img"
        ? (el as HTMLImageElement).alt || "이미지"
        : (el.textContent || "").trim() || (el as HTMLAnchorElement).getAttribute?.("href") || tag;
    target = (target || tag).slice(0, 80);
    recordEvent({ landingPageId: landing.id, eventType: "click", target });
  }

  return (
    <div className="landing-public" onClickCapture={handleContentClick}>
      <div className="landing-public-inner">
        {landing.content.map((b, i) => {
          const ms = blockStyle(b);
          if (b.type === "IMAGE") {
            const url = b.url as string;
            return url ? <img key={i} className="landing-img" src={url} alt={(b.alt as string) || ""} style={ms} /> : null;
          }
          if (b.type === "TEXT") return <p key={i} className="landing-text" style={ms}>{(b.text as string) || ""}</p>;
          if (b.type === "HTML") return <div key={i} className="landing-html" style={ms} dangerouslySetInnerHTML={{ __html: (b.html as string) || "" }} />;
          if (b.type === "FORM") {
            const form = formOf(b);
            if (!form) return null;
            if (b.trigger === "overlay") {
              return (
                <button key={i} className="btn btn-green landing-cta" type="button" style={ms}
                  onClick={() => {
                    setOverlayForm(form);
                    // I5: CTA(폼 열기) 클릭 기록 → 전환 퍼널 중간 단계 + 요소 클릭 통계
                    recordEvent({ landingPageId: landing.id, formId: form.id, eventType: "form_open", target: (b.buttonLabel as string) || "신청하기" });
                  }}>
                  {(b.buttonLabel as string) || "신청하기"}
                </button>
              );
            }
            return (
              <div key={i} className="landing-form-card" style={ms}>
                <PublicFormView form={form} landingPageId={landing.id} trackingConfig={landing.tracking} />
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
            <PublicFormView form={overlayForm} landingPageId={landing.id} trackingConfig={landing.tracking} onSubmitted={() => { /* 완료 화면은 리드폼 내부에서 표시 */ }} />
          </div>
        </div>
      )}
    </div>
  );
}
