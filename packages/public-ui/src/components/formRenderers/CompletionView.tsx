/** 제출 완료 후 화면(C2) 미리보기 — 감사 메시지 또는 리다이렉트 안내. */
export function CompletionView({
  config,
  accent,
}: {
  config?: Record<string, unknown> | null;
  accent?: string;
}) {
  const mode = (config?.mode as string) || "message";

  if (mode === "redirect") {
    const url = (config?.redirectUrl as string) || "";
    return (
      <div className="completion">
        <p className="completion-note">
          제출 후 다음 주소로 이동합니다:
          <br />
          <span className="completion-url">{url || "(URL 미설정)"}</span>
        </p>
      </div>
    );
  }

  const title = (config?.title as string) || "신청이 완료되었습니다";
  const message = (config?.message as string) || "";
  return (
    <div className="completion">
      <div className="completion-check" style={accent ? { background: accent } : undefined}>
        ✓
      </div>
      <h3 className="completion-title">{title}</h3>
      {message && <p className="completion-msg">{message}</p>}
    </div>
  );
}
