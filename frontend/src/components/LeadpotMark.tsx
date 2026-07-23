/** 리드팟 로고 마크 (인디고 팟 + 그린 물방울). */
export function LeadpotMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="mark"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <path
        d="M7 12h18l-1.6 12.2A3 3 0 0 1 20.4 27h-8.8a3 3 0 0 1-3-2.8L7 12Z"
        fill="var(--indigo)"
      />
      <path
        d="M16 3c2.6 3 4 5.2 4 7a4 4 0 1 1-8 0c0-1.8 1.4-4 4-7Z"
        fill="var(--green)"
      />
    </svg>
  );
}
