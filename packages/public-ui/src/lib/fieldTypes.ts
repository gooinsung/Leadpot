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
  { value: "address", label: "주소 (우편번호 검색)" },
  { value: "address_detail", label: "주소 + 상세주소 (우편번호 검색 + 동·호수)" },
  { value: "select", label: "선택박스" },
  { value: "radio", label: "라디오버튼 (단일 선택)" },
  { value: "checkbox", label: "체크박스 (중복 선택)" },
  { value: "radio_group", label: "라디오 묶음 (여러 질문 · 같은 선택지)" },
];

/** 선택지 목록이 필요한 입력 유형. */
export const OPTION_FIELD_TYPES: readonly string[] = ["select", "radio", "checkbox", "radio_group"];

/**
 * '라디오 묶음' — 한 항목 안에 여러 질문(options.rows)을 두고, 질문마다 같은 선택지(options.choices)를
 * 라디오로 하나씩 고른다(예: 패키지 혜택 > 입주청소 / 인터넷 이동 각각 미선택·필요·불필요). 사용자 지시 2026-10-12.
 * 입력 중 값은 질문 순서대로 고른 선택지 인덱스를 쉼표로 잇는다 — 안 고른 질문은 빈칸("0,,2").
 * 접수 값은 `질문: 답 / 질문: 답` 한 문자열(리드 한 칸).
 */
export const GROUP_DEFAULT_CHOICES: readonly string[] = ["미선택", "필요", "불필요"];

export function groupRows(block: FormBlock): string[] {
  return (block.options?.rows as string[] | undefined) ?? [];
}

export function parseGroupPicks(value: string | undefined, rowCount: number): (number | null)[] {
  const parts = (value ?? "").split(",");
  return Array.from({ length: rowCount }, (_, ri) => {
    const n = parts[ri] === undefined || parts[ri] === "" ? NaN : Number(parts[ri]);
    return Number.isInteger(n) && n >= 0 ? n : null;
  });
}

export function joinGroupPicks(picks: (number | null)[]): string {
  return picks.map((p) => (p == null ? "" : String(p))).join(",");
}

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
  const opts = (block.content?.options as { label?: string; saveAs?: string }[]) ?? [];
  return {
    ...block,
    blockType: "FIELD",
    fieldType: stepAnswerType(block),
    label: (block.content?.question as string) || "",
    required: block.content?.required === true,
    placeholder: (block.content?.placeholder as string) || "",
    options: {
      rows: (block.content?.rows as string[] | undefined) ?? [],
      choices: opts.map((o) => o.label ?? ""),
      saveValues: opts.map((o) => o.saveAs ?? ""),
      defaultIndex: block.content?.defaultIndex,
      minDate: block.content?.minDate,
      maxDate: block.content?.maxDate,
      jibun: block.content?.jibun,
    },
  };
}

/**
 * 라디오·체크박스의 선택 상태는 라벨이 아니라 **선택지 인덱스("0,2")** 로 둔다 —
 * 라벨에 쉼표가 들어가도 고른 것을 되짚을 수 있게. 접수할 때 {@link fieldAnswer} 가 라벨로 바꾼다.
 */
export function parsePicked(value: string): number[] {
  return value ? value.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [];
}

/**
 * '주소 + 상세주소' 입력 중 값 — 검색한 주소와 상세주소(동·호수)를 줄바꿈 하나로 이어 한 문자열로 둔다
 * (폼 값은 항목당 문자열 하나). 주소 검색 결과·한 줄 입력칸에는 줄바꿈이 들어갈 수 없어 안전하다.
 * 접수할 때 {@link fieldAnswer} 가 공백으로 이어 `(우편번호) 주소 상세주소` 로 바꾼다.
 */
export function splitAddressDetail(value: string | undefined): [string, string] {
  const v = value ?? "";
  const i = v.indexOf("\n");
  return i < 0 ? [v, ""] : [v.slice(0, i), v.slice(i + 1)];
}

export function joinAddressDetail(base: string, detail: string): string {
  return detail ? `${base}\n${detail}` : base;
}

