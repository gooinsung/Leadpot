import { describe, expect, it } from "vitest";
import type { FormBlock } from "../api/client";
import {
  INPUT_FIELD_TYPES,
  buttonChoiceRows,
  isMultiPick,
  addressDetailParts,
  answerParts,
  STEP_ANSWER_TYPES,
  choiceAsField,
  fieldAnswer,
  fieldBlockError,
  fieldDefaultValue,
  fieldSaveValues,
  joinGroupPicks,
  parseGroupPicks,
  joinAddressDetail,
  normalizeAnswerType,
  splitAddressDetail,
  stepAnswerType,
} from "./fieldTypes";

const field = (p: Partial<FormBlock>): FormBlock => ({ sortOrder: 0, blockType: "FIELD", ...p }) as FormBlock;
const choice = (content: Record<string, unknown>): FormBlock => ({ sortOrder: 0, blockType: "CHOICE", content }) as FormBlock;

describe("fieldTypes", () => {
  it("숫자 항목은 최소·최대값 밖이면 막는다", () => {
    const f = field({ fieldType: "number", label: "나이", options: { minNumber: "20", maxNumber: "65" } });
    expect(fieldBlockError(f, "19")).toBe("'나이' 는 20 ~ 65 사이로 입력해주세요.");
    expect(fieldBlockError(f, "66")).toBe("'나이' 는 20 ~ 65 사이로 입력해주세요.");
    expect(fieldBlockError(f, "20")).toBeNull();
    expect(fieldBlockError(f, "65")).toBeNull();
    expect(fieldBlockError(field({ fieldType: "number", label: "금액", options: { minNumber: "1000" } }), "999")).toBe("'금액' 는 1,000 이상으로 입력해주세요.");
    expect(fieldBlockError(field({ fieldType: "number", label: "금액", options: { maxNumber: "10" } }), "11")).toBe("'금액' 는 10 이하로 입력해주세요.");
    // 비어 있으면 제한 없음
    expect(fieldBlockError(field({ fieldType: "number", label: "x", options: { minNumber: "", maxNumber: "" } }), "-5")).toBeNull();
    // 스텝형 질문(content)도 같은 범위를 쓴다
    const step = choiceAsField(choice({ question: "나이", answerType: "number", minNumber: "20" }));
    expect(fieldBlockError(step, "10")).toBe("'나이' 는 20 이상으로 입력해주세요.");
  });

  it("스텝형 답변 방식은 기본형 입력 유형을 전부 포함한다", () => {
    const step = STEP_ANSWER_TYPES.map((t) => t.value);
    for (const t of INPUT_FIELD_TYPES) expect(step).toContain(t.value);
  });

  it("구 목록형은 라디오·체크박스로 읽힌다", () => {
    expect(normalizeAnswerType("list_single")).toBe("radio");
    expect(normalizeAnswerType("list_multi")).toBe("checkbox");
    expect(normalizeAnswerType(undefined)).toBe("single");
    expect(stepAnswerType(choice({ selectType: "multi" }))).toBe("multi");
  });

  it("체크박스 답변은 라벨을 선택지 순서대로 잇는다 — 쉼표가 든 라벨도 안전", () => {
    const b = field({ fieldType: "checkbox", options: { choices: ["A, B", "C", "D"] } });
    expect(fieldAnswer(b, "2,0")).toBe("A, B, D");
    expect(fieldAnswer(b, "")).toBe("");
  });

  it("스텝형 질문을 입력 항목으로 바꾸면 같은 규칙으로 검증·접수된다", () => {
    const f = choiceAsField(
      choice({ question: "관심 분야", answerType: "list_multi", required: true, options: [{ label: "X" }, { label: "Y" }], defaultIndex: 1 }),
    );
    expect(f.fieldType).toBe("checkbox");
    expect(fieldBlockError(f, "")).toBe("'관심 분야' 항목을 선택해주세요.");
    expect(fieldBlockError(f, "0")).toBeNull();
    expect(fieldAnswer(f, "0,1")).toBe("X, Y");
    expect(fieldDefaultValue(f)).toBe("1");
  });

  it("선택박스 기본값은 라벨, 형식 검증은 기존과 같다", () => {
    expect(fieldDefaultValue(field({ fieldType: "select", options: { choices: ["a", "b"], defaultIndex: 1 } }))).toBe("b");
    expect(fieldBlockError(field({ fieldType: "email", label: "메일" }), "x")).toBe("'메일' 이메일 형식이 올바르지 않습니다.");
    expect(fieldBlockError(field({ fieldType: "text", label: "이름", required: true }), " ")).toBe("'이름' 항목을 입력해주세요.");
  });

  it("주소 + 상세주소: 입력 중엔 줄바꿈으로 나눠 두고, 접수할 땐 공백으로 잇는다", () => {
    const f = field({ fieldType: "address_detail", label: "주소", required: true });
    const v = joinAddressDetail("(06234) 서울 강남구 테헤란로 123", "101동 1203호");
    expect(splitAddressDetail(v)).toEqual(["(06234) 서울 강남구 테헤란로 123", "101동 1203호"]);
    expect(fieldAnswer(f, v)).toBe("(06234) 서울 강남구 테헤란로 123 101동 1203호");
    expect(fieldBlockError(f, v)).toBeNull();
    expect(fieldBlockError(f, "")).toBe("'주소' 주소를 검색해주세요.");
    expect(fieldBlockError(f, joinAddressDetail("", "101호"))).toBe("'주소' 주소를 검색해주세요.");
    expect(fieldBlockError(f, "(06234) 서울 강남구 테헤란로 123")).toBe("'주소' 상세주소(동·호수)를 입력해주세요.");
    // 선택 항목은 상세주소를 비워도 된다.
    const opt = field({ fieldType: "address_detail", label: "주소" });
    expect(fieldBlockError(opt, "")).toBeNull();
    expect(fieldBlockError(opt, "(06234) 서울 강남구 테헤란로 123")).toBeNull();
    expect(fieldAnswer(opt, "(06234) 서울 강남구 테헤란로 123")).toBe("(06234) 서울 강남구 테헤란로 123");
  });

  it("주소 + 상세주소: 외부 API 전달용으로 두 칸을 따로 남긴다(다른 유형은 없음)", () => {
    const f = field({ fieldType: "address_detail", label: "주소" });
    const v = joinAddressDetail("(06234) 서울 강남구 테헤란로 123", " 101동 1203호 ");
    expect(addressDetailParts(f, v)).toEqual({ address: "(06234) 서울 강남구 테헤란로 123", addressDetail: "101동 1203호" });
    expect(addressDetailParts(f, "(06234) 서울 강남구 테헤란로 123")).toEqual({ address: "(06234) 서울 강남구 테헤란로 123", addressDetail: "" });
    expect(addressDetailParts(field({ fieldType: "address" }), "서울")).toEqual({});
    // 스텝형 질문도 choiceAsField 를 거치면 같은 결과.
    expect(addressDetailParts(choiceAsField(choice({ question: "주소", answerType: "address_detail" })), v).addressDetail).toBe("101동 1203호");
  });

  it("라디오 묶음: 외부 API 전달용으로 질문(행)별 답을 저장값으로 남긴다", () => {
    const f = field({ fieldType: "radio_group", options: { rows: ["입주 청소", "인터넷 가입"], choices: ["희망", "필요 없음"], saveValues: ["Y", ""] } });
    expect(answerParts(f, "0,1")).toEqual({ groupAnswers: ["Y", "필요 없음"] });
    expect(answerParts(f, ",1")).toEqual({ groupAnswers: ["", "필요 없음"] });
    expect(answerParts(field({ fieldType: "text" }), "x")).toEqual({});
  });

  it("선택지 DB 저장값: 보이는 라벨 대신 저장값으로 접수하고, 비면 라벨 그대로", () => {
    const options = { choices: ["가정 이사", "사무실 이사", "기타"], saveValues: ["가정이사(방문 견적)", "사무실 이사 (방문 견적)", ""] };
    expect(fieldAnswer(field({ fieldType: "radio", options }), "1")).toBe("사무실 이사 (방문 견적)");
    expect(fieldAnswer(field({ fieldType: "checkbox", options }), "2,0")).toBe("가정이사(방문 견적), 기타");
    expect(fieldAnswer(field({ fieldType: "select", options }), "가정 이사")).toBe("가정이사(방문 견적)");
    expect(fieldAnswer(field({ fieldType: "select", options }), "기타")).toBe("기타");
    expect(fieldSaveValues(field({ fieldType: "select", options }))).toEqual(["가정이사(방문 견적)", "사무실 이사 (방문 견적)", "기타"]);
    // 저장값이 없는 예전 폼은 그대로
    expect(fieldAnswer(field({ fieldType: "radio", options: { choices: ["A", "B"] } }), "1")).toBe("B");
    // 스텝형 질문(saveAs)도 같은 규칙
    const q = choiceAsField(choice({ answerType: "radio", options: [{ label: "가정 이사", saveAs: "가정이사(방문 견적)" }, { label: "사무실 이사" }] }));
    expect(fieldAnswer(q, "0")).toBe("가정이사(방문 견적)");
    expect(fieldAnswer(q, "1")).toBe("사무실 이사");
  });

  it("라디오 묶음: 질문마다 고른 답을 '질문: 답 / 질문: 답' 으로 접수한다", () => {
    const f = field({
      fieldType: "radio_group",
      label: "패키지 혜택",
      required: true,
      options: { rows: ["입주청소", "인터넷 이동"], choices: ["미선택", "필요", "불필요"], saveValues: ["", "필요(연결)", ""], defaultIndex: 0 },
    });
    expect(parseGroupPicks("0,,2", 3)).toEqual([0, null, 2]);
    expect(joinGroupPicks([1, null])).toBe("1,");
    expect(fieldDefaultValue(f)).toBe("0,0");
    expect(fieldAnswer(f, "1,2")).toBe("입주청소: 필요(연결) / 인터넷 이동: 불필요");
    expect(fieldBlockError(f, "1,2")).toBeNull();
    expect(fieldBlockError(f, "1,")).toBe("'패키지 혜택'의 '인터넷 이동' 항목을 선택해주세요.");
    expect(fieldBlockError({ ...f, required: false }, "")).toBeNull();
    expect(fieldAnswer(f, "")).toBe("");
    // 스텝형 질문(content.rows)도 같은 규칙
    const q = choiceAsField(choice({ answerType: "radio_group", rows: ["A"], options: [{ label: "예" }, { label: "아니오" }] }));
    expect(fieldAnswer(q, "1")).toBe("A: 아니오");
  });
});

