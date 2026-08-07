import { Link } from "react-router-dom";
import { AdvertiserTopBar } from "../components/AdvertiserTopBar";

/**
 * 광고주 사용 안내(2026-08-08 사용자 요청) — 포털의 모든 기능을 한 페이지로 설명한다.
 *
 * 정적 안내라 API 호출이 없다. 화이트라벨(마케터 브랜드) 화면이므로 '리드팟' 같은
 * 서비스명 대신 "담당 마케터/담당자"라는 말을 쓴다. 모바일 우선(광고주는 폰으로 본다).
 */
export function AdvertiserGuidePage() {
  return (
    <div className="app-shell">
      <AdvertiserTopBar />
      <main className="wrap dashboard client-wrap">
        <div className="dash-head">
          <div>
            <p className="eyebrow">사용 안내</p>
            <h1 className="dash-title">이 화면, 이렇게 쓰세요</h1>
            <p className="dash-sub">
              광고로 들어온 상담 신청(리드)을 확인하고, 진행 상황을 정리하고, 잘못 들어온 건을
              처리하는 방법을 안내합니다.
            </p>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">1. 새 리드 확인하고 전화하기</div>
          <ol className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li><Link to="/client">리드</Link> 메뉴에서 접수된 신청을 확인합니다. <b>미확인</b> 카드를 누르면 아직 안 본 건만 모아 볼 수 있습니다.</li>
            <li>각 리드의 <b>📞 전화</b> 버튼을 누르면 바로 통화로 연결됩니다(휴대폰에서).</li>
            <li>리드를 열어보는 순간 담당 마케터에게 "확인함"으로 표시됩니다 — 빨리 열어볼수록 좋습니다.</li>
          </ol>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">2. 진행상태로 리드 정리하기</div>
          <p className="dash-sub" style={{ marginTop: 0 }}>
            상태는 담당 마케터와 <b>실시간으로 공유</b>됩니다. 기본 상태는 4가지입니다.
          </p>
          <ul className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li><b>신규</b> — 방금 들어온 리드. 아직 아무 처리도 안 한 상태.</li>
            <li><b>유효</b> — 정상적인 리드로 확인됨. <b>계약 정산(DB 단가 차감)이 이 상태로 확정됩니다.</b></li>
            <li><b>AS요청</b> — 내가 이의를 제기해 담당자가 확인 중인 상태(아래 3번).</li>
            <li><b>무효</b> — 잘못된 리드로 확정(정산 제외). <b>담당 마케터만</b> 지정할 수 있습니다.</li>
          </ul>
          <p className="dash-sub" style={{ marginBottom: 0 }}>
            여기에 더해 <b>나만의 상태</b>(상담중, 부재 3일차, 상담거부 등)를{" "}
            <Link to="/client/integrations">설정 → 진행상태 관리</Link>에서 직접 만들어 쓸 수 있습니다.
            일정 기간이 지나면 처리되지 않은 리드가 자동으로 <b>유효</b>로 확정될 수 있으니
            문제가 있는 리드는 미루지 말고 바로 AS 요청해 주세요.
          </p>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">3. 잘못 들어온 리드는 AS 요청</div>
          <ol className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>결번·중복·본인이 신청한 적 없음 등 문제가 있으면 리드 <b>상세</b>를 열고 <b>⚠️ AS 요청하기</b>를 누릅니다.</li>
            <li><b>사유</b>를 적고(필수), 통화 기록 캡처 같은 <b>증빙 이미지</b>를 첨부하면 처리가 빨라집니다(최대 5장).</li>
            <li>접수하면 담당자에게 즉시 알림이 가고, 리드는 <b>AS요청</b> 상태로 잠깁니다.</li>
            <li>담당자가 <b>인정</b>하면 무효(정산 제외), <b>거부</b>하면 유효로 확정됩니다. 결과는 리드 상세의 AS 이력에서 확인합니다.</li>
          </ol>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">4. 접수 알림 받기</div>
          <ul className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>
              <b>문자 알림</b> — <Link to="/client/integrations">설정</Link>의 "접수 알림 문자 받기"에서
              리드폼별로 <b>내 번호를 직접 등록</b>하면 새 리드가 올 때 문자가 옵니다. 번호를 비우고
              저장하면 즉시 중단됩니다. (담당 마케터가 알림을 켜 둔 리드폼만 등록할 수 있습니다)
            </li>
            <li>
              <b>텔레그램 알림</b> — 같은 화면에서 봇 토큰·채팅 ID 를 등록하면 텔레그램으로도 받습니다.
              알림 메시지의 링크를 누르면 해당 리드로 바로 이동합니다.
            </li>
          </ul>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-h">5. 메모로 소통하기</div>
          <ul className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>리드 상세에서 통화 결과·특이사항을 <b>메모</b>로 남기면 담당 마케터도 함께 봅니다.</li>
            <li>메모에는 작성자(<b>[나]</b> / <b>[마케터]</b>)가 표시되고, 상태 변경 이력도 자동으로 쌓입니다.</li>
          </ul>
        </div>

        <div className="card card-pad">
          <div className="card-h">6. 리포트 · 내보내기</div>
          <ul className="dash-sub" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li><Link to="/client/report">리포트</Link>에서 기간별 접수량·응답 속도·상태 분포를 확인합니다.</li>
            <li>권한이 있으면 리드 목록을 <b>엑셀/CSV</b>로 내려받을 수 있습니다(일일 횟수 제한 있음).</li>
          </ul>
          <p className="dash-sub" style={{ marginBottom: 0, marginTop: 10 }}>
            그 밖에 궁금한 점은 담당 마케터에게 문의해 주세요.
          </p>
        </div>
      </main>
    </div>
  );
}
