/**
 * 이 렌더러는 서브도메인 랜딩 전용이다({sub}.lead-pot.com/{id}, proxy.ts 가 /site/{sub}/{id} 로
 * 재작성해 처리한다). 이 루트 페이지는 예약 호스트(app·api 등)나 서브도메인 없이 워커에
 * 직접 접속했을 때만 보인다 — 정상 운영 트래픽은 여기 닿지 않는다(Cloudflare 라우팅이
 * app·api 는 개별 레코드로, 그 외 *.lead-pot.com 만 이 워커로 보낸다).
 */
export default function Home() {
  return (
    <main style={{ padding: 40, textAlign: "center", color: "#556" }}>
      <p>Leadpot 공개 랜딩 렌더러</p>
    </main>
  );
}
