/**
 * 로딩 표시 (U5).
 *
 * 그전엔 세 갈래로 흩어져 있었다 — `.page-loading`(전체 화면) ·
 * `<p className="dash-sub">불러오는 중…</p>`(구역 안) · `.inbox-empty`(인박스).
 * 전부 정적인 글자뿐이라 멈춘 건지 도는 건지 알기 어려웠다.
 * 여기로 모으고 회전 표시를 붙인다.
 */
export function Loading({
  full = false,
  label = "불러오는 중…",
}: {
  /** 화면 전체를 차지하는 로딩(페이지 진입 시). 기본은 구역 안 로딩. */
  full?: boolean;
  label?: string;
}) {
  return (
    <div className={full ? "page-loading" : "loading-inline"} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
