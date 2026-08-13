import type { CalcView } from "../../lib/calculators/types";

/**
 * 계산기 결과 화면. **계산기 종류와 무관한 범용 렌더러**다 —
 * {@link CalcView} 만 보고 그리므로 새 계산기를 추가해도 이 파일을 고치지 않는다.
 *
 * 표시 방침(사용자 결정 2026-08-13): 큰 숫자를 앞세우고 **산출 근거를 접어서 함께** 제공한다.
 * 전환율은 큰 숫자가 만들지만 상담 신뢰도는 근거가 만든다.
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
          <span className="calc-headline-value" style={{ color: accentColor }}>
            {view.headline}
          </span>
          {view.headlineSub && <span className="calc-headline-sub">{view.headlineSub}</span>}
        </div>
      ) : (
        view.notice && <p className="calc-notice">{renderEmphasis(view.notice)}</p>
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

/** 안내 문구의 `**강조**` 를 굵게. 마크다운 전체를 쓰려는 게 아니라 이 한 가지만 지원한다. */
function renderEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}
