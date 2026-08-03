/**
 * 리드팟 워드마크 — `Lead`(브랜드 그린) + `Pot`(주변 글자색).
 *
 * `Pot` 을 currentColor 로 두는 이유: 어두운 LNB(밝은 글자)와 밝은 배경(어두운 글자) 양쪽에
 * 같은 컴포넌트를 그대로 쓰기 위해서다. 로고 색을 배경별로 따로 관리하지 않아도 된다.
 */
export function LeadpotWordmark({ size = 19 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span className="wordmark-lead">Lead</span>
      <span className="wordmark-pot">Pot</span>
    </span>
  );
}
