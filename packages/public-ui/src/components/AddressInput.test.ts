import { describe, expect, it } from "vitest";
import { formatAddress } from "./AddressInput";

const base = {
  zonecode: "06234",
  address: "서울 강남구 테헤란로 123",
  roadAddress: "서울 강남구 테헤란로 123",
  jibunAddress: "서울 강남구 역삼동 737",
  userSelectedType: "R" as const,
  bname: "",
  buildingName: "",
  apartment: "N" as const,
};

describe("formatAddress", () => {
  it("우편번호와 도로명 주소를 함께 저장한다", () => {
    expect(formatAddress(base)).toBe("(06234) 서울 강남구 테헤란로 123");
  });

  it("도로명이면 법정동·아파트명을 괄호로 덧붙인다", () => {
    expect(formatAddress({ ...base, bname: "역삼동", buildingName: "래미안", apartment: "Y" })).toBe(
      "(06234) 서울 강남구 테헤란로 123 (역삼동, 래미안)",
    );
  });

  it("아파트가 아닌 건물명은 붙이지 않는다", () => {
    expect(formatAddress({ ...base, bname: "역삼동", buildingName: "OO빌딩", apartment: "N" })).toBe(
      "(06234) 서울 강남구 테헤란로 123 (역삼동)",
    );
  });

  it("지번을 고르면 지번 주소를 쓰고 괄호 정보는 붙이지 않는다", () => {
    expect(formatAddress({ ...base, userSelectedType: "J", bname: "역삼동" })).toBe("(06234) 서울 강남구 역삼동 737");
  });
});
