import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getLandingLive, recordEvent, recordEventBeacon, type FormDetail, type LandingBlock, type LandingLive, type PublicLanding } from "../api/client";
import { HtmlBlock } from "./HtmlBlock";
import { PublicFormView } from "./PublicFormView";
import { resolveStyle } from "./formRenderers/formStyle";

/**
 * 블록 여백(위/아래/좌우, px) → 인라인 스타일.
 *
 * <p>`full`(전체 폭)이 켜진 블록은 좌우 여백을 0으로 눌러 화면 끝까지 채운다.
 * HTML·텍스트 블록은 CSS 에서 좌우 20px 패딩을 갖는데(가독성 기본값), 직접 만든
 * 풀폭 디자인에는 그게 흰 띠로 보인다. **인라인으로만 덮으므로 이 값을 안 켠 블록은
 * 지금과 완전히 동일하다**(기존 랜딩 영향 없음).
 */
function blockStyle(b: LandingBlock): CSSProperties {
  const px = (v: unknown) => (v == null || v === "" ? undefined : `${Number(v)}px`);
  const base: CSSProperties = { marginTop: px(b.mt), marginBottom: px(b.mb) };
  if (b.full) return { ...base, marginLeft: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0, width: "100%" };
  return { ...base, marginLeft: px(b.mx), marginRight: px(b.mx) };
}

/** 공개 랜딩 렌더(모바일 최적화). 블록 렌더 + 인라인 리드폼 / CTA 오버레이. 데이터 로딩은 상위 페이지가 담당. */
export function LandingView({ landing }: { landing: PublicLanding }) {
  const [overlayForm, setOverlayForm] = useState<FormDetail | null>(null);
  const [fullscreenForm, setFullscreenForm] = useState<FormDetail | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<LandingLive | null>(null);

  // 풀스크린 스텝 진행 중엔 배경(커버 화면) 스크롤을 잠가 iOS 에서 뒤 콘텐츠가 같이 밀리는 걸 막는다.
  useEffect(() => {
    if (!fullscreenForm) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreenForm]);

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

  // I6 고객 여정 추적: 스크롤 깊이(25/50/75/100%) 도달 + 체류시간/이탈. 공개 랜딩에서만 동작(에디터 미리보기는 이 컴포넌트를 쓰지 않음).
  useEffect(() => {
    const thresholds = [25, 50, 75, 100];
    const reached = new Set<number>();
    let maxScroll = 0;
    let ticking = false;
    let exited = false;
    const startedAt = Date.now();

    function scrollPercent(): number {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const viewport = window.innerHeight || doc.clientHeight || 0;
      const full = Math.max(doc.scrollHeight, doc.offsetHeight, 1);
      return Math.min(100, Math.max(0, Math.round(((scrollTop + viewport) / full) * 100)));
    }

    function checkThresholds() {
      ticking = false;
      const pct = scrollPercent();
      if (pct > maxScroll) maxScroll = pct;
      for (const t of thresholds) {
        if (pct >= t && !reached.has(t)) {
          reached.add(t);
          recordEvent({ landingPageId: landing.id, eventType: "scroll", scrollDepth: t });
        }
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(checkThresholds);
    }

    function onExit() {
      if (exited) return;
      exited = true;
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      recordEventBeacon({ landingPageId: landing.id, eventType: "page_exit", durationSec, scrollDepth: maxScroll });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") onExit();
    }

    checkThresholds(); // 스크롤 없이 뷰포트만으로 이미 도달한 깊이도 반영
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onExit);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onExit);
      onExit(); // 다른 랜딩으로 전환되는 언마운트도 이탈로 간주
    };
  }, [landing.id]);

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
    if (el.closest(".landing-form-card, .landing-overlay, .landing-fullscreen, form")) return; // 폼 내부 클릭 제외
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
          if (b.type === "HTML") return <HtmlBlock key={i} className="landing-html" style={ms} html={(b.html as string) || ""} />;
          if (b.type === "FORM") {
            const form = formOf(b);
            if (!form) return null;
            if (b.trigger === "overlay" || b.trigger === "fullscreen") {
              const open = b.trigger === "fullscreen" ? setFullscreenForm : setOverlayForm;
              // 오버레이/풀스크린 CTA 버튼 색은 연결된 리드폼의 버튼 색(styleConfig.buttonColor)을 따라간다 —
              // 고정된 초록색 대신 리드폼 편집기에서 지정한 색과 일치해야 한다.
              const btnStyle = resolveStyle(form);
              const buttonDescription = b.buttonDescription as string | undefined;
              return (
                <Fragment key={i}>
                  <button className="btn landing-cta" type="button"
                    style={{ ...ms, background: btnStyle.buttonColor, color: btnStyle.buttonText }}
                    onClick={() => {
                      open(form);
                      // I5: CTA(폼 열기) 클릭 기록 → 전환 퍼널 중간 단계 + 요소 클릭 통계
                      recordEvent({ landingPageId: landing.id, formId: form.id, eventType: "form_open", target: (b.buttonLabel as string) || "신청하기" });
                    }}>
                    {(b.buttonLabel as string) || "신청하기"}
                  </button>
                  {buttonDescription && <p className="landing-cta-desc">{buttonDescription}</p>}
                </Fragment>
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

      {fullscreenForm && (
        <div className="landing-fullscreen">
          <button className="landing-fullscreen-close" type="button" onClick={() => setFullscreenForm(null)} aria-label="닫기">×</button>
          <div className="landing-fullscreen-inner">
            <PublicFormView form={fullscreenForm} landingPageId={landing.id} trackingConfig={fullscreenForm.trackingConfig} onSubmitted={() => { /* 완료 화면은 리드폼 내부에서 표시 */ }} />
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
