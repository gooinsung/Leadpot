package com.leadpot.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.landing.LandingPage;
import com.leadpot.landing.LandingPageRepository;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;

/**
 * 운영자 읽기 전용 열람(2026-08-19 정책 변경) 검증.
 *
 * <p>지켜야 하는 것:
 * <ol>
 * <li><b>리드 열람은 반드시 감사 로그에 남는다</b> — 개인정보 접근 추적이 정책 변경의 조건이었다.</li>
 * <li><b>폼 소유 검증</b> — formId 를 바꿔가며 다른 계정 리드를 긁을 수 없어야 한다.</li>
 * <li>휴지통(soft delete) 리드는 열람에 나오지 않는다.</li>
 * </ol>
 */
@SpringBootTest
@Transactional
class AdminReadOnlyViewTest {

    @Autowired
    private AdminService adminService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LandingPageRepository landingRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private AdminAuditLogRepository auditRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User marketer;
    private User otherMarketer;
    private Form form;

    @BeforeEach
    void setUp() {
        admin = new User("view-admin@test.local", passwordEncoder.encode("pw12345678"), "운영자", null);
        admin.setSubdomain("view-admin");
        admin.setRole(Role.ADMIN);
        userRepository.save(admin);

        marketer = new User("view-marketer@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        marketer.setSubdomain("view-marketer");
        userRepository.save(marketer);

        otherMarketer = new User("view-other@test.local", passwordEncoder.encode("pw12345678"), "다른마케터", null);
        otherMarketer.setSubdomain("view-other");
        userRepository.save(otherMarketer);

        form = formRepository.save(new Form(marketer.getId(), "열람 테스트 폼", FormType.BASIC));
        saveLead(form.getId(), "고객A");
        saveLead(form.getId(), "고객B");
    }

    @Test
    @DisplayName("운영자가 계정의 리드폼·랜딩 목록을 조회할 수 있다")
    void formsAndLandings() {
        LandingPage landing = new LandingPage(marketer.getId(), "열람 테스트 랜딩", "view-test-landing");
        landing.setContent(List.of()); // content 는 NOT NULL(빈 블록 목록으로 저장)
        landingRepository.save(landing);

        assertThat(adminService.forms(marketer.getId()))
                .hasSize(1)
                .allSatisfy(f -> assertThat(f.name()).isEqualTo("열람 테스트 폼"));
        assertThat(adminService.landings(marketer.getId()))
                .hasSize(1)
                .allSatisfy(l -> assertThat(l.title()).isEqualTo("열람 테스트 랜딩"));
        // 다른 계정 것은 섞이지 않는다.
        assertThat(adminService.forms(otherMarketer.getId())).isEmpty();
    }

    @Test
    @DisplayName("리드 열람은 최신순으로 나오고, 호출마다 감사 로그(LEADS_VIEW)가 남는다")
    void leadsViewIsAudited() {
        long before = auditRepository.count();

        var leads = adminService.leads(admin.getId(), marketer.getId(), null);

        assertThat(leads).hasSize(2);
        assertThat(auditRepository.count()).isEqualTo(before + 1);
        assertThat(adminService.audit(marketer.getId()))
                .anySatisfy(a -> {
                    assertThat(a.action()).isEqualTo(AdminAuditLog.ACTION_LEADS_VIEW);
                    assertThat(a.detail()).contains("2건");
                    // 감사 로그에 개인정보(답변 내용)가 새지 않아야 한다.
                    assertThat(a.detail()).doesNotContain("고객A");
                });
    }

    @Test
    @DisplayName("formId 로 다른 계정의 폼을 지정하면 거부한다")
    void foreignFormRejected() {
        Form foreign = formRepository.save(new Form(otherMarketer.getId(), "남의 폼", FormType.BASIC));

        assertThatThrownBy(() -> adminService.leads(admin.getId(), marketer.getId(), foreign.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("휴지통(soft delete) 리드는 열람에 나오지 않는다")
    void deletedLeadsExcluded() {
        Lead deleted = saveLead(form.getId(), "삭제된고객");
        deleted.setDeletedAt(Instant.now());

        assertThat(adminService.leads(admin.getId(), marketer.getId(), form.getId())).hasSize(2);
    }

    @Test
    @DisplayName("없는 계정 열람은 404")
    void unknownTargetRejected() {
        assertThatThrownBy(() -> adminService.forms(999999L)).isInstanceOf(NotFoundException.class);
    }

    private Lead saveLead(Long formId, String name) {
        Lead l = new Lead();
        l.setFormId(formId);
        l.setAnswers(List.of(Map.of("label", "이름", "value", name)));
        return leadRepository.save(l);
    }
}