/**
 * '주소 + 상세주소' 항목의 두 칸을 따로 — 리드 답변에 `address`·`addressDetail` 로 함께 남긴다.
 * value(합친 문자열)만으로는 주소 끝과 상세주소 시작을 다시 가를 수 없어서, 외부 API 전달(아웃바운드)에서
 * 주소·상세주소를 서로 다른 파라미터로 보내려면 접수 시점에 나눠 둬야 한다(사용자 지시 2026-10-16).
 * 다른 유형이면 빈 객체.
 */
export function addressDetailParts(block: FormBlock, value: string | undefined): { address?: string; addressDetail?: string } {
  if (block.fieldType !== "address_detail") return {};
  const [base, detail] = splitAddressDetail(value);
  return { address: base.trim(), addressDetail: detail.trim() };
}

/**
 * 선택지의 **DB 저장값** — 방문자에게 보이는 선택지(라벨)와 리드에 저장되는 값을 다르게 둘 수 있다
 * (예: 보이는 건 '가정 이사', 저장은 '가정이사(방문 견적)'). 사용자 지시 2026-10-12.
 * 기본형 항목은 `options.saveValues`(choices 와 같은 순서의 문자열 배열), 스텝형 질문은 선택지마다
 * `saveAs` 에 둔다. 비어 있으면 라벨을 그대로 저장한다 — 예전 폼은 그대로 동작.
 */
export function choiceSaveValue(label: string | undefined, saveAs: string | undefined, index: number): string {
  return saveAs?.trim() || label || `선택지 ${index + 1}`;
}

/** 입력 항목(선택박스·라디오·체크박스)의 선택지별 저장값 목록 — 수기 등록처럼 저장값으로 고르는 곳에서 쓴다. */
export function fieldSaveValues(block: FormBlock): string[] {
  const list = (block.options?.choices as string[]) ?? [];
  const save = (block.options?.saveValues as string[] | undefined) ?? [];
  return list.map((c, i) => choiceSaveValue(c, save[i], i));
}

/** 입력 항목의 접수 값(선택지는 DB 저장값으로). 라디오·체크박스는 고른 라벨을 선택지 순서대로 ", " 로 잇는다(카드 다중 선택과 같은 형식). */
export function fieldAnswer(block: FormBlock, value: string | undefined): string {
  if (block.fieldType === "address_detail") {
    const [base, detail] = splitAddressDetail(value);
    return [base.trim(), detail.trim()].filter(Boolean).join(" ");
  }
  const list = (block.options?.choices as string[]) ?? [];
  const save = (block.options?.saveValues as string[] | undefined) ?? [];
  if (block.fieldType === "radio_group") {
    const rows = groupRows(block);
    return parseGroupPicks(value, rows.length)
      .map((ci, ri) => (ci == null || list[ci] == null ? null : `${rows[ri] || `질문 ${ri + 1}`}: ${choiceSaveValue(list[ci], save[ci], ci)}`))
      .filter(Boolean)
      .join(" / ");
  }
  if (block.fieldType === "select") {
    // 선택박스는 고른 라벨을 값으로 들고 있다 → 저장값이 있으면 그걸로 바꾼다.
    const ci = value ? list.indexOf(value) : -1;
    return ci >= 0 ? choiceSaveValue(list[ci], save[ci], ci) : value ?? "";
  }
  if (!isListField(block.fieldType)) return value ?? "";
  return parsePicked(value ?? "").sort((a, b) => a - b).map((ci) => choiceSaveValue(list[ci], save[ci], ci)).join(", ");
}

/** '기본 선택'(options.defaultIndex)을 입력 항목의 초기값으로. 없거나 선택지 밖이면 null. */
export function fieldDefaultValue(block: FormBlock): string | null {
  if (!OPTION_FIELD_TYPES.includes(block.fieldType ?? "")) return null;
  const list = (block.options?.choices as string[]) ?? [];
  const di = block.options?.defaultIndex;
  if (typeof di !== "number" || list[di] == null) return null;
  if (block.fieldType === "radio_group") return joinGroupPicks(groupRows(block).map(() => di));
  return isListField(block.fieldType) ? String(di) : list[di];
}

