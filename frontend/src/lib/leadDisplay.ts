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

/** 목록에선 뒷자리를 가린다(개인정보). 상세 패널에선 전체 노출. */
export function maskPhone(v: string): string {
  return v.replace(/(\d{2,4})[-\s]?(\d{3,4})[-\s]?(\d{4})/, (_m, a, b) => `${a}-${b}-··`);
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
