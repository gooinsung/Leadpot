import { useAuth } from "../lib/authContext";
import { TopBar } from "../components/TopBar";

/**
 * 광고주 홈 (임시 자리 — A3 에서 리드 목록/상세로 대체된다).
 * A2 시점에는 계정 생성·로그인까지 검증할 수 있도록 최소 화면만 둔다.
 */
export function AdvertiserHomePage() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard">
        <div className="dash-head">
          <div>
            <p className="eyebrow">광고주</p>
            <h1 className="dash-title">{user?.name} 님, 환영합니다</h1>
            <p className="dash-sub">계정이 정상적으로 만들어졌습니다.</p>
          </div>
        </div>

        <div className="card card-pad">
          <h2 className="card-title">리드 확인 화면 준비 중</h2>
          <p className="dash-sub" style={{ marginTop: 8 }}>
            담당 마케터가 권한을 부여한 리드폼의 접수 내역을 이 화면에서 확인하실 수 있게 됩니다.
            <br />
            준비가 끝나면 별도로 안내드립니다.
          </p>
          <ul className="dash-sub" style={{ marginTop: 12, paddingLeft: 18 }}>
            <li>접수된 리드 목록·상세 확인</li>
            <li>진행 상태 변경 (신규 / 확인 / 통화완료 / 부재 / 종료)</li>
            <li>엑셀 내려받기</li>
            <li>새 리드 접수 시 텔레그램 알림</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