describe("buttonChoiceRows — '버튼 선택' 가로 정렬 줄 나누기", () => {
  it("3개 이하는 한 줄", () => {
    expect(buttonChoiceRows(1)).toEqual([1]);
    expect(buttonChoiceRows(2)).toEqual([2]);
    expect(buttonChoiceRows(3)).toEqual([3]);
  });
  it("홀수는 첫 줄 3개 + 나머지 2개씩", () => {
    expect(buttonChoiceRows(5)).toEqual([3, 2]);
    expect(buttonChoiceRows(7)).toEqual([3, 2, 2]);
    expect(buttonChoiceRows(9)).toEqual([3, 2, 2, 2]);
  });
  it("짝수는 2개씩", () => {
    expect(buttonChoiceRows(4)).toEqual([2, 2]);
    expect(buttonChoiceRows(6)).toEqual([2, 2, 2]);
  });
  it("세로 정렬은 한 줄에 하나, 0개는 빈 배열", () => {
    expect(buttonChoiceRows(3, "vertical")).toEqual([1, 1, 1]);
    expect(buttonChoiceRows(0)).toEqual([]);
  });
});

describe("버튼 선택 값 처리", () => {
  const block = (multiple: boolean) =>
    ({ blockType: "FIELD", fieldType: "button_choice", label: "이용타입", required: true, sortOrder: 0, options: { choices: ["장기렌트", "자동차리스"], multiple } }) as FormBlock;
  it("라디오·체크박스처럼 인덱스 → 라벨로 접수하고, 필수 검증한다", () => {
    expect(isMultiPick(block(false))).toBe(false);
    expect(isMultiPick(block(true))).toBe(true);
    expect(fieldAnswer(block(true), "1,0")).toBe("장기렌트, 자동차리스");
    expect(fieldBlockError(block(false), "")).toContain("선택");
    expect(fieldBlockError(block(false), "0")).toBeNull();
  });
});
