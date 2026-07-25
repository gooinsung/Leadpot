/**
 * M8 동적 요소 스니펫 — 랜딩 HTML 블록에 삽입한다.
 * data-lp-live 마커가 있는 요소는 공개 랜딩이 렌더 시 실시간 데이터(신청수·남은자리)로 채운다.
 * 마커 없는 스니펫(플로팅 헤더/푸터)은 정적 HTML(위치 고정)로 그대로 표시된다.
 */
export interface DynamicSnippet {
  key: string;
  label: string;
  html: string;
}

export const DYNAMIC_SNIPPETS: DynamicSnippet[] = [
  {
    key: "count",
    label: "실시간 신청 수",
    html: `<p style="text-align:center;font-weight:700;font-size:16px">지금까지 <span data-lp-live="count">0</span>명이 신청했어요!</p>`,
  },
  {
    key: "slots",
    label: "남은 자리(마감 임박)",
    html: `<p style="text-align:center;color:#e8590c;font-weight:800;font-size:16px">🔥 선착순 마감 임박! 남은 자리 <span data-lp-live="slots" data-target="100">100</span>개</p>`,
  },
  {
    key: "recent-toast",
    label: "최근 신청자 토스트(우측 상단)",
    html: `<div data-lp-live="recent-toast"></div>`,
  },
  {
    key: "float-header",
    label: "플로팅 헤더(상단 고정)",
    html: `<div style="position:fixed;top:0;left:0;right:0;background:#3a43c0;color:#fff;padding:12px 16px;text-align:center;font-weight:700;z-index:9998">지금 신청하고 특별 혜택 받으세요</div>`,
  },
  {
    key: "float-footer",
    label: "플로팅 CTA 푸터(하단 고정)",
    html: `<a href="#" style="position:fixed;bottom:0;left:0;right:0;background:#12b886;color:#fff;padding:16px;text-align:center;font-weight:800;font-size:16px;z-index:9998;text-decoration:none">✅ 지금 바로 신청하기</a>`,
  },
];
