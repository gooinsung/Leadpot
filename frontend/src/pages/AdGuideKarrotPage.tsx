import { Link } from "react-router-dom";
import { TopBar } from "../components/TopBar";

/**
 * 당근 광고 OpenAPI 연동 안내(docs/AD-AUTOMATION-PLAN.md 결정 16).
 * 근거: https://businessdaangn.gitbook.io/business.daangn/ads-pro/tools/openapi (2026-11-19 확인)
 */
export function AdGuideKarrotPage() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap dashboard ads-guide">
        <div className="dash-head">
          <div>
            <p className="eyebrow">광고 연동 · 안내</p>
            <h1 className="dash-title">당근 광고 연결하기</h1>
            <p className="dash-sub">
              당근 광고 OpenAPI 키를 리드팟에 넣으면, 리드팟이 내 당근 캠페인을 조회하고 켜고 끌 수 있습니다. 5분이면 끝나요.
            </p>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">시작 전에 확인하세요</div>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              <b>전문가모드</b> 광고 계정만 연결할 수 있습니다. 간편모드 광고는 당근 정책상 OpenAPI 로 다룰 수 없어요.
            </li>
            <li>
              키는 <b>광고 계정마다 따로</b> 발급됩니다. 광고 계정이 여러 개면 계정마다 키를 받아 각각 연결하세요.
            </li>
            <li>
              검색광고 캠페인은 당근이 조회만 허용해서, 리드팟에서 켜고 끌 수 없습니다(목록엔 보입니다).
            </li>
          </ul>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">1. 당근에서 OpenAPI 키 받기</div>
          <ol>
            <li>당근 광고 <b>전문가모드</b>에 로그인합니다.</li>
            <li>
              왼쪽 메뉴 아래 <b>[고객센터] → [온라인 문의]</b>를 누릅니다. 새 창에서 문의 페이지가 열려요.
            </li>
            <li>
              <b>[+ 문의하기]</b> → 문의 유형에서 <b>[광고 도구 및 전환] → [OpenAPI 키 발급]</b>을 고릅니다.
            </li>
            <li>키를 받을 <b>광고 계정(광고주 ID)</b>을 고르고 문의를 등록합니다.</li>
            <li>
              키를 볼 수 있는 링크가 바로 옵니다. <b>링크는 24시간 안에 한 번만 열 수 있으니</b>, 열자마자 키를 복사해두세요.
            </li>
          </ol>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">2. 리드팟에 넣기</div>
          <ol>
            <li>
              리드팟 <Link to="/ad-automation?tab=connections">광고 연동 › 매체 연결</Link>에서 매체를 <b>당근</b>으로 고릅니다.
            </li>
            <li>
              <b>광고계정 ID</b>(키를 받은 광고 계정의 숫자 ID)와 <b>OpenAPI 키</b>를 붙여넣습니다.
            </li>
            <li>
              <b>[연결 확인 후 저장]</b>을 누르면 리드팟이 당근에 실제로 접속해 키를 확인한 뒤 저장합니다.
            </li>
            <li>
              <Link to="/ad-automation?tab=campaigns">캠페인</Link> 탭에 내 캠페인이 보이면 성공입니다.
            </li>
          </ol>
        </div>

        <div className="card card-pad ads-warn" style={{ marginBottom: 16 }}>
          <div className="card-h">⚠️ 키를 다시 발급받으면</div>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            당근은 키를 새로 발급하면 <b>기존 키를 즉시 폐기</b>합니다. 그러면 리드팟 연결이 끊겨 '다시 연결 필요'로 바뀌고 자동화 규칙이
            실패합니다. 새 키를 받았다면 <b>매체 연결 › 키 교체</b>로 꼭 바꿔 넣어주세요. 키가 유출된 것 같을 때도 재발급 후 교체하면
            됩니다.
          </p>
        </div>

        <div className="card card-pad">
          <div className="card-h">알아두면 좋은 것</div>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>키는 암호화해서 보관하고, 화면에는 끝 4자리만 보여줍니다.</li>
            <li>캠페인을 끄고 켠 결과가 실제 광고 노출에 반영되기까지 몇 분(당근 안내상 최대 30분) 걸릴 수 있습니다.</li>
            <li>
              자동화 규칙 결과는 <Link to="/integrations">연동</Link> 메뉴에 설정한 <b>텔레그램</b>으로 알려드립니다.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
