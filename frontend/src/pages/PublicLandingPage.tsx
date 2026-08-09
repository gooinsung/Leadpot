import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { useParams } from "react-router-dom";
import { getLandingPreview, type PublicLanding } from "../api/client";
import { LandingView } from "../components/LandingView";

/**
 * /p/{slug} — 소유자 전용 미리보기(공개용 아님).
 * 로그인한 본인 소유 랜딩만 열리며 draft(비공개)도 확인 가능. 남의 것/비로그인/없으면 404.
 * 실제 공개 접속은 서브도메인 URL({subdomain}.도메인/{랜딩번호|슬러그})로 이뤄진다. 방문 기록은 남기지 않음.
 */
export function PublicLandingPage() {
  const { slug } = useParams();
  const [landing, setLanding] = useState<PublicLanding | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getLandingPreview(String(slug))
      .then(setLanding)
      .catch(() => setError("페이지를 찾을 수 없습니다."));
  }, [slug]);

  if (error) return <div className="landing-public"><p className="auth-error" style={{ padding: 40, textAlign: "center" }}>{error}</p></div>;
  if (!landing) return <Loading full />;

  return (
    <>
      <div
        style={{
          background: "var(--surface-2, #eef1f6)",
          color: "var(--text-muted, #556)",
          textAlign: "center",
          fontSize: 13,
          padding: "8px 12px",
        }}
      >
        소유자 미리보기 · 이 주소는 공개용이 아닙니다. 공개는 서브도메인 URL을 사용하세요.
        <br />
        <b>여기서는 광고 픽셀이 발사되지 않습니다</b> — 제출하면 리드는 실제로 쌓이지만 PageView·전환은 잡히지 않습니다.
        픽셀 테스트는 공개 URL에서 하세요.
      </div>
      <LandingView landing={landing} />
    </>
  );
}
