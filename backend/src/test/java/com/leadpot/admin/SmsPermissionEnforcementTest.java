package com.leadpot.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.admin.dto.AdminUserRow;
import com.leadpot.admin.dto.SmsPermissionRequest;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormService;
import com.leadpot.form.FormType;
import com.leadpot.form.dto.FormRequest;
import com.leadpot.form.dto.FormResponse;
import com.leadpot.sms.MessageLog;
import com.leadpot.sms.SmsService;

/**
 * 문자 발송 권한이 <b>실제로 막는지</b> 검증(V25).
 *
 * <p>막아야 하는 지점이 여럿이라 전수로 확인한다 — <b>화면만 숨기면 API 직접 호출로 뚫린다</b>:
 * <ol>
 * <li>{@code SmsService.send} — 최종 관문. 막을 때 <b>SKIPPED 로 사유를 남겨야</b> 한다
 * (조용히 사라지면 마케터가 왜 안 갔는지 알 수 없다).</li>
 * <li>{@code FormService.update} — 권한 없는 계정이 리드폼에 발송을 켜 두지 못하게.</li>
 * <li>{@code AdminService} — 권한 변경이 감사 이력에 남아야 한다.</li>
 * </ol>
 */
@SpringBootTest
@Transactional
class SmsPermissionEnforcementTest {

    @Autowired
    private SmsService smsService;
    @Autowired
    private AdminService adminService;
    @Autowired
    private FormService formService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private AdminAuditLogRepository auditRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User marketer;

    @BeforeEach
    void setUp() {
        admin = new User("perm-admin@test.local", passwordEncoder.encode("pw12345678"), "운영자", null);
        admin.setSubdomain("perm-admin");
        admin.setRole(Role.ADMIN);
        userRepository.save(admin);

        marketer = new User("perm-marketer@test.local", passwordEncoder.encode("pw12345678"), "마케터", "01000000000");
        marketer.setSubdomain("perm-marketer");
        userRepository.save(marketer);
    }

    // ---------- ① 발송 관문 ----------

    @Test
    @DisplayName("권한 없는 계정의 발송은 SKIPPED 로 사유가 남는다")
    void sendIsSkippedWithReason() {
        MessageLog log = smsService.send(SmsService.SmsRequest.to(
                marketer.getId(), "01012345678", "테스트", MessageLog.TO_TEST));

        assertThat(log.getStatus()).isEqualTo(MessageLog.STATUS_SKIPPED);
        assertThat(log.getError()).contains("권한");
    }

