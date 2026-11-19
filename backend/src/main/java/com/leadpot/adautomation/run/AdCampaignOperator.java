package com.leadpot.adautomation.run;

import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.leadpot.adautomation.connection.AdConnection;
import com.leadpot.adautomation.connection.AdConnectionRepository;
import com.leadpot.adautomation.connection.CredentialCipher;
import com.leadpot.adautomation.platform.AdPlatform;
import com.leadpot.adautomation.platform.AdPlatformClients;
import com.leadpot.adautomation.platform.AdPlatformException;
import com.leadpot.adautomation.rule.AdRule;

/**
 * 캠페인 켜기/끄기 실행 + 이력 저장(수동 버튼·규칙 동작 공용).
 *
 * <p>⚠️ <b>트랜잭션을 걸지 않는다</b> — 연결 조회(리포지토리 1회, 그 자체로 짧은 트랜잭션) → 매체 HTTP(DB 커넥션 없음)
 * → 이력 저장(짧은 트랜잭션) 순서. 매체가 10초 걸려도 DB 커넥션을 쥐고 있지 않다(설계 §5-2).
 * 예외를 밖으로 던지지 않고 결과로 돌려준다 — 한 캠페인 실패가 다른 캠페인을 막지 않게.
 */
@Component
public class AdCampaignOperator {

    private static final Logger log = LoggerFactory.getLogger(AdCampaignOperator.class);

    private final AdConnectionRepository connectionRepository;
    private final CredentialCipher cipher;
    private final AdPlatformClients clients;
    private final AdActionLogRepository logRepository;

    public AdCampaignOperator(AdConnectionRepository connectionRepository, CredentialCipher cipher,
            AdPlatformClients clients, AdActionLogRepository logRepository) {
        this.connectionRepository = connectionRepository;
        this.cipher = cipher;
        this.clients = clients;
        this.logRepository = logRepository;
    }

    /**
     * @param rule 규칙 발동이면 그 규칙, 수동 조작이면 null
     */
    public TargetResult setCampaignActive(Long ownerId, Long connectionId, String accountId, String campaignId,
            String campaignName, boolean active, AdRule rule) {
        String action = active ? "RESUME_CAMPAIGN" : "PAUSE_CAMPAIGN";
        Optional<AdConnection> found = connectionRepository.findByIdAndOwnerId(connectionId, ownerId);
        if (found.isEmpty()) {
            return record(ownerId, rule, null, null, accountId, campaignId, campaignName, action, false,
                    "매체 연결이 삭제되어 실행할 수 없습니다.");
        }
        AdConnection conn = found.get();
        String error;
        try {
            Map<String, String> creds = cipher.decrypt(conn.getCredentialsEnc());
            clients.get(conn.getPlatform()).setCampaignActive(creds, accountId, campaignId, active);
            error = null;
        } catch (AdPlatformException e) {
            error = e.getMessage();
            if (e.kind() == AdPlatformException.Kind.AUTH_INVALID) {
                markInvalid(conn, e.getMessage());
            }
        } catch (RuntimeException e) {
            // 복호화 실패·예상 못한 오류 — 상세(키 등)는 로그에만, 화면엔 일반 문구.
            log.warn("[ad-automation] 캠페인 {} 실패 conn={} campaign={}", action, connectionId, campaignId, e);
            error = "리드팟 내부 오류로 실행하지 못했습니다.";
        }
        return record(ownerId, rule, conn.getId(), conn.getPlatform(), accountId, campaignId, campaignName, action,
                error == null, error);
    }

    private void markInvalid(AdConnection conn, String message) {
        try {
            conn.markInvalid(message);
            connectionRepository.save(conn);
        } catch (RuntimeException e) {
            log.warn("[ad-automation] 연결 상태 갱신 실패 conn={}", conn.getId(), e);
        }
    }

    @SuppressWarnings("java:S107")
    private TargetResult record(Long ownerId, AdRule rule, Long connectionId, AdPlatform platform, String accountId,
            String campaignId, String campaignName, String action, boolean success, String message) {
        AdPlatform p = platform != null ? platform : AdPlatform.KARROT;
        try {
            logRepository.save(new AdActionLog(ownerId, rule == null ? null : rule.getId(),
                    rule == null ? null : rule.getName(),
                    rule == null ? AdActionLog.Trigger.MANUAL : AdActionLog.Trigger.RULE,
                    connectionId, p, accountId, campaignId, campaignName, action, success, message));
        } catch (RuntimeException e) {
            log.warn("[ad-automation] 이력 저장 실패", e);
        }
        return new TargetResult(platform, campaignName, success, success ? null : message);
    }
}
