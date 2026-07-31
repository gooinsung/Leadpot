import { useEffect, useRef, type CSSProperties } from "react";

/**
 * 사용자가 넣은 HTML 조각을 렌더한다 — 랜딩·리드폼의 HTML 블록과 요소 미리보기 공용.
 *
 * **왜 필요한가**: `dangerouslySetInnerHTML`(= `innerHTML`)만 쓰면 `<script>` 가 DOM 에는
 * 들어가지만 **실행되지 않는다**(HTML 표준. React 제약이 아니다). 그래서 카운트다운 타이머·
 * 스크롤 등장 효과처럼 JS 가 필요한 요소가 동작하지 않았다. 특히 요소를 `opacity:0` 으로
 * 숨겨두고 JS 로 보이게 하는 흔한 패턴은 **영구히 안 보였다.**
 *
 * 여기서는 HTML 을 붙인 뒤 `<script>` 를 다시 만들어 교체해 실행시키고,
 * 블록이 사라지거나 내용이 바뀔 때 **스크립트가 만든 것들을 되돌린다**(아래 참고).
 *
 * **같은 문서에 주입한다**(iframe·Shadow DOM 아님) — 의도된 선택이다.
 * 플로팅/고정 헤더(`position: fixed`)가 화면 기준으로 붙어야 하고,
 * 사용자 코드가 `document.getElementById(...)` 로 자기 요소를 찾기 때문이다.
 * (Shadow DOM 은 후자가 깨지고, iframe 은 전자가 깨진다.)
 *
 * 같은 문서를 쓰면 블록의 `<style>` 이 페이지 전역에 새는 게 문제인데 —
 * 워드프레스·티스토리·AI 가 만들어주는 코드에는 `* { margin:0 }`, `body { padding-top:70px }`
 * 같은 **전역 리셋이 흔히 들어 있어** 랜딩 전체와 관리자 화면까지 깨뜨렸다.
 * 그래서 주입할 때 **블록의 CSS 를 그 블록 안으로 자동 격리한다**(`scopeStyles`).
 * 덕분에 코드를 훑어보지 않고 그대로 붙여도 다른 화면이 망가지지 않는다.
 *
 * **정리(cleanup) 범위**: 스크립트 실행 중에 만든 `setInterval`·`setTimeout`,
 * `addEventListener`(document·window), `IntersectionObserver`·`MutationObserver`·
 * `ResizeObserver` 를 추적해 되돌린다. 편집 미리보기에서 타이머가 누적돼 화면이
 * 멈추는 것을 막기 위한 것이다.
 * - 실행이 끝난 뒤(이벤트 핸들러 안 등) 새로 만든 타이머·리스너는 추적하지 못한다.
 * - 외부 `src` 스크립트는 비동기로 나중에 실행되므로 추적·보정 대상이 아니다.
 * - `document.write`·`document.currentScript` 에 의존하는 코드는 동작하지 않는다.
 *
 * **보안**: HTML 블록은 이 변경 *이전에도* 임의 JS 실행이 가능했다(`<img onerror>` 같은
 * 인라인 이벤트 핸들러는 innerHTML 로도 실행된다 — 실측 확인). 작성자는 리드폼·랜딩을
 * 소유한 마케터 본인뿐이라(광고주 계정에는 HTML 편집 권한이 없다) 신뢰 경계가 넓어지지 않는다.
 */
/** 블록마다 다른 스코프를 줘서 블록끼리도 CSS 가 섞이지 않게 한다. */
let scopeSeq = 0;

export function HtmlBlock({
  html,
  className,
  style,
  debounceMs = 0,
}: {
  html: string;
  className?: string;
  style?: CSSProperties;
  /** 내용이 자주 바뀌는 편집 미리보기에서 재실행을 늦춘다(ms). 타이핑마다 스크립트가 도는 것을 막는다. */
  debounceMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scopeId = useRef<string>("");
  if (!scopeId.current) scopeId.current = `lp-hb-${++scopeSeq}`;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    host.setAttribute("data-lp-hb", scopeId.current);
    let cleanup: (() => void) | null = null;
    const apply = () => {
      cleanup = injectAndRun(host, html, `[data-lp-hb="${scopeId.current}"]`);
    };

    if (debounceMs > 0) {
      const timer = window.setTimeout(apply, debounceMs);
      return () => {
        window.clearTimeout(timer);
        cleanup?.();
      };
    }
    apply();
    return () => cleanup?.();
  }, [html, debounceMs]);

  return <div ref={ref} className={className} style={style} />;
}

