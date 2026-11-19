package com.leadpot.adautomation.connection;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.leadpot.adautomation.dto.AdAutomationDtos.AccountResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.CampaignResponse;
import com.leadpot.adautomation.dto.AdAutomationDtos.ConnectionRequest;
import com.leadpot.adautomation.dto.AdAutomationDtos.ConnectionResponse;
import com.leadpot.adautomation.platform.AdPlatform;
import com.leadpot.adautomation.platform.AdPlatformClient;
import com.leadpot.adautomation.platform.AdPlatformClients;
import com.leadpot.adautomation.platform.AdPlatformException;
import com.leadpot.adautomation.rule.AdRule;
import com.leadpot.adautomation.rule.AdRuleRepository;
import com.leadpot.adautomation.rule.AdRuleTarget;
import com.leadpot.adautomation.rule.AdRuleTargetRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;

/**
 * 매체 연결 관리(마케터 본인 것만).
 *
 * <p>⚠️ 매체 HTTP 호출(연결 확인·목록 조회)은 <b>트랜잭션 밖</b>에서 한다 — 그래서 클래스에 {@code @Transactional} 을
 * 걸지 않고, DB 쓰기만 {@link TransactionTemplate} 로 짧게 감싼다(설계 §5-2).
 */
@Service
public class AdConnectionService {

    private final AdConnectionRepository repository;
    private final AdRuleRepository ruleRepository;
    private final AdRuleTargetRepository targetRepository;
    private final AdPlatformClients clients;
    private final CredentialCipher cipher;
    private final TransactionTemplate tx;

    public AdConnectionService(AdConnectionRepository repository, AdRuleRepository ruleRepository,
            AdRuleTargetRepository targetRepository, AdPlatformClients clients, CredentialCipher cipher,
            TransactionTemplate tx) {
        this.repository = repository;
        this.ruleRepository = ruleRepository;
        this.targetRepository = targetRepository;
        this.clients = clients;
        this.cipher = cipher;
        this.tx = tx;
    }

    public List<ConnectionResponse> list(Long ownerId) {
        return repository.findByOwnerIdOrderByIdAsc(ownerId).stream().map(AdConnectionService::toResponse).toList();
    }

    /** 새 연결 — 저장 전에 매체에 실제로 붙여 보고(키 확인) 성공해야 저장한다. */
    public ConnectionResponse create(Long ownerId, ConnectionRequest req) {
        AdPlatform platform = parsePlatform(req.platform());
        AdPlatformClient client = clients.get(platform);
        Map<String, String> creds = client.normalizeCredentials(req.credentials());
        String label = label(req.label(), platform);
        String enc = cipher.encrypt(creds); // 키 미설정이면 여기서 안내 문구로 거절
        verify(client, creds);
        AdConnection saved = repository.save(new AdConnection(ownerId, platform, label, enc,
                client.credentialsHint(creds)));
        return toResponse(saved);
    }

    /** 이름 변경 + (값이 있으면) 자격증명 교체. 자격증명을 바꾸면 다시 확인한다. */
    public ConnectionResponse update(Long ownerId, Long id, ConnectionRequest req) {
        AdConnection conn = load(ownerId, id);
        AdPlatformClient client = clients.get(conn.getPlatform());
        boolean replace = req.credentials() != null
                && req.credentials().values().stream().anyMatch(v -> v != null && !v.isBlank());
        String enc = null;
        String hint = null;
        if (replace) {
            Map<String, String> creds = client.normalizeCredentials(req.credentials());
            enc = cipher.encrypt(creds);
            verify(client, creds);
            hint = client.credentialsHint(creds);
        }
        String newLabel = req.label() == null ? null : label(req.label(), conn.getPlatform());
        String finalEnc = enc;
        String finalHint = hint;
        return tx.execute(s -> {
            AdConnection c = load(ownerId, id);
            if (newLabel != null) {
                c.setLabel(newLabel);
            }
            if (finalEnc != null) {
                c.replaceCredentials(finalEnc, finalHint);
            }
            return toResponse(repository.save(c));
        });
    }

