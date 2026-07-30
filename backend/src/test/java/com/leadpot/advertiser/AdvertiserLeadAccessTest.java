package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserFormResponse;
import com.leadpot.advertiser.dto.AdvertiserLeadPage;
import com.leadpot.advertiser.dto.AdvertiserLeadResponse;
import com.leadpot.advertiser.dto.AdvertiserNoteResponse;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadNote;
import com.leadpot.lead.LeadNoteRepository;
import com.leadpot.lead.LeadRepository;

/**
 * A3 데이터 격리 검증. <b>리드는 개인정보</b>이므로 이 테스트가 깨지면
 * 권한 없는 광고주에게 리드가 노출된다는 뜻이다 — 완화하지 말고 원인을 고칠 것.
 */
@SpringBootTest
@Transactional
class AdvertiserLeadAccessTest {

    @Autowired
    private AdvertiserLeadService leadService;
    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private LeadRepository leadRepository;
    @Autowired
    private LeadNoteRepository noteRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private AdvertiserFormGrantRepository grantRepository;

    private User marketer;
    private User advertiser;
    private Form grantedForm;
    private Form otherForm;
    private Lead grantedLead;
    private Lead otherLead;

    @BeforeEach
    void setUp() {
        marketer = saveMarketer("lead-m@test.local", "lead-m");
        advertiser = saveAdvertiser("lead-a@test.local", marketer);
        grantedForm = saveForm(marketer, "부여된폼");
        otherForm = saveForm(marketer, "부여안된폼");
        grantedLead = saveLead(grantedForm, "홍길동", "01011112222");
        otherLead = saveLead(otherForm, "미부여", "01033334444");

        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(grantedForm.getId(), null, null, true, true, true))));
    }

    private User saveMarketer(String email, String subdomain) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(subdomain);
        return userRepository.save(u);
    }

    private User saveAdvertiser(String email, User parent) {
        return userRepository.save(User.advertiser(email, passwordEncoder.encode("pw12345678"),
                "광고주", null, parent.getId(), "회사"));
    }

    private Form saveForm(User owner, String name) {
        return formRepository.save(new Form(owner.getId(), name, FormType.BASIC));
    }

    private Lead saveLead(Form form, String name, String phone) {
        Lead lead = new Lead();
        lead.setFormId(form.getId());
        lead.setAnswers(List.of(
                Map.of("label", "이름", "value", name),
                Map.of("label", "연락처", "value", phone)));
        lead.setSubmitterIp("1.2.3.4");
        lead.setDevice("MOBILE");
        lead.setOs("iOS");
        lead.setBrowser("Safari");
        lead.setReferer("https://ad.example.com");
        lead.setUtm(Map.of("utm_source", "naver"));
        lead.setTags(List.of("VIP"));
        return leadRepository.save(lead);
    }

    // ---------- 격리 ----------

    @Test
    @DisplayName("부여된 리드폼의 리드만 조회된다")
    void onlyGrantedFormLeadsAreVisible() {
        AdvertiserLeadPage page = leadService.leads(advertiser.getId(), grantedForm.getId(),
                null, null, null, null, null, null);
        assertThat(page.total()).isEqualTo(1);
        assertThat(page.items()).singleElement()
                .satisfies(l -> assertThat(l.id()).isEqualTo(grantedLead.getId()));
    }

    @Test
    @DisplayName("부여되지 않은 리드폼은 404 (존재 노출 방지)")
    void ungrantedFormIsNotFound() {
        assertThatThrownBy(() -> leadService.leads(advertiser.getId(), otherForm.getId(),
                null, null, null, null, null, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("부여되지 않은 리드폼의 리드 상세도 404")
    void ungrantedLeadDetailIsNotFound() {
        assertThatThrownBy(() -> leadService.lead(advertiser.getId(), otherLead.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("다른 마케터의 광고주는 이 리드에 접근할 수 없다")
    void otherMarketersAdvertiserCannotAccess() {
        User otherMarketer = saveMarketer("lead-m2@test.local", "lead-m2");
        User foreign = saveAdvertiser("lead-a2@test.local", otherMarketer);

        assertThatThrownBy(() -> leadService.lead(foreign.getId(), grantedLead.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("권한이 만료되면 접근이 차단된다")
    void expiredGrantBlocksAccess() {
        AdvertiserFormGrant grant = grantRepository.findByFormId(grantedForm.getId()).orElseThrow();
        grant.apply(null, Instant.now().minus(1, ChronoUnit.DAYS), true, true, true);
        grantRepository.flush();

        assertThatThrownBy(() -> leadService.lead(advertiser.getId(), grantedLead.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("정지된 광고주는 접근이 차단된다")
    void inactiveAdvertiserBlocked() {
        advertiser.setActive(false);
        userRepository.flush();

        assertThatThrownBy(() -> leadService.lead(advertiser.getId(), grantedLead.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("휴지통에 있는 리드는 광고주에게 보이지 않는다")
    void trashedLeadHidden() {
        grantedLead.setDeletedAt(Instant.now());
        leadRepository.flush();

        assertThatThrownBy(() -> leadService.lead(advertiser.getId(), grantedLead.getId(), null))
                .isInstanceOf(NotFoundException.class);
        assertThat(leadService.leads(advertiser.getId(), grantedForm.getId(),
                null, null, null, null, null, null).total()).isZero();
    }

    // ---------- 필드 화이트리스트 ----------

    @Test
    @DisplayName("⭐ 광고주 응답에 IP·UTM·기기·태그·마케터상태 필드가 존재하지 않는다(DTO 화이트리스트)")
    void responseDtoExposesOnlyWhitelistedFields() {
        List<String> exposed = java.util.Arrays.stream(AdvertiserLeadResponse.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName)
                .toList();

        assertThat(exposed).containsExactlyInAnyOrder(
                "id", "answers", "createdAt", "advertiserStatus", "advertiserStatusLabel", "advertiserSeenAt");
        assertThat(exposed).doesNotContain(
                "submitterIp", "userAgent", "device", "os", "browser", "language",
                "referer", "utm", "tags", "status", "landingPageId", "deletedAt", "consents", "formId");
    }

    // ---------- 열람 기록 ----------

    @Test
    @DisplayName("상세를 열면 최초 열람 시각이 기록되고 이후에는 바뀌지 않는다")
    void firstViewIsRecordedOnce() {
        assertThat(grantedLead.getAdvertiserSeenAt()).isNull();

        AdvertiserLeadResponse first = leadService.lead(advertiser.getId(), grantedLead.getId(), "1.1.1.1");
        assertThat(first.advertiserSeenAt()).isNotNull();

        Instant recorded = first.advertiserSeenAt();
        AdvertiserLeadResponse second = leadService.lead(advertiser.getId(), grantedLead.getId(), "1.1.1.1");
        assertThat(second.advertiserSeenAt()).isEqualTo(recorded);
    }

    // ---------- 상태 ----------

    @Test
    @DisplayName("광고주 상태 변경은 마케터 status 를 덮어쓰지 않는다")
    void advertiserStatusIsSeparateFromMarketerStatus() {
        grantedLead.setStatus("SPAM"); // 마케터가 불량으로 분류
        leadRepository.flush();

        leadService.updateStatus(advertiser.getId(), grantedLead.getId(), AdvertiserLeadStatus.CALLED, null);

        Lead reloaded = leadRepository.findById(grantedLead.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("SPAM");
        assertThat(reloaded.getAdvertiserStatus()).isEqualTo(AdvertiserLeadStatus.CALLED);
    }

    @Test
    @DisplayName("정의되지 않은 상태 값은 거부된다")
    void invalidStatusRejected() {
        assertThatThrownBy(() -> leadService.updateStatus(advertiser.getId(), grantedLead.getId(), "SPAM", null))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("상태변경 권한이 없으면 거부된다")
    void statusChangeRequiresPermission() {
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(grantedForm.getId(), null, null, false, true, true))));

        assertThatThrownBy(() -> leadService.updateStatus(advertiser.getId(), grantedLead.getId(),
                AdvertiserLeadStatus.CALLED, null))
                .isInstanceOf(NotFoundException.class);
    }

    // ---------- 메모 가시성 ----------

    @Test
    @DisplayName("⭐ 마케터 내부 메모는 광고주에게 보이지 않는다")
    void marketerOnlyNotesAreHidden() {
        noteRepository.save(new LeadNote(grantedLead.getId(), marketer.getId(), LeadNote.KIND_MEMO,
                "내부 단가 협상 메모")); // 기본 MARKETER_ONLY
        noteRepository.save(new LeadNote(grantedLead.getId(), marketer.getId(), LeadNote.KIND_MEMO,
                "광고주와 공유할 내용", LeadNote.VISIBILITY_ALL));

        List<AdvertiserNoteResponse> visible = leadService.notes(advertiser.getId(), grantedLead.getId());

        assertThat(visible).hasSize(1);
        assertThat(visible.get(0).body()).isEqualTo("광고주와 공유할 내용");
        assertThat(visible).noneSatisfy(n -> assertThat(n.body()).contains("내부 단가"));
    }

    @Test
    @DisplayName("광고주가 쓴 메모는 마케터도 볼 수 있다(ALL)")
    void advertiserNoteIsSharedWithMarketer() {
        leadService.addNote(advertiser.getId(), grantedLead.getId(), "부재중, 오후 재통화 예정", null);

        LeadNote saved = noteRepository.findByLeadIdOrderByCreatedAtAsc(grantedLead.getId()).stream()
                .filter(n -> n.getBody().contains("부재중"))
                .findFirst().orElseThrow();
        assertThat(saved.isSharedWithAdvertiser()).isTrue();
    }

    @Test
    @DisplayName("광고주 상태변경 이력은 양쪽이 함께 본다(ALL)")
    void statusHistoryIsShared() {
        leadService.updateStatus(advertiser.getId(), grantedLead.getId(), AdvertiserLeadStatus.CONFIRMED, null);

        LeadNote history = noteRepository.findByLeadIdOrderByCreatedAtAsc(grantedLead.getId()).stream()
                .filter(n -> LeadNote.KIND_SYSTEM.equals(n.getKind()))
                .findFirst().orElseThrow();
        assertThat(history.isSharedWithAdvertiser()).isTrue();
        assertThat(history.getBody()).contains("신규").contains("확인");
    }

    // ---------- 목록 / 폼 ----------

    @Test
    @DisplayName("폼 목록에는 표시 이름(별칭)이 쓰이고 내부 폼명은 노출되지 않는다")
    void displayNameOverridesInternalFormName() {
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(grantedForm.getId(), "7월 상담신청", null, true, true, true))));

        List<AdvertiserFormResponse> forms = leadService.forms(advertiser.getId());
        assertThat(forms).singleElement().satisfies(f -> {
            assertThat(f.name()).isEqualTo("7월 상담신청");
            assertThat(f.name()).isNotEqualTo("부여된폼");
            assertThat(f.unseenCount()).isEqualTo(1);
        });
    }

    @Test
    @DisplayName("페이지 크기는 서버 상한(100)을 넘지 못한다")
    void pageSizeIsCapped() {
        AdvertiserLeadPage page = leadService.leads(advertiser.getId(), grantedForm.getId(),
                null, null, null, null, 0, 5000);
        assertThat(page.size()).isEqualTo(100);
    }
}
