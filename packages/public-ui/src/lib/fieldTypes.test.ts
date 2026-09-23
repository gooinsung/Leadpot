import { describe, expect, it } from "vitest";
import type { FormBlock } from "../api/client";
import {
  INPUT_FIELD_TYPES,
  STEP_ANSWER_TYPES,
  choiceAsField,
  fieldAnswer,
  fieldBlockError,
  fieldDefaultValue,
  normalizeAnswerType,
  stepAnswerType,
} from "./fieldTypes";

const field = (p: Partial<FormBlock>): FormBlock => ({ sortOrder: 0, blockType: "FIELD", ...p }) as FormBlock;
const choice = (content: Record<string, unknown>): FormBlock => ({ sortOrder: 0, blockType: "CHOICE", content }) as FormBlock;

describe("fieldTypes", () => {
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
});
