package com.leadpot.lead;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;

/**
 * U2 일괄 작업 검증 — 여러 리드를 한 번에 상태변경/휴지통. 내 것이 아닌 리드는 건너뛴다(K5, 부분 성공).
 */
@SpringBootTest
@Transactional
class BulkLeadTest {

    @Autowired
    private LeadService leadService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;
    private Form form;
    private Lead a;
    private Lead b;
    private Lead c;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(marketer("bulk-m@test.local", "bulk-m"));
        form = formRepository.save(new Form(owner.getId(), "폼", FormType.BASIC));
        a = saveLead();
        b = saveLead();
        c = saveLead();
    }

    @Test
    @DisplayName("일괄 상태변경: 여러 건을 한 번에 (통합 축 V29)")
    void bulkStatus() {
        int n = leadService.bulkUpdateStatus(owner.getId(), List.of(a.getId(), b.getId(), c.getId()),
                LeadStatuses.VALID, null);
        assertThat(n).isEqualTo(3);
        assertThat(leadRepository.findById(a.getId()).orElseThrow().getStatus()).isEqualTo(LeadStatuses.VALID);
        assertThat(leadRepository.findById(c.getId()).orElseThrow().getStatus()).isEqualTo(LeadStatuses.VALID);
    }

    @Test
    @DisplayName("남의 리드 id 는 건너뛴다(부분 성공)")
    void skipsForeign() {
        User other = userRepository.save(marketer("bulk-m2@test.local", "bulk-m2"));
        Form otherForm = formRepository.save(new Form(other.getId(), "남의폼", FormType.BASIC));
        Lead foreign = new Lead();
        foreign.setFormId(otherForm.getId());
        foreign.setAnswers(List.of(Map.of("label", "이름", "value", "침입자")));
        foreign = leadRepository.save(foreign);

        int n = leadService.bulkUpdateStatus(owner.getId(), List.of(a.getId(), foreign.getId()),
                LeadStatuses.INVALID, null);
        assertThat(n).isEqualTo(1); // 내 것 1건만
        assertThat(leadRepository.findById(foreign.getId()).orElseThrow().getStatus())
                .isEqualTo(LeadStatuses.NEW); // 남의 것 그대로
    }

    @Test
    @DisplayName("일괄 휴지통 이동")
    void bulkTrash() {
        int n = leadService.bulkSoftDelete(owner.getId(), List.of(a.getId(), b.getId()));
        assertThat(n).isEqualTo(2);
        assertThat(leadRepository.findById(a.getId()).orElseThrow().getDeletedAt()).isNotNull();
        assertThat(leadRepository.findById(c.getId()).orElseThrow().getDeletedAt()).isNull(); // 선택 안 한 건 유지
    }

    private User marketer(String email, String sub) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(sub);
        return u;
    }

    private Lead saveLead() {
        Lead l = new Lead(); // 상태는 엔티티 기본값(NEW)
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        return leadRepository.save(l);
    }
}