    /** 연결 삭제 — 이 연결을 쓰던 규칙은 지우지 않고 일시정지 + 사유 표시(결정). 이력은 남는다. */
    public void delete(Long ownerId, Long id) {
        tx.executeWithoutResult(s -> {
            AdConnection conn = load(ownerId, id);
            List<AdRuleTarget> targets = targetRepository.findByConnectionId(id);
            List<Long> ruleIds = targets.stream().map(AdRuleTarget::getRuleId).distinct().toList();
            if (!ruleIds.isEmpty()) {
                for (AdRule r : ruleRepository.findByIdIn(ruleIds)) {
                    r.setPausedReason(cut("매체 연결 '" + conn.getLabel() + "'이(가) 삭제되어 일시정지됨 — 대상을 다시 골라 저장하세요.", 200));
                }
            }
            targetRepository.deleteByConnectionId(id);
            repository.delete(conn);
        });
    }

    public List<AccountResponse> accounts(Long ownerId, Long id) {
        AdConnection conn = load(ownerId, id);
        Map<String, String> creds = cipher.decrypt(conn.getCredentialsEnc());
        try {
            List<AccountResponse> out = clients.get(conn.getPlatform()).listAccounts(creds).stream()
                    .map(a -> new AccountResponse(a.id(), a.name())).toList();
            reactivateIfNeeded(conn);
            return out;
        } catch (AdPlatformException e) {
            throw handle(conn, e);
        }
    }

    public List<CampaignResponse> campaigns(Long ownerId, Long id, String accountId) {
        AdConnection conn = load(ownerId, id);
        Map<String, String> creds = cipher.decrypt(conn.getCredentialsEnc());
        try {
            List<CampaignResponse> out = clients.get(conn.getPlatform()).listCampaigns(creds, accountId).stream()
                    .map(c -> new CampaignResponse(c.id(), c.name(), c.active(), c.statusLabel(), c.readOnly()))
                    .toList();
            reactivateIfNeeded(conn);
            return out;
        } catch (AdPlatformException e) {
            throw handle(conn, e);
        }
    }

    public AdConnection load(Long ownerId, Long id) {
        return repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("매체 연결을 찾을 수 없습니다."));
    }

    // ---------- 내부 ----------

    private static void verify(AdPlatformClient client, Map<String, String> creds) {
        try {
            client.listAccounts(creds);
        } catch (AdPlatformException e) {
            throw new InvalidSubmissionException("연결 확인에 실패했습니다: " + e.getMessage());
        }
    }

    private RuntimeException handle(AdConnection conn, AdPlatformException e) {
        if (e.kind() == AdPlatformException.Kind.AUTH_INVALID) {
            tx.executeWithoutResult(s -> repository.findById(conn.getId()).ifPresent(c -> {
                c.markInvalid(e.getMessage());
                repository.save(c);
            }));
        }
        return new InvalidSubmissionException(e.getMessage());
    }

    private void reactivateIfNeeded(AdConnection conn) {
        if (conn.getStatus() == AdConnection.Status.ACTIVE) {
            return;
        }
        tx.executeWithoutResult(s -> repository.findById(conn.getId()).ifPresent(c -> {
            c.markActive();
            repository.save(c);
        }));
    }

    static AdPlatform parsePlatform(String raw) {
        try {
            return AdPlatform.valueOf(raw == null ? "" : raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidSubmissionException("알 수 없는 매체입니다.");
        }
    }

    private static String label(String raw, AdPlatform platform) {
        String t = raw == null ? "" : raw.trim();
        if (t.isEmpty()) {
            t = platform.label() + " 연결";
        }
        return cut(t, 100);
    }

    private static String cut(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    static ConnectionResponse toResponse(AdConnection c) {
        return new ConnectionResponse(c.getId(), c.getPlatform().name(), c.getPlatform().label(), c.getLabel(),
                c.getCredentialsHint(), c.getStatus().name(), c.getStatusMessage(), c.getCreatedAt());
    }
}