/**
 * '날짜' 항목의 선택 가능 범위(options.minDate / options.maxDate). 사용자 지시 2026-10-15.
 * 값은 둘 중 하나 — 비어 있으면 제한 없음:
 *  - 고정 날짜 `YYYY-MM-DD`
 *  - 오늘 기준 `+N`(N일 후, `+0`=오늘) / `-N`(N일 전) — 날짜를 안 바꿔도 매일 저절로 맞춰진다.
 * 방문자 기기의 오늘(현지 날짜)을 기준으로 한다.
 */
const FIXED_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE_DATE_RE = /^[+-]\d{1,5}$/;

export function isRelativeDateBound(spec: unknown): spec is string {
  return typeof spec === "string" && RELATIVE_DATE_RE.test(spec);
}

function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 범위 지정값 → 실제 날짜(`YYYY-MM-DD`). 지정 안 했거나 형식이 틀리면 undefined. */
export function resolveDateBound(spec: unknown, today: Date = new Date()): string | undefined {
  if (typeof spec !== "string") return undefined;
  if (FIXED_DATE_RE.test(spec)) return spec;
  if (RELATIVE_DATE_RE.test(spec)) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + Number(spec));
    return ymdLocal(d);
  }
  return undefined;
}

/** 날짜 항목의 [최소, 최대] — input 의 min/max 와 검증이 같은 값을 쓴다. */
export function dateRange(block: FormBlock): { min?: string; max?: string } {
  return { min: resolveDateBound(block.options?.minDate), max: resolveDateBound(block.options?.maxDate) };
}

/** '2026-10-15' → '2026년 10월 15일' (안내 문구용). */
function koDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
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
  if (type === "radio_group") {
    if (!block.required) return null;
    const rows = groupRows(block);
    const list = (block.options?.choices as string[]) ?? [];
    const picks = parseGroupPicks(value, rows.length);
    const ri = picks.findIndex((ci) => ci == null || list[ci] == null);
    return ri < 0 ? null : `'${name}'의 '${rows[ri] || `질문 ${ri + 1}`}' 항목을 선택해주세요.`;
  }
  if (type === "address_detail") {
    const [base, detail] = splitAddressDetail(value);
    const hasBase = base.trim() !== "";
    const hasDetail = detail.trim() !== "";
    if (!hasBase && !hasDetail) return block.required ? `'${name}' 주소를 검색해주세요.` : null;
    if (!hasBase) return `'${name}' 주소를 검색해주세요.`;
    // 필수 항목이면 동·호수까지 받는다(이 유형을 고른 이유). 선택 항목은 비워도 된다.
    if (!hasDetail && block.required) return `'${name}' 상세주소(동·호수)를 입력해주세요.`;
    return null;
  }
  const v = (value ?? "").trim();
  if (!v) return block.required ? `'${name}' 항목을 입력해주세요.` : null;
  if (type === "email" && !EMAIL_RE.test(v)) return `'${name}' 이메일 형식이 올바르지 않습니다.`;
  if (type === "tel") {
    const digits = v.replace(/\D/g, "");
    if (!TEL_RE.test(v) || digits.length < 9 || digits.length > 15) return `'${name}' 연락처는 숫자로 올바르게 입력해주세요.`;
  }
  if (type === "number" && !NUMBER_RE.test(v)) return `'${name}' 는 숫자만 입력할 수 있습니다.`;
  if (type === "date") {
    // 달력 선택기가 min/max 를 무시하는 브라우저(직접 입력 등)도 있어 접수 전에 한 번 더 본다.
    const { min, max } = dateRange(block);
    if (min && v < min) return `'${name}' 는 ${koDate(min)} 이후로 선택해주세요.`;
    if (max && v > max) return `'${name}' 는 ${koDate(max)} 이전으로 선택해주세요.`;
  }
  return null;
}
