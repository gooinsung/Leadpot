package com.leadpot.adautomation.run;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.leadpot.adautomation.rule.AdRule;
import com.leadpot.integration.IntegrationSettings;
import com.leadpot.integration.IntegrationSettingsRepository;
import com.leadpot.integration.NotificationService;

/**
 * 규칙 발동 결과를 <b>마케터 텔레그램</b>으로 알린다(결정 11·12). 기존 연동 설정의 봇·채팅을 재사용한다.
 * 텔레그램이 없으면 보내지 않는다 — 화면 실행 이력에만 남는다(결정 14). 문자는 비용 때문에 안 쓴다.
 * 알림 실패는 로그만 남기고 끝(결정 13).
 */
@Component
public class AdNotifier {

    private static final Logger log = LoggerFactory.getLogger(AdNotifier.class);

    private final IntegrationSettingsRepository settingsRepository;
    private final NotificationService notificationService;

    public AdNotifier(IntegrationSettingsRepository settingsRepository, NotificationService notificationService) {
        this.settingsRepository = settingsRepository;
        this.notificationService = notificationService;
    }

    public void ruleFired(AdRule rule, String formName, String conditionSummary, String actionLabel,
            List<TargetResult> results) {
        boolean anyFailed = results.stream().anyMatch(r -> !r.success());
        if (!anyFailed && !rule.isNotifySuccess()) {
            return;
        }
        send(rule.getOwnerId(), buildText(rule, formName, conditionSummary, actionLabel, results));
    }

    static String buildText(AdRule rule, String formName, String conditionSummary, String actionLabel,
            List<TargetResult> results) {
        boolean anyFailed = results.stream().anyMatch(r -> !r.success());
        StringBuilder sb = new StringBuilder();
        sb.append(anyFailed ? "⚠️" : "🔕").append(" [리드팟 광고 자동화] ").append(rule.getName()).append('\n');
        sb.append("리드폼 '").append(formName == null ? "(삭제됨)" : formName).append("' · ")
                .append(conditionSummary).append('\n');
        sb.append("동작: ").append(actionLabel).append('\n');
        if (results.isEmpty()) {
            sb.append("• 대상 캠페인이 없습니다.\n");
        }
        for (TargetResult r : results) {
            String platform = r.platform() == null ? "" : r.platform().label() + " · ";
            String name = r.campaignName() == null ? "(이름 없음)" : r.campaignName();
            if (r.success()) {
                sb.append("✅ ").append(platform).append(name).append(" — 완료\n");
            } else {
                sb.append("❌ ").append(platform).append(name).append(" — 실패: ").append(r.message())
                        .append(" → 매체 광고관리자에서 직접 처리해주세요.\n");
            }
        }
        if (!anyFailed) {
            sb.append("※ 다시 켜려면 리드팟 '광고 연동' 또는 매체 광고관리자에서 직접 켜주세요.");
        }
        return sb.toString().trim();
    }

    private void send(Long ownerId, String text) {
        try {
            IntegrationSettings s = settingsRepository.findById(ownerId).orElse(null);
            if (s == null || !s.isTelegramEnabled() || isBlank(s.getTelegramBotToken())
                    || isBlank(s.getTelegramChatId())) {
                return;
            }
            String err = notificationService.sendTelegram(s.getTelegramBotToken(), s.getTelegramChatId(), text);
            if (err != null) {
                log.warn("[ad-automation] 텔레그램 알림 실패 owner={} : {}", ownerId, err);
            }
        } catch (RuntimeException e) {
            log.warn("[ad-automation] 텔레그램 알림 실패 owner={}", ownerId, e);
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
