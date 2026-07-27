package com.leadpot.integration;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.integration.dto.IntegrationRequest;
import com.leadpot.integration.dto.IntegrationResponse;
import com.leadpot.integration.dto.TestResult;

/** 계정별 연동 설정 조회/저장 + 발송 테스트. 모든 작업은 로그인 사용자(ownerId) 기준. */
@Service
public class IntegrationService {

    private final IntegrationSettingsRepository repository;
    private final NotificationService notificationService;

    public IntegrationService(IntegrationSettingsRepository repository, NotificationService notificationService) {
        this.repository = repository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public IntegrationResponse get(Long ownerId) {
        return IntegrationResponse.from(repository.findById(ownerId).orElse(null));
    }

    @Transactional
    public IntegrationResponse update(Long ownerId, IntegrationRequest req) {
        IntegrationSettings s = repository.findById(ownerId).orElseGet(() -> new IntegrationSettings(ownerId));
        s.setTelegramBotToken(trim(req.telegramBotToken()));
        s.setTelegramChatId(trim(req.telegramChatId()));
        s.setSheetsWebhookUrl(trim(req.sheetsWebhookUrl()));
        // 값이 비어 있으면 켤 수 없다.
        s.setTelegramEnabled(req.telegramEnabled()
                && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId()));
        s.setSheetsEnabled(req.sheetsEnabled() && notBlank(s.getSheetsWebhookUrl()));
        repository.save(s);
        return IntegrationResponse.from(s);
    }

    /** 저장된 설정으로 각 채널에 테스트 메시지를 동기 발송하고 결과를 반환한다. */
    @Transactional(readOnly = true)
    public TestResult test(Long ownerId) {
        IntegrationSettings s = repository.findById(ownerId).orElse(null);
        List<TestResult.ChannelResult> results = new ArrayList<>();
        if (s == null) {
            return new TestResult(results);
        }
        if (s.isTelegramEnabled() && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId())) {
            String err = notificationService.sendTelegram(s.getTelegramBotToken(), s.getTelegramChatId(),
                    "✅ Leadpot 연동 테스트\n이 메시지가 보이면 텔레그램 알림이 정상 연결된 것입니다.");
            results.add(new TestResult.ChannelResult("telegram", err == null, err == null ? "전송 성공" : err));
        }
        if (s.isSheetsEnabled() && notBlank(s.getSheetsWebhookUrl())) {
            String body = "{\"event\":\"test\",\"formName\":\"Leadpot 연동 테스트\","
                    + "\"answers\":{\"테스트\":\"연결 확인\"}}";
            String err = notificationService.sendSheets(s.getSheetsWebhookUrl(), body);
            results.add(new TestResult.ChannelResult("sheets", err == null, err == null ? "전송 성공" : err));
        }
        return new TestResult(results);
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
