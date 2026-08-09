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
import com.leadpot.lead.dto.InboxResponse;

/**
 * 통합 인박스(U1) 검증 — 여러 폼의 리드를 한 스트림으로 합산하고, 출처 폼명·필터·카운트가 맞는지.
 * 다른 마케터의 리드는 절대 섞이면 안 된다(K5).
 */
@SpringBootTest
@Transactional
class InboxTest {

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
    private Form formA;
    private Form formB;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(marketer("inbox-m@test.local", "inbox-m"));
        formA = formRepository.save(new Form(owner.getId(), "성형외과 상담", FormType.BASIC));
        formB = formRepository.save(new Form(owner.getId(), "시술 이벤트", FormType.BASIC));
        // formA: 신규 2건, 유효 1건 / formB: 신규 1건 (통합 축 V29)
        saveLead(formA, LeadStatuses.NEW, "김민수");
        saveLead(formA, LeadStatuses.NEW, "이서연");
        saveLead(formA, LeadStatuses.VALID, "박도윤");
        saveLead(formB, LeadStatuses.NEW, "최지우");
    }

    @Test
    @DisplayName("여러 폼의 리드를 합산하고 각 리드에 출처 폼명을 담는다")
    void aggregatesAcrossFormsWithSource() {
        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(4);
        assertThat(r.items()).extracting(InboxResponse.Item::formName)
                .contains("성형외과 상담", "시술 이벤트");
    }

    @Test
    @DisplayName("rail 카운트: 전체·미확인(열람 안 한 건)·폼별·상태별")
    void railCounts() {
        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25).counts();
        assertThat(c.all()).isEqualTo(4);
        // 미확인 = 마케터가 아직 안 연 리드(V32). 상태와 무관하므로 아무것도 안 열어본 지금은 4건이다.
        assertThat(c.unseen()).isEqualTo(4);
        assertThat(c.byStatus().get(LeadStatuses.NEW)).isEqualTo(3);
        assertThat(c.byStatus().get(LeadStatuses.VALID)).isEqualTo(1);
        assertThat(c.statusNames()).containsEntry(LeadStatuses.VALID, "유효");
        assertThat(c.byForm()).anySatisfy(f -> {
            assertThat(f.formName()).isEqualTo("성형외과 상담");
            assertThat(f.count()).isEqualTo(3);
        });
    }

    @Test
    @DisplayName("unseen=true 면 안 열어본 것만, 카운트는 전체 기준 유지")
    void unseenFilterKeepsGlobalCounts() {
        Long first = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25)
                .items().get(0).id();
        leadService.markSeen(owner.getId(), List.of(first), true);

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, true, 0, 25);
        assertThat(r.total()).isEqualTo(3);                 // 확인 처리한 1건이 빠진다
        assertThat(r.items()).allSatisfy(i -> assertThat(i.seenAt()).isNull());
        assertThat(r.counts().all()).isEqualTo(4);          // rail 은 전체 기준
        assertThat(r.counts().unseen()).isEqualTo(3);
    }

    /**
     * V32 회귀 방지 — 예전엔 '미확인 = status NEW' 라, 광고주가 상태를 바꾸면
     * 마케터 화면에서 미확인이 저절로 사라졌다. 이제 둘은 완전히 독립이어야 한다.
     */
    @Test
    @DisplayName("상태를 바꿔도 미확인 여부는 그대로다")
    void statusChangeDoesNotTouchSeen() {
        Long newLead = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25)
                .items().stream().filter(i -> LeadStatuses.NEW.equals(i.status())).findFirst().orElseThrow().id();

        leadService.updateStatus(owner.getId(), newLead, LeadStatuses.VALID, null);

        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25).counts();
        assertThat(c.unseen()).isEqualTo(4);                // 상태만 바뀌었을 뿐 아무도 안 봤다
        assertThat(c.byStatus().get(LeadStatuses.NEW)).isEqualTo(2);
    }

    @Test
    @DisplayName("확인 처리는 상태를 건드리지 않는다")
    void markSeenKeepsStatus() {
        Long newLead = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25)
                .items().stream().filter(i -> LeadStatuses.NEW.equals(i.status())).findFirst().orElseThrow().id();

        leadService.markSeen(owner.getId(), List.of(newLead), true);

        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25).counts();
        assertThat(c.unseen()).isEqualTo(3);
        assertThat(c.byStatus().get(LeadStatuses.NEW)).isEqualTo(3); // 상태 분포는 그대로
    }

    @Test
    @DisplayName("출처 폼 필터: 특정 폼만")
    void filterByForm() {
        InboxResponse r = leadService.inbox(owner.getId(), null, null, formB.getId(), null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(1);
        assertThat(r.items()).singleElement()
                .satisfies(i -> assertThat(i.formName()).isEqualTo("시술 이벤트"));
    }

    @Test
    @DisplayName("다른 마케터의 리드는 섞이지 않는다")
    void otherOwnerLeadsExcluded() {
        User other = userRepository.save(marketer("inbox-m2@test.local", "inbox-m2"));
        Form otherForm = formRepository.save(new Form(other.getId(), "남의폼", FormType.BASIC));
        saveLead(otherForm, "NEW", "침입자");

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(4); // 여전히 내 것 4건만
        assertThat(r.items()).noneSatisfy(i -> assertThat(i.formName()).isEqualTo("남의폼"));
    }

    private User marketer(String email, String sub) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(sub);
        return u;
    }

    private void saveLead(Form form, String status, String name) {
        Lead l = new Lead(); // 기본 NEW
        l.setFormId(form.getId());
        if (!LeadStatuses.NEW.equals(status)) {
            l.changeStatus(status, null, java.time.Instant.now());
        }
        l.setAnswers(List.of(Map.of("label", "이름", "value", name)));
        leadRepository.save(l);
    }
}
