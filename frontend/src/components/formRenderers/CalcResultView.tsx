import type { CalcView } from "../../lib/calculators/types";

/**
 * 계산기 결과 화면. **계산기 종류와 무관한 범용 렌더러**다 —
 * {@link CalcView} 만 보고 그리므로 새 계산기를 추가해도 이 파일을 고치지 않는다.
 *
 * 표시 방침(사용자 결정 2026-08-13):
 * - **탕감률을 가장 크게**, 그 아래 금액. 비율이 금액보다 강하게 꽂힌다.
 * - 산출 근거는 접어서 함께 제공한다(전환은 큰 숫자가, 신뢰는 근거가 만든다).
 * - 계산이 안 되는 경우에도 "안 됩니다"로 끝내지 않고 다음 행동으로 잇는다.
 */
export function CalcResultView({
  view,
  disclaimer,
  accentColor,
}: {
  view: CalcView;
  /** 계산기 정의의 고정 면책 문구. 마케터가 지울 수 없다. */
  disclaimer: string;
  accentColor: string;
}) {
  return (
    <div className="calc-result">
      {view.ok ? (
        <div className="calc-headline">
          <span className="calc-headline-label">{view.headlineLabel}</span>
          <span className="calc-headline-rate" style={{ color: accentColor }}>
            {view.headline}
          </span>
          {view.headlineSub && <span className="calc-headline-amount">{view.headlineSub}</span>}
          {view.headlineNote && <span className="calc-headline-note">{view.headlineNote}</span>}
        </div>
      ) : (
        view.notice && <div className="calc-notice">{renderNotice(view.notice)}</div>
      )}

      {view.warnings.length > 0 && (
        <ul className="calc-warnings">
          {view.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {view.breakdown.length > 0 && (
        <details className="calc-breakdown">
          <summary>계산 근거 보기</summary>
          <div className="calc-rows">
            {view.breakdown.map((r, i) => (
              <div className="calc-row" key={i}>
                <span className="calc-row-label">{r.label}</span>
                <span className="calc-row-value">
                  {r.value}
                  {r.hint && <span className="calc-row-hint">{r.hint}</span>}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="calc-disclaimer">{disclaimer}</p>
    </div>
  );
}

/**
 * 연락처를 받기 **전** 유도 화면. 흐름은 `질문 → 정보 입력 → 결과` 다 —
 * 결과를 먼저 보여주면 그것만 보고 나가서 리드가 남지 않는다(사용자 결정 2026-08-13).
 *
 * 문구는 계산기 정의({@link CalculatorDef.gate})에서 오므로 이 컴포넌트는 계산기 종류와 무관하다.
 */
export function CalcGateView({
  gate,
  accentColor,
}: {
  gate: { title: string; highlight: string; bullets: string[] };
  accentColor: string;
}) {
  return (
    <div className="calc-gate">
      <h3 className="calc-gate-t">{gate.title}</h3>
      <p className="calc-gate-h">{gate.highlight}</p>
      <ul className="calc-gate-list">
        {gate.bullets.map((b, i) => (
          <li key={i}>
            <span className="calc-gate-ck" style={{ background: accentColor }} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span>{renderParen(b)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 결과 아래 후속 안내(상담 전화). */
export function CalcFollowUp({ text }: { text: string }) {
  return <div className="calc-followup">{renderNotice(text)}</div>;
}

/** `(괄호)` 안을 강조색으로. 게이트 목록의 마지막 후크를 눈에 띄게 하려는 최소 장치다. */
function renderParen(text: string) {
  return text.split(/(\([^)]+\))/g).map((part, i) =>
    part.startsWith("(") ? (
      <em key={i} className="calc-gate-em">
        {part}
      </em>
    ) : (
      part
    ),
  );
}

/**
 * 계산 중 로딩. 계산은 실제로 즉시(1ms 이내) 끝나지만, 결과가 순간이동하면
 * 답변으로 뽑아낸 숫자의 무게가 안 실린다. 기다림 자체가 결과를 신뢰하게 만드는 장치다.
 *
 * ⚠️ "AI가 계산" 이라고 쓰지 않는다 — 법정 산식을 그대로 계산하는 것이라 AI 가 아니다(사용자 결정).
 */
export function CalcLoadingView({ accentColor }: { accentColor: string }) {
  return (
    <div className="calc-loading">
      <div className="calc-spinner" style={{ borderTopColor: accentColor }} />
      <p className="calc-loading-t">탕감액을 계산하고 있어요</p>
      <p className="calc-loading-d">잠시만 기다려주세요</p>
    </div>
  );
}

/** 안내 문구의 `**강조**` 를 굵게, 줄바꿈(\n)을 문단으로. 마크다운 전체를 쓰려는 게 아니다. */
function renderNotice(text: string) {
  return text.split("\n").map((line, li) => (
    <p key={li} className="calc-notice-p">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
      )}
    </p>
  ));
}
