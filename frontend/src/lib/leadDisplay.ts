import { LEAD_STATUSES, type LeadAnswer } from "../api/client";

/**
 * 리드 목록 표시용 공통 헬퍼 (U3).
 * 폼별 목록(LeadsListPage)과 통합 인박스(LeadInboxPage)가 같은 규칙으로 요약을 만든다.
 */

/** 마케터 상태 코드 → 한글 라벨. */
export function leadStatusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

const NAME_RE = /이름|성함|name/i;
const PHONE_RE = /연락처|전화|휴대|phone|tel/i;
const PHONE_VALUE_RE = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/;

/** 답변에서 이름으로 보이는 값(없으면 첫 답변). */
export function pickName(answers: LeadAnswer[]): string {
  const byLabel = answers.find((a) => NAME_RE.test(a.label));
  return (byLabel?.value || answers[0]?.value || "—").trim();
}

/** 답변에서 연락처로 보이는 값(라벨 우선, 없으면 값 패턴). */
export function pickPhone(answers: LeadAnswer[]): string | null {
  const byLabel = answers.find((a) => PHONE_RE.test(a.label));
  const cand = byLabel?.value || answers.find((a) => PHONE_VALUE_RE.test(a.value))?.value;
  return cand ? cand.trim() : null;
}

/** 전화번호로 볼 수 있는 형태(숫자·공백·괄호·+·하이픈만). */
const PHONE_ONLY_RE = /^[\d\s()+-]+$/;

/**
 * 목록에선 뒷자리를 가린다(개인정보). 상세 패널에선 전체 노출.
 * 뒤 4자리를 가리고 앞부분에 표준 하이픈을 넣는다 — 국번은 02(서울)만 2자리, 나머지는 3자리.
 * 예) 01011111111 → 010-1111-·· / 0212345678 → 02-1234-··
 * 전화번호로 보이지 않으면 원본을 그대로 둔다.
 */
export function maskPhone(v: string): string {
  if (!PHONE_ONLY_RE.test(v.trim())) return v;
  const digits = v.replace(/\D/g, "");
  const head = digits.slice(0, -4);
  // 국내 번호(9~11자리)는 표준 하이픈으로, 그 외(국제표기 등)는 형식 없이 —
  // 어느 쪽이든 뒤 4자리는 반드시 가린다.
  if (digits.length >= 9 && digits.length <= 11) {
    const areaLen = head.startsWith("02") ? 2 : 3;
    return `${head.slice(0, areaLen)}-${head.slice(areaLen)}-··`;
  }
  if (digits.length >= 7) return `${head}-··`;
  return v;
}

/**
 * 이름·연락처 칸에 이미 보여준 값을 뺀 "나머지 답변" 한 줄 요약.
 * 예) "30대 · 강남구 · 방문상담 희망". 값이 빈 항목은 건너뛴다.
 * shown 에 이미 노출한 값(이름·연락처)을 넘기면 중복 표시를 막는다.
 */
export function summarizeAnswers(answers: LeadAnswer[], shown: (string | null)[] = []): string {
  const skip = new Set(shown.filter(Boolean).map((v) => (v as string).trim()));
  return answers
    .filter((a) => !NAME_RE.test(a.label) && !PHONE_RE.test(a.label))
    .map((a) => (a.value || "").trim())
    .filter((v) => v && !skip.has(v))
    .join(" · ");
}
