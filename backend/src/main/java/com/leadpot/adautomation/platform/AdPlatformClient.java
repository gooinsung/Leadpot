package com.leadpot.adautomation.platform;

import java.util.List;
import java.util.Map;

/**
 * 매체 어댑터 계약. 매체마다 구현체 하나를 만들고 그 매체 하위 패키지(예: {@code platform.karrot})에 가둔다 —
 * 매체 API 버전이 바뀌어도 그 폴더만 고치면 되게.
 *
 * <p>규칙:
 * <ul>
 * <li>매체 SDK 를 쓰지 않는다 — JDK {@code HttpClient} 로 REST 호출(이미지·기동 시간·의존성 충돌 방지).</li>
 * <li>모든 호출에 시간 제한을 둔다. 실패는 {@link AdPlatformException} 으로만 던진다.</li>
 * <li>DB·트랜잭션을 모른다 — 호출하는 쪽이 트랜잭션 밖에서 부른다(HTTP 대기 중 DB 커넥션을 쥐지 않게).</li>
 * </ul>
 *
 * @see AdPlatformClients
 */
public interface AdPlatformClient {

    AdPlatform platform();

    /** 연결 화면에 그릴 입력 칸(매체마다 다르다 — 화면은 이 목록대로 그리기만 한다). */
    List<CredentialField> credentialFields();

    /**
     * 화면에서 받은 자격증명 입력값을 검증·정규화한다(형식만, 매체 호출 없음). 저장할 JSON 맵을 돌려준다.
     *
     * @throws com.leadpot.common.error.InvalidSubmissionException 형식 오류
     */
    Map<String, String> normalizeCredentials(Map<String, String> input);

    /** 화면 표시용 힌트(키 끝 4자리 등). 원문을 노출하지 않는다. */
    String credentialsHint(Map<String, String> credentials);

    /** 이 자격증명으로 접근할 수 있는 광고계정 목록. 연결 저장 전 '연결 확인'에도 쓴다. */
    List<AdAccount> listAccounts(Map<String, String> credentials);

    /** 광고계정의 캠페인 목록(삭제된 것 제외). */
    List<AdCampaign> listCampaigns(Map<String, String> credentials, String accountId);

    /** 캠페인 켜기(true)·끄기(false). */
    void setCampaignActive(Map<String, String> credentials, String accountId, String campaignId, boolean active);

    /**
     * 연결 입력 칸.
     *
     * @param secret true 면 비밀번호 칸으로 그리고, 저장 후 다시 내려주지 않는다
     */
    record CredentialField(String key, String label, boolean secret, String placeholder, String help) {
    }

    /** 광고계정. */
    record AdAccount(String id, String name) {
    }

    /**
     * 캠페인.
     *
     * @param active    지금 켜져 있는가(매체 기준)
     * @param readOnly  리드팟이 켜고 끌 수 없는 캠페인(예: 당근 검색광고)
     */
    record AdCampaign(String id, String name, boolean active, String statusLabel, boolean readOnly) {
    }
}
