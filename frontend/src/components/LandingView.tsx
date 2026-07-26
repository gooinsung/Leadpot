import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getLandingLive, recordEvent, type FormDetail, type LandingBlock, type LandingLive, type PublicLanding } from "../api/client";
import { PublicFormView } from "./PublicFormView";

/** 블록 여백(위/아래/좌우, px) → 인라인 스타일. */
function blockStyle(b: LandingBlock): CSSProperties {
  const px = (v: unknown) => (v == null || v === "" ? undefined : `${Number(v)}px`);
  return { marginTop: px(b.mt), marginBottom: px(b.mb), marginLeft: px(b.mx), marginRight: px(b.mx) };
}

/** 공개 랜딩 렌더(모바일 최적화). 블록 렌더 + 인라인 리드폼 / CTA 오버레이. 데이터 로딩은 상위 페이지가 담당. */
export function LandingView({ landing }: { landing: PublicLanding }) {
  const [overlayForm, setOverlayForm] = useState<FormDetail | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<LandingLive | null>(null);

  // 동적 요소(M8) 마커가 콘텐츠에 있으면 실시간 집계를 불러온다.
  const contentHtml = useMemo(
    () => landing.content.filter((b) => b.type === "HTML").map((b) => String(b.html || "")).join(" "),
    [landing],
  );
  const needsLive = contentHtml.includes("data-lp-live");
  const hasToast = contentHtml.includes('data-lp-live="recent-toast"');

  useEffect(() => {
    if (!needsLive) return;
    getLandingLive(landing.id).then(setLive).catch(() => {});
  }, [needsLive, landing.id]);

  // 실시간 값 하이드레이션: HTML 블록 안 data-lp-live 마커 텍스트를 실제 값으로 채운다.
  useEffect(() => {
    if (!live || !innerRef.current) return;
    innerRef.current.querySelectorAll<HTMLElement>('[data-lp-live="count"]').forEach((el) => {
      el.textContent = live.count.toLocaleString("ko-KR");
    });
    innerRef.current.querySelectorAll<HTMLElement>('[data-lp-live="slots"]').forEach((el) => {
      const target = Number(el.getAttribute("data-target") || "0");
      el.textContent = String(Math.max(0, target - live.count));
    });
  }, [live]);

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
      {hasToast && live && <RecentToast recent={live.recent} />}
      <div className="landing-public-inner" ref={innerRef}>
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
                <PublicFormView form={form} landingPageId={landing.id} trackingConfig={form.trackingConfig} />
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
            <PublicFormView form={overlayForm} landingPageId={landing.id} trackingConfig={overlayForm.trackingConfig} onSubmitted={() => { /* 완료 화면은 리드폼 내부에서 표시 */ }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 최근 신청자 토스트(우측 상단). 마스킹된 이름을 일정 간격으로 순환 표시(사회적 증거). */
function RecentToast({ recent }: { recent: { name: string; at: string }[] }) {
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (recent.length === 0) return;
    setShow(true);
    let i = 0;
    const timer = setInterval(() => {
      setShow(false);
      window.setTimeout(() => {
        i = (i + 1) % recent.length;
        setIdx(i);
        setShow(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, [recent]);

  if (recent.length === 0) return null;
  const r = recent[idx] ?? recent[0];
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 10000,
        background: "var(--surface, #fff)",
        color: "var(--text, #14161f)",
        border: "1px solid var(--border, #e2e5f2)",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,.15)",
        padding: "10px 14px",
        fontSize: 13,
        maxWidth: 260,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity .3s, transform .3s",
        pointerEvents: "none",
      }}
    >
      🎉 <b>{r.name}</b>님이 방금 신청했어요
    </div>
  );
}