    @Test
    @DisplayName("SMS 만 허용된 계정은 긴 본문(LMS)이 막힌다")
    void lmsBlockedWhenOnlySmsAllowed() {
        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), 100));

        // 90byte 를 넘기면 발송 시점에 LMS 로 판정된다 — 저장은 되는데 발송이 막히는 함정.
        MessageLog log = smsService.send(SmsService.SmsRequest.to(
                marketer.getId(), "01012345678", "가".repeat(200), MessageLog.TO_TEST));

        assertThat(log.getStatus()).isEqualTo(MessageLog.STATUS_SKIPPED);
        assertThat(log.getError()).contains("LMS");
    }

    @Test
    @DisplayName("월 한도 0 은 발송을 막는다 (예전 규약은 0=무제한이었다)")
    void zeroLimitBlocks() {
        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), 0));

        MessageLog log = smsService.send(SmsService.SmsRequest.to(
                marketer.getId(), "01012345678", "짧은 본문", MessageLog.TO_TEST));

        assertThat(log.getStatus()).isEqualTo(MessageLog.STATUS_SKIPPED);
    }

    // ---------- ② 리드폼 저장 ----------

    @Test
    @DisplayName("권한 없는 계정이 리드폼에 문자 발송을 켜면 저장 시 꺼진다")
    void formSaveForcesSmsOff() {
        Form form = formRepository.save(new Form(marketer.getId(), "권한 테스트 폼", FormType.BASIC));
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("smsMarketerEnabled", true);
        settings.put("smsLeadEnabled", true);
        settings.put("smsAdvertiserEnabled", true);
        settings.put("smsLeadImageId", "some-file-id");
        settings.put("allowSameIp", true); // 무관한 설정은 보존돼야 한다

        FormResponse saved = formService.update(marketer.getId(), form.getId(), request(settings));

        assertThat(saved.settingsConfig())
                .containsEntry("smsMarketerEnabled", false)
                .containsEntry("smsLeadEnabled", false)
                .containsEntry("smsAdvertiserEnabled", false)
                .containsEntry("allowSameIp", true)
                .doesNotContainKey("smsLeadImageId"); // 첨부는 MMS 권한이 있어야 저장된다
    }

    @Test
    @DisplayName("MMS 권한이 없으면 첨부만 떨어지고 발송 토글은 유지된다")
    void attachmentStrippedWithoutMmsPermission() {
        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS", "LMS"), 100));
        Form form = formRepository.save(new Form(marketer.getId(), "첨부 테스트 폼", FormType.BASIC));
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("smsLeadEnabled", true);
        settings.put("smsLeadImageId", "some-file-id");

        FormResponse saved = formService.update(marketer.getId(), form.getId(), request(settings));

        assertThat(saved.settingsConfig())
                .containsEntry("smsLeadEnabled", true)
                .doesNotContainKey("smsLeadImageId");
    }

    @Test
    @DisplayName("전부 허용된 계정의 설정은 손대지 않는다")
    void fullyPermittedSettingsUntouched() {
        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS", "LMS", "MMS"), 500));
        Form form = formRepository.save(new Form(marketer.getId(), "허용 폼", FormType.BASIC));
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("smsLeadEnabled", true);
        settings.put("smsLeadImageId", "some-file-id");

        FormResponse saved = formService.update(marketer.getId(), form.getId(), request(settings));

        assertThat(saved.settingsConfig())
                .containsEntry("smsLeadEnabled", true)
                .containsEntry("smsLeadImageId", "some-file-id");
    }

    // ---------- ③ 어드민 변경 ----------

    @Test
    @DisplayName("권한 변경은 감사 이력에 남는다")
    void permissionChangeIsAudited() {
        long before = auditRepository.count();

        AdminUserRow row = adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS", "MMS"), 300));

        assertThat(row.smsEnabled()).isTrue();
        assertThat(row.smsAllowedChannels()).containsExactly("SMS", "MMS"); // 정해진 순서로 정규화
        assertThat(row.monthlyLimit()).isEqualTo(300);
        assertThat(auditRepository.count()).isEqualTo(before + 1);
        assertThat(adminService.audit(marketer.getId()))
                .anySatisfy(a -> assertThat(a.detail()).contains("발송=off").contains("발송=on"));
    }

    @Test
    @DisplayName("변경이 없으면 이력을 남기지 않는다")
    void noAuditWhenUnchanged() {
        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), 100));
        long after = auditRepository.count();

        adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), 100));

        assertThat(auditRepository.count()).isEqualTo(after);
    }

    @Test
    @DisplayName("음수 한도는 무제한(-1)으로 정규화된다")
    void negativeLimitNormalizedToUnlimited() {
        AdminUserRow row = adminService.updateSmsPermissions(admin.getId(), marketer.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), -7));

        assertThat(row.monthlyLimit()).isEqualTo(-1);
        // 무제한이면 발송이 막히지 않는다.
        assertThat(smsService.denyReason(marketer.getId(), "SMS")).isNull();
    }

    @Test
    @DisplayName("광고주 하위계정에는 문자 권한을 줄 수 없다")
    void advertiserCannotGetSmsPermission() {
        User advertiser = userRepository.save(User.advertiser("perm-adv@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "광고주㈜"));

        assertThatThrownBy(() -> adminService.updateSmsPermissions(admin.getId(), advertiser.getId(),
                new SmsPermissionRequest(true, List.of("SMS"), 100)))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    /** 설정만 바꾸는 최소 저장 요청. */
    private static FormRequest request(Map<String, Object> settings) {
        return new FormRequest("권한 테스트 폼", null, FormType.BASIC, false,
                null, null, null, null, null, settings, null, List.of());
    }
}
