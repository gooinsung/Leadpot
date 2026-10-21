"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

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
 * - `document.currentScript` 에 의존하는 코드는 동작하지 않는다.
 *
 * **`document.write` (2026-10)**: 마켓클럽·당근 같은 외부 폼 임베드 코드가
 * `document.write('<iframe ...>')` 로 폼을 그린다. 이 코드는 페이지 로딩이 끝난 뒤 실행되는데,
 * 로딩이 끝난 문서에 `document.write` 를 부르면 브라우저가 `document.open()` 을 자동으로 불러
 * **문서 전체를 지운다**(HTML 표준) — 사진·다른 블록이 모두 사라지고 그 폼만 남는 장애가 있었다.
 * 그래서 스크립트 실행 구간에만 `document.write`·`writeln` 을 가로채, 원래 브라우저가 처음 읽을 때처럼
 * **그 스크립트 바로 뒤에** 써준 HTML 을 끼워 넣는다(`patchDocumentWrite`).
 * - 서버 렌더(SSR) 된 공개 랜딩은 브라우저가 HTML 을 처음 읽을 때 `<script>` 를 이미 한 번 실행했고
 *   그때 `document.write` 도 정상적으로 제자리에 써졌다. 이어서 여기서 스크립트를 다시 실행할 때는
 *   써준 내용을 **버린다** — 또 끼워 넣으면 폼이 두 개가 된다(`serverParsedHtml` 참고).
 *   (스크립트를 다시 실행하는 기존 동작 자체는 바꾸지 않는다 — 스크립트보다 아래에 있는 요소를 찾는
 *   코드는 두 번째 실행에서야 동작하기 때문이다.)
 *
 * **보안**: HTML 블록은 이 변경 *이전에도* 임의 JS 실행이 가능했다(`<img onerror>` 같은
 * 인라인 이벤트 핸들러는 innerHTML 로도 실행된다 — 실측 확인). 작성자는 리드폼·랜딩을
 * 소유한 마케터 본인뿐이라(광고주 계정에는 HTML 편집 권한이 없다) 신뢰 경계가 넓어지지 않는다.
 *
 * **SSR(2026-09, docs/SSR-LANDING-PLAN.md §5-4)**: 마크업 자체는 `dangerouslySetInnerHTML` 로
 * 렌더한다(서버·클라이언트 항상 동일하게) — 그래야 서버가 그린 HTML 에도 실제 내용이 들어가고,
 * 하이드레이션 때 React 가 그대로 재사용해 화면이 깜빡이지 않는다. `<script>` 는 어차피
 * `dangerouslySetInnerHTML` 로는 실행되지 않으므로(HTML 표준), `useEffect` 가 **이미 그려진
 * DOM 위에서** CSS 스코프링 + 스크립트 교체 실행만 담당한다 — `innerHTML` 을 직접 다시 쓰지 않는다
 * (다시 쓰면 React 가 만든 DOM 을 지웠다가 새로 만드는 셈이라 상태·포커스가 날아가고 깜빡인다).
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
  // 서버가 그린 HTML 을 브라우저가 이미 읽었으면(하이드레이션) 그 html 을 기억해 둔다.
  // 브라우저가 읽을 때 `<script>` 가 이미 실행돼 `document.write` 결과가 제자리에 있으므로,
  // 같은 html 로 스크립트를 다시 돌릴 때는 `document.write` 를 버려야 한다(위 주석 참고).
  // 판별: `useId` 는 서버·하이드레이션에서 같은 값이므로, 첫 렌더 때 그 값의 요소가 이미 문서에 있으면
  // 하이드레이션이다(클라이언트에서 처음 그릴 때는 아직 요소가 없다). 하이드레이션 실패로 React 가
  // 새로 그리면 새 id 가 매겨져 못 찾으므로 이때는 써준 HTML 을 정상적으로 끼워 넣는다.
  // ⚠️ useSyncExternalStore 로 판별하면 안 된다 — 서버/클라이언트 값이 다르면 React 가 서버 HTML 을
  // 버리고 클라이언트에서 다시 그려서, 브라우저가 처음 읽을 때 써진 내용이 사라진다(실측 2026-10-21).
  const instanceId = useId();
  const [serverParsedHtml] = useState(() => (isInDocument(instanceId) ? html : null));
  const htmlChanged = useRef(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    host.setAttribute("data-lp-hb", scopeId.current);
    let cleanup: (() => void) | null = null;
    // html 은 이미 렌더(JSX 의 dangerouslySetInnerHTML)에서 DOM 에 들어가 있다 — 여기서는
    // 스코프링 + 스크립트 실행만 한다(§ 위 SSR 주석 참고).
    // 내용이 한 번이라도 바뀌었으면 React 가 innerHTML 을 새로 쓴 것이라 브라우저가 실행한 적 없는 스크립트다.
    if (html !== serverParsedHtml) htmlChanged.current = true;
    const discardWrites = !htmlChanged.current;
    const apply = () => {
      cleanup = processAndRun(host, `[data-lp-hb="${scopeId.current}"]`, discardWrites);
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
  }, [html, debounceMs, serverParsedHtml]);

  return (
    <div ref={ref} data-lp-hb-id={instanceId} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** 서버가 그린 이 블록이 이미 문서에 있는지(= 하이드레이션 중인지). 서버 렌더 중에는 false. */
function isInDocument(instanceId: string): boolean {
  if (typeof document === "undefined") return false;
  for (const el of Array.from(document.querySelectorAll("[data-lp-hb-id]"))) {
    if (el.getAttribute("data-lp-hb-id") === instanceId) return true;
  }
  return false;
}

/** 스크립트가 만든 것들을 되돌리려고 실행 중에 모아두는 자리. */
type Tracked = {
  intervals: number[];
  timeouts: number[];
  listeners: Array<{ target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }>;
  observers: Array<{ disconnect: () => void }>;
  /** `document.write` 로 끼워 넣은 노드 — 블록이 사라지거나 다시 실행될 때 지운다. */
  written: ChildNode[];
};

/** `document.write` 가 다시 스크립트를 쓰는 경우의 무한 반복 방지. */
const MAX_WRITE_DEPTH = 10;

/**
 * 이미 DOM 에 들어가 있는 마크업(JSX 의 `dangerouslySetInnerHTML`)의 CSS 를 블록 안으로
 * 격리하고 스크립트를 실행한다. 되돌리는 함수를 반환.
 *
 * ⚠️ 기기 미리보기는 iframe 안에서 렌더된다. iframe 은 **문서·window·CSSOM 클래스가 전부 다르므로**
 * 전역 `document`/`window` 를 쓰면 안 되고 항상 호스트가 속한 문서(`host.ownerDocument`)를 따라간다.
 */
function processAndRun(host: HTMLElement, scope: string, discardWrites: boolean): () => void {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  scopeStyles(host, scope, win);

  const scripts = Array.from(host.querySelectorAll("script"));
  if (scripts.length === 0) {
    return () => {};
  }

  const tracked: Tracked = { intervals: [], timeouts: [], listeners: [], observers: [], written: [] };
  const restore = patchGlobals(tracked, win, doc);
  const writes = patchDocumentWrite(doc);
  // 스크립트를 실행하고, 실행 중 `document.write` 로 쓴 HTML 을 그 스크립트 바로 뒤에 끼워 넣는다.
  // 써준 HTML 안의 스크립트도 같은 방식으로 이어서 실행한다(브라우저가 처음 읽을 때와 같은 순서).
  const runScripts = (list: HTMLScriptElement[], depth: number) => {
    for (const old of list) {
      const fresh = doc.createElement("script");
      for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value);
      fresh.textContent = old.textContent;
      old.replaceWith(fresh); // 삽입 시점에 실행된다(인라인은 동기)
      const out = writes.take();
      if (!out || discardWrites || !fresh.parentNode) continue;
      const tpl = doc.createElement("template");
      tpl.innerHTML = out; // template 안 스크립트는 실행되지 않는다 — 아래에서 직접 실행
      const nodes = Array.from(tpl.content.childNodes);
      const nested = Array.from(tpl.content.querySelectorAll("script"));
      fresh.after(tpl.content);
      tracked.written.push(...nodes);
      if (depth < MAX_WRITE_DEPTH) runScripts(nested, depth + 1);
    }
  };
  try {
    runScripts(scripts, 0);
  } finally {
    writes.restore();
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
    // 다시 실행하면 또 써지므로 지운다(편집 미리보기·StrictMode 재실행에서 폼이 겹치지 않게).
    // html 이 바뀐 경우엔 React 가 innerHTML 을 새로 써서 이미 떨어져 나간 노드라 아무 일도 없다.
    tracked.written.forEach((n) => n.remove());
    // ⚠️ host.innerHTML 은 여기서 지우지 않는다 — React 가 dangerouslySetInnerHTML 로
    // 다음 렌더의 내용을 이미 심어놨을 수 있다(html prop 변경 시 cleanup 이 새 커밋 *이후*
    // 실행된다). 지우면 방금 React 가 그린 새 내용을 날려버린다.
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

/**
 * 스크립트 실행 구간에만 `document.write`·`writeln` 을 가로채 써준 HTML 을 모은다.
 * 원래 함수를 부르면 로딩이 끝난 문서가 통째로 지워지므로(HTML 표준의 암묵적 `document.open()`)
 * 절대 원래 함수로 넘기지 않는다. 모은 HTML 은 `take()` 로 꺼내 호출한 쪽이 끼워 넣는다.
 */
function patchDocumentWrite(doc: Document): { take: () => string; restore: () => void } {
  const target = doc as unknown as Record<string, unknown>;
  const names = ["write", "writeln"] as const;
  const hadOwn = names.map((n) => Object.prototype.hasOwnProperty.call(doc, n));
  const originals = names.map((n) => target[n]);
  let buffer = "";
  target.write = (...text: string[]) => {
    buffer += text.join("");
  };
  target.writeln = (...text: string[]) => {
    buffer += text.join("") + "\n";
  };
  return {
    take: () => {
      const out = buffer;
      buffer = "";
      return out;
    },
    restore: () => {
      names.forEach((n, i) => {
        if (hadOwn[i]) target[n] = originals[i];
        else delete target[n]; // 프로토타입의 원래 함수가 다시 보이게
      });
    },
  };
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
