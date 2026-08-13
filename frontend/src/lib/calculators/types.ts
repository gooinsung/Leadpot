import type { LeadAnswer } from "../../api/client";

/**
 * 리드팟 계산기 공통 규격.
 *
 * 계산기를 하나 추가하는 일 = {@link CalculatorDef} 하나를 만들어 `registry.ts` 에 등록하는 일이다.
 * 빌더 화면과 공개 폼 렌더러는 이 규격만 알고 있으므로 **계산기를 늘려도 화면 코드를 안 고친다.**
 */

/**
 * 계산기가 필요로 하는 입력 하나. 빌더가 이 스펙을 읽어 **질문 스텝을 자동 생성**한다
 * (마케터가 손으로 매핑하면 오매핑 시 결과가 조용히 틀리고, 그 책임은 우리에게 온다).
 */
export interface CalcInputSpec {
  /** 계산 입력 키. 자동 생성된 CHOICE 블록의 `content.calcInput` 에 이 값이 박힌다. */
  key: string;
  /** 질문 문구(그대로 스텝 제목이 된다). 마케터가 수정할 수 있다. */
  question: string;
  description?: string;
  /**
   * 없으면 결과가 **틀리는** 입력. 스텝을 지우면 빌더가 경고한다.
   * false 는 "빠져도 계산은 되지만 정확도가 떨어지는" 입력.
   */
  required: boolean;
  answerType: "number" | "single";
  placeholder?: string;
  /** 계산에 들어가는 단위(화면 안내용). 예: "만원" */
  unit?: string;
  /** answerType="single" 의 카드 선택지. `value` 가 계산에 들어가는 숫자 문자열이다. */
  options?: { label: string; desc?: string; value: string }[];
}

/** 결과 화면에 그릴 재료. 계산기마다 모양이 달라 표시용 문자열로 정규화해서 넘긴다. */
export interface CalcView {
  /** 정상 계산 여부. false 면 큰 숫자 대신 {@link notice} 를 보여준다(자격 미달 등). */
  ok: boolean;
  /** 큰 숫자 위 라벨. 예: "예상 탕감액" */
  headlineLabel: string;
  /** 큰 숫자. 예: "9,600만원" */
  headline: string;
  /** 큰 숫자 아래 보조 문구. 예: "탕감률 96.0% · 월 11만원씩 36개월" */
  headlineSub?: string;
  /** ok=false 일 때의 안내(그래도 상담으로 이어지는 문구여야 한다). */
  notice?: string;
  /** 접어서 보여주는 산출 근거. 사용자가 "왜 이 금액인지" 확인하는 곳. */
  breakdown: { label: string; value: string; hint?: string }[];
  /** 전제·주의(재산 0 가정 등). 반드시 화면에 노출한다. */
  warnings: string[];
}

export interface CalculatorDef {
  /** 블록에 저장되는 식별자. 한 번 정하면 바꾸지 않는다(저장된 폼이 이 키로 계산기를 찾는다). */
  key: string;
  name: string;
  description: string;
  /**
   * 강제 노출되는 면책 문구. **마케터가 지울 수 없다** —
   * 과장광고·전문자격 광고 규제 리스크가 리드팟으로 돌아오기 때문이다.
   */
  disclaimer: string;
  inputs: CalcInputSpec[];
  /**
   * 리드에 저장되는 결과 항목명들 = {@link toAnswers} 가 내는 label 목록.
   * 빌더가 **계산 없이** 문자·알림톡 변수 목록을 만들 때 쓴다(`{{예상 탕감액}}`).
   * {@link toAnswers} 와 어긋나면 마케터가 넣은 변수가 빈칸으로 나가므로 함께 고쳐야 한다.
   */
  outputLabels: string[];
  /** 원시 답변(문자열) → 화면 재료. 계산 함수 호출은 정의 내부에서 한다. */
  run(raw: Record<string, string>): CalcView;
  /**
   * 리드에 저장할 **결과** 답변들. 입력값은 질문 스텝이 이미 답변으로 저장하므로 여기 넣지 않는다.
   * 여기 label 이 그대로 구글시트 열 이름 · 문자 템플릿 변수(`{{예상 탕감액}}`)가 된다.
   */
  toAnswers(view: CalcView): LeadAnswer[];
}