/** 스크립트가 만든 것들을 되돌리려고 실행 중에 모아두는 자리. */
type Tracked = {
  intervals: number[];
  timeouts: number[];
  listeners: Array<{ target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }>;
  observers: Array<{ disconnect: () => void }>;
};

/**
 * HTML 을 붙이고 CSS 를 블록 안으로 격리한 뒤 스크립트를 실행한다. 되돌리는 함수를 반환.
 *
 * ⚠️ 기기 미리보기는 iframe 안에서 렌더된다. iframe 은 **문서·window·CSSOM 클래스가 전부 다르므로**
 * 전역 `document`/`window` 를 쓰면 안 되고 항상 호스트가 속한 문서(`host.ownerDocument`)를 따라간다.
 */
function injectAndRun(host: HTMLElement, html: string, scope: string): () => void {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  host.innerHTML = html;
  scopeStyles(host, scope, win);

  const scripts = Array.from(host.querySelectorAll("script"));
  if (scripts.length === 0) {
    return () => {
      host.innerHTML = "";
    };
  }

  const tracked: Tracked = { intervals: [], timeouts: [], listeners: [], observers: [] };
  const restore = patchGlobals(tracked, win, doc);
  try {
    for (const old of scripts) {
      const fresh = doc.createElement("script");
      for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value);
      fresh.textContent = old.textContent;
      old.replaceWith(fresh); // 삽입 시점에 실행된다(인라인은 동기)
    }
  } finally {
    restore();
  }

  return () => {
    tracked.intervals.forEach((id) => win.clearInterval(id));
    tracked.timeouts.forEach((id) => win.clearTimeout(id));
    tracked.listeners.forEach(({ target, type, listener, options }) => {
      target.removeEventListener(type, listener, options);
    });
    tracked.observers.forEach((o) => {
      try {
        o.disconnect();
      } catch {
        /* 이미 정리됐으면 무시 */
      }
    });
    host.innerHTML = "";
  };
}

/* ============================================================
   블록 CSS 격리
   블록의 <style> 규칙 선택자 앞에 블록 스코프를 붙여, 페이지 전역으로 새지 않게 한다.
   선택자 파싱은 직접 하지 않고 **브라우저의 CSSOM**(styleEl.sheet.cssRules)을 쓴다 —
   정규식으로 CSS 를 쪼개는 것보다 정확하다.
   ============================================================ */

/** 페이지 루트를 겨냥하는 선택자 — 블록 루트가 대신 받는다. */
const ROOT_SELECTORS = new Set(["html", ":root", "body", "html body"]);

/**
 * 블록 안 모든 `<style>` 의 선택자를 블록 스코프로 한정한다.
 * `win` 은 호스트가 속한 창 — iframe 안에서는 CSSOM 클래스가 부모와 다른 객체라
 * `instanceof` 는 반드시 그 창의 클래스로 판정해야 한다.
 */
function scopeStyles(host: HTMLElement, scope: string, win: Window) {
  for (const styleEl of Array.from(host.querySelectorAll("style"))) {
    const sheet = styleEl.sheet; // 문서에 붙어 있어야 접근 가능(innerHTML 직후 가능)
    if (!sheet) continue;
    let scoped: string;
    try {
      scoped = scopeRules(sheet.cssRules, scope, win);
    } catch {
      continue; // 읽을 수 없으면 원본을 그대로 둔다(격리 실패보다 렌더 실패가 더 나쁘다)
    }
    styleEl.textContent = scoped;
  }
}

/** iframe 창의 CSSOM 생성자들 — 부모 창의 것과 다른 객체라 instanceof 판정에 그대로 써야 한다. */
type CssomWindow = Window & {
  CSSStyleRule: typeof CSSStyleRule;
  CSSMediaRule: typeof CSSMediaRule;
  CSSSupportsRule?: typeof CSSSupportsRule;
};

