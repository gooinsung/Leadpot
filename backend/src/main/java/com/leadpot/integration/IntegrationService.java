package com.leadpot.integration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.form.FormService;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.integration.dto.IntegrationRequest;
import com.leadpot.integration.dto.IntegrationResponse;
import com.leadpot.integration.dto.TestResult;

/**
 * 계정 연동 설정(텔레그램 계정 채널) 조회/저장 + 발송 테스트.
 * 구글시트는 리드폼별 설정(settingsConfig)이라 폼 단위로 테스트한다.
 */
@Service
public class IntegrationService {

    private final IntegrationSettingsRepository repository;
    private final NotificationService notificationService;
    private final GoogleSheetsClient sheetsClient;
    private final FormService formService;

    public IntegrationService(IntegrationSettingsRepository repository, NotificationService notificationService,
            GoogleSheetsClient sheetsClient, FormService formService) {
        this.repository = repository;
        this.notificationService = notificationService;
        this.sheetsClient = sheetsClient;
        this.formService = formService;
    }

    @Transactional(readOnly = true)
    public IntegrationResponse get(Long ownerId) {
        return IntegrationResponse.from(repository.findById(ownerId).orElse(null),
                sheetsClient.serviceAccountEmail());
    }

    @Transactional
    public IntegrationResponse update(Long ownerId, IntegrationRequest req) {
        IntegrationSettings s = repository.findById(ownerId).orElseGet(() -> new IntegrationSettings(ownerId));
        s.setTelegramBotToken(trim(req.telegramBotToken()));
        s.setTelegramChatId(trim(req.telegramChatId()));
        // 값이 비어 있으면 켤 수 없다.
        s.setTelegramEnabled(req.telegramEnabled()
                && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId()));
        repository.save(s);
        return IntegrationResponse.from(s, sheetsClient.serviceAccountEmail());
    }

    /** 계정 텔레그램 채널에 테스트 메시지 발송. */
    @Transactional(readOnly = true)
    public TestResult test(Long ownerId) {
        IntegrationSettings s = repository.findById(ownerId).orElse(null);
        List<TestResult.ChannelResult> results = new ArrayList<>();
        if (s != null && s.isTelegramEnabled()
                && notBlank(s.getTelegramBotToken()) && notBlank(s.getTelegramChatId())) {
            String err = notificationService.sendTelegram(s.getTelegramBotToken(), s.getTelegramChatId(),
                    "✅ Leadpot 연동 테스트\n이 메시지가 보이면 텔레그램 알림이 정상 연결된 것입니다.");
            results.add(new TestResult.ChannelResult("telegram", err == null, err == null ? "전송 성공" : err));
        }
        return new TestResult(results);
    }

    /** 특정 리드폼의 구글시트 설정(settingsConfig)으로 테스트 발송(본인 리드폼만). */
    @Transactional(readOnly = true)
    public TestResult testFormSheets(Long ownerId, Long formId) {
        FormResponse form = formService.get(ownerId, formId); // 소유권 확인(아니면 404)
        List<TestResult.ChannelResult> results = new ArrayList<>();
        Map<String, Object> cfg = form.settingsConfig();
        String spreadsheetId = cfg == null ? "" : str(cfg.get("sheetsSpreadsheetId"));
        String tabName = cfg == null ? "" : str(cfg.get("sheetsTabName"));
        boolean enabled = cfg != null && Boolean.TRUE.equals(cfg.get("sheetsEnabled"));
        if (enabled && notBlank(spreadsheetId)) {
            String err = notificationService.sendSheets(
                    notificationService.sheetsTestRow(spreadsheetId, tabName));
            results.add(new TestResult.ChannelResult("sheets", err == null, err == null ? "전송 성공" : err));
        }
        return new TestResult(results);
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
