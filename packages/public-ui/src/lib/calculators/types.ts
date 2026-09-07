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
  /** 큰 숫자 위 라벨. 예: "나의 예상 탕감액은?" */
  headlineLabel: string;
  /** **가장 크게** 보여줄 값. 탕감률을 여기 둔다(금액보다 비율이 더 강하게 꽂힌다). 예: "96%" */
  headline: string;
  /** 큰 숫자 아래 강조 문구(금액). 예: "예상 탕감액 9,600만원" */
  headlineSub?: string;
  /** 그 아래 작은 보조 문구. 예: "월 11만원씩 36개월 상환" */
  headlineNote?: string;
  /** ok=false 일 때의 안내(그래도 상담으로 이어지는 문구여야 한다). */
  notice?: string;
  /** 접어서 보여주는 산출 근거. 사용자가 "왜 이 금액인지" 확인하는 곳. */
  breakdown: { label: string; value: string; hint?: string }[];
  /** 전제·주의(재산 0 가정 등). 반드시 화면에 노출한다. */
  warnings: string[];
  /**
   * 리드에 저장할 결과값. **키가 곧 답변 항목명이자 구글시트 열 이름**이다.
   * 표시 문구(headline 등)를 파싱해서 저장하면 문구를 손볼 때마다 저장이 조용히 깨진다 —
   * 그래서 기계용 값을 따로 들고 있는다. 키 목록은 {@link CalculatorDef.outputLabels} 와 같아야 한다.
   */
  data: Record<string, string>;
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
  /**
   * 연락처를 받기 **전에** 보여주는 유도 화면 문구.
   *
   * 흐름이 `질문 → 정보 입력 → 결과`(사용자 결정 2026-08-13)라서, 결과를 보기 직전 이 화면이
   * 유일한 설득 지점이다. 결과만 보고 이탈하는 걸 막고 리드를 확실히 남기는 구조다.
   */
  gate: {
    /** 큰 제목. 예: "어디서도 받을 수 없는 진단 결과" */
    title: string;
    /** 제목 아래 강조 한 줄. 예: "지금 바로 확인 가능합니다." */
    highlight: string;
    /** 체크 목록 — 정보를 넣으면 무엇을 받는지. `(괄호)` 안은 붉게 강조된다. */
    bullets: string[];
    /**
     * 이 계산기가 내는 값이 **무엇인지** 설명. 예: "탕감액이란 갚지 않아도 되는 금액".
     * 용어를 모르는 사람에게는 숫자만 커도 와닿지 않는다. `**강조**`·줄바꿈(`\n`) 지원.
     */
    explain: { title: string; body: string };
    /** 제출 버튼 문구. 예: "결과 바로 받기" */
    submitLabel: string;
  };
  /** 결과 화면 아래 붙는 후속 안내(상담 전화 등). 줄바꿈은 `\n`. */
  followUp: string;
  inputs: CalcInputSpec[];
  /**
   * 리드에 저장되는 결과 항목명들 = {@link toAnswers} 가 내는 label 목록.
   * 빌더가 **계산 없이** 문자·알림톡 변수 목록을 만들 때 쓴다(`{{예상 탕감액}}`).
   * {@link toAnswers} 와 어긋나면 마케터가 넣은 변수가 빈칸으로 나가므로 함께 고쳐야 한다.
   */
  outputLabels: string[];
  /**
   * 빌더 미리보기에 쓰는 예시 답변. 실제 방문자 입력 대신 이 값으로 결과 화면을 그린다 —
   * 마케터가 "접수 후 어떤 화면이 나가는지"를 저장 전에 볼 수 있어야 한다.
   * 계산기마다 입력 키가 달라 정의가 직접 들고 있는다.
   */
  sampleInput: Record<string, string>;
  /** 원시 답변(문자열) → 화면 재료. 계산 함수 호출은 정의 내부에서 한다. */
  run(raw: Record<string, string>): CalcView;
  /**
   * 리드에 저장할 **결과** 답변들. 입력값은 질문 스텝이 이미 답변으로 저장하므로 여기 넣지 않는다.
   * label 이 그대로 구글시트 열 이름 · 문자 템플릿 변수(`{{예상 탕감액}}`)가 된다.
   * 값은 {@link CalcView.data} 에서 가져온다 — 표시 문구를 파싱하지 않는다.
   */
  toAnswers(view: CalcView): LeadAnswer[];
}