function scopeRules(rules: CSSRuleList, scope: string, win: Window): string {
  const w = win as CssomWindow;
  let out = "";
  for (const rule of Array.from(rules)) {
    if (rule instanceof w.CSSStyleRule) {
      out += `${scopeSelector(rule.selectorText, scope)}{${rule.style.cssText}}\n`;
    } else if (rule instanceof w.CSSMediaRule) {
      out += `@media ${rule.conditionText}{${scopeRules(rule.cssRules, scope, win)}}\n`;
    } else if (w.CSSSupportsRule && rule instanceof w.CSSSupportsRule) {
      out += `@supports ${rule.conditionText}{${scopeRules(rule.cssRules, scope, win)}}\n`;
    } else {
      // @keyframes·@font-face·@import 등은 스코프 개념이 없으므로 그대로 둔다.
      out += `${rule.cssText}\n`;
    }
  }
  return out;
}

function scopeSelector(selectorText: string, scope: string): string {
  return selectorText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      // `* { margin:0 }` 같은 전역 리셋 → 블록 루트와 그 자손까지만
      if (part === "*") return `${scope},${scope} *`;
      // `body { padding-top:70px }` → 블록 루트가 페이지 루트 역할을 대신한다
      if (ROOT_SELECTORS.has(lower)) return scope;
      // `body .foo` → `<scope> .foo`
      if (/^(html|body)\b/i.test(part)) {
        return `${scope} ${part.replace(/^(html|body)\b\s*/i, "")}`.trim();
      }
      return `${scope} ${part}`;
    })
    .join(",");
}

/** 이미 지나간 준비 이벤트 — 등록해도 다시 발생하지 않으므로 즉시 실행으로 바꿔준다. */
const READY_EVENTS = new Set(["DOMContentLoaded", "load"]);

/**
 * 스크립트 실행 구간에만 전역을 감싸 만들어지는 것들을 기록한다.
 * 반환된 함수를 부르면 전역이 원래대로 돌아간다.
 */
function patchGlobals(tracked: Tracked, win: Window, doc: Document): () => void {
  const undo: Array<() => void> = [];

  // 타이머 — 편집 미리보기에서 누적되면 화면이 멈춘다.
  const origInterval = win.setInterval;
  const origTimeout = win.setTimeout;
  win.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
    const id = origInterval.apply(win, args);
    tracked.intervals.push(id);
    return id;
  }) as typeof window.setInterval;
  win.setTimeout = ((...args: Parameters<typeof window.setTimeout>) => {
    const id = origTimeout.apply(win, args);
    tracked.timeouts.push(id);
    return id;
  }) as typeof window.setTimeout;
  undo.push(() => {
    win.setInterval = origInterval;
    win.setTimeout = origTimeout;
  });

  // addEventListener — 준비 이벤트는 즉시 실행, 나머지는 기록해 두고 나중에 해제.
  for (const target of [doc, win] as Array<Document | Window>) {
    const original = target.addEventListener;
    const patched = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (listener == null) return;
      if (READY_EVENTS.has(type) && typeof listener === "function") {
        // 동기 실행 중 DOM 조작과 섞이지 않게 마이크로태스크로 미룬다.
        void Promise.resolve().then(() => (listener as EventListener)(new Event(type)));
        return;
      }
      tracked.listeners.push({ target, type, listener, options });
      original.call(target, type, listener, options);
    };
    (target as unknown as Record<string, unknown>).addEventListener = patched;
    undo.push(() => {
      (target as unknown as Record<string, unknown>).addEventListener = original;
    });
  }

  // 옵저버 — 스크롤 등장 효과(IntersectionObserver)가 대표적.
  const winAny = win as unknown as Record<string, unknown>;
  for (const name of ["IntersectionObserver", "MutationObserver", "ResizeObserver"] as const) {
    const Original = winAny[name] as (new (...args: never[]) => { disconnect: () => void }) | undefined;
    if (!Original) continue;
    const Patched = function (this: unknown, ...args: never[]) {
      const instance = new Original(...args);
      tracked.observers.push(instance);
      return instance;
    } as unknown as typeof Original;
    Patched.prototype = Original.prototype;
    winAny[name] = Patched;
    undo.push(() => {
      winAny[name] = Original;
    });
  }

  return () => undo.forEach((fn) => fn());
}
