import type { FormBlock } from "../api/client";

/**
 * 입력 항목 유형 — **기본형과 스텝형이 함께 쓰는 단일 출처**.
 *
 * 기본형의 입력 항목(FIELD.fieldType)과 스텝형 질문 단계의 답변 방식(CHOICE.content.answerType)이
 * 같은 목록에서 나온다. 여기에 유형을 하나 넣으면 두 편집기 모두에 뜨고, 두 공개 폼 모두 같은
 * {@link LiveField}(PublicFormView)로 그린다 — 기본형에만 생기고 스텝형엔 빠지는 일이 없게.
 *
 * 새 유형을 넣을 때 손볼 곳: 이 목록 + PublicFormView 의 LiveField(공개 화면) +
 * frontend BasicFormRenderer 의 FieldView(편집기 미리보기). 스텝형은 둘을 그대로 가져다 쓴다.
 */
export const INPUT_FIELD_TYPES: readonly { value: string; label: string }[] = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "textarea", label: "여러 줄" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
  { value: "select", label: "선택박스" },
  { value: "radio", label: "라디오버튼 (단일 선택)" },
  { value: "checkbox", label: "체크박스 (중복 선택)" },
];

/** 선택지 목록이 필요한 입력 유형. */
export const OPTION_FIELD_TYPES: readonly string[] = ["select", "radio", "checkbox"];

/** 스텝형에만 있는 카드형 선택 — 큰 버튼으로 고르고, 단일 카드는 고르면 바로 다음 단계로 넘어간다. */
export const STEP_CARD_TYPES: readonly { value: string; label: string }[] = [
  { value: "single", label: "단일 선택(카드)" },
  { value: "multi", label: "다중 선택(카드)" },
];

/** 스텝형 답변 방식 = 카드형 + 기본형 입력 유형 전체. */
export const STEP_ANSWER_TYPES: readonly { value: string; label: string }[] = [...STEP_CARD_TYPES, ...INPUT_FIELD_TYPES];

export function isCardAnswerType(t: string): boolean {
  return t === "single" || t === "multi";
}

/** 선택지를 펼쳐 보여주는 입력 유형(라디오=단일, 체크박스=중복). */
export function isListField(fieldType: string | null | undefined): boolean {
  return fieldType === "radio" || fieldType === "checkbox";
}

/**
 * 저장된 답변 방식을 지금 이름으로. 스텝형 '단일/다중 선택(목록)'(list_single/list_multi)은
 * 기본형의 라디오·체크박스와 같은 것이라 하나로 합쳤다 — 예전에 저장된 폼도 그대로 열린다.
 */
export function normalizeAnswerType(t: string | null | undefined): string {
  if (t === "list_single") return "radio";
  if (t === "list_multi") return "checkbox";
  return t || "single";
}

/** CHOICE 블록의 답변 방식(구 selectType·구 목록형 이름 포함). */
export function stepAnswerType(block: FormBlock): string {
  return normalizeAnswerType((block.content?.answerType as string) || (block.content?.selectType as string));
}

/**
 * 스텝형 질문(CHOICE)을 같은 유형의 입력 항목(FIELD)으로 본 모양 — 스텝형이 기본형의 입력 컴포넌트를
 * 그대로 쓰기 위한 변환. 질문 선택지 `{label}` 는 기본형 `options.choices`(문자열)로 옮긴다.
 */
export function choiceAsField(block: FormBlock): FormBlock {
  const opts = (block.content?.options as { label?: string }[]) ?? [];
  return {
    ...block,
    blockType: "FIELD",
    fieldType: stepAnswerType(block),
    label: (block.content?.question as string) || "",
    required: block.content?.required === true,
    placeholder: (block.content?.placeholder as string) || "",
    options: { choices: opts.map((o) => o.label ?? ""), defaultIndex: block.content?.defaultIndex },
  };
}

/**
 * 라디오·체크박스의 선택 상태는 라벨이 아니라 **선택지 인덱스("0,2")** 로 둔다 —
 * 라벨에 쉼표가 들어가도 고른 것을 되짚을 수 있게. 접수할 때 {@link fieldAnswer} 가 라벨로 바꾼다.
 */
export function parsePicked(value: string): number[] {
  return value ? value.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [];
}

/** 입력 항목의 접수 값. 라디오·체크박스는 고른 라벨을 선택지 순서대로 ", " 로 잇는다(카드 다중 선택과 같은 형식). */
export function fieldAnswer(block: FormBlock, value: string | undefined): string {
  if (!isListField(block.fieldType)) return value ?? "";
  const list = (block.options?.choices as string[]) ?? [];
  return parsePicked(value ?? "").sort((a, b) => a - b).map((ci) => list[ci] || `선택지 ${ci + 1}`).join(", ");
}

/** '기본 선택'(options.defaultIndex)을 입력 항목의 초기값으로. 없거나 선택지 밖이면 null. */
export function fieldDefaultValue(block: FormBlock): string | null {
  if (!OPTION_FIELD_TYPES.includes(block.fieldType ?? "")) return null;
  const list = (block.options?.choices as string[]) ?? [];
  const di = block.options?.defaultIndex;
  if (typeof di !== "number" || list[di] == null) return null;
  return isListField(block.fieldType) ? String(di) : list[di];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\-()\s]+$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** 입력 항목 검증(필수·형식). 에러 메시지 또는 null(통과). 라디오·체크박스는 '골랐는가'만 본다. */
export function fieldBlockError(block: FormBlock, value: string | undefined): string | null {
  const name = block.label && block.label.trim() ? block.label : "이 항목";
  const type = block.fieldType || "text";
  if (isListField(type)) {
    return block.required && parsePicked(value ?? "").length === 0 ? `'${name}' 항목을 선택해주세요.` : null;
  }
  const v = (value ?? "").trim();
  if (!v) return block.required ? `'${name}' 항목을 입력해주세요.` : null;
  if (type === "email" && !EMAIL_RE.test(v)) return `'${name}' 이메일 형식이 올바르지 않습니다.`;
  if (type === "tel") {
    const digits = v.replace(/\D/g, "");
    if (!TEL_RE.test(v) || digits.length < 9 || digits.length > 15) return `'${name}' 연락처는 숫자로 올바르게 입력해주세요.`;
  }
  if (type === "number" && !NUMBER_RE.test(v)) return `'${name}' 는 숫자만 입력할 수 있습니다.`;
  return null;
}
