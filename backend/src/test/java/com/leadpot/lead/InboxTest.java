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
        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(4);
        assertThat(r.items()).extracting(InboxResponse.Item::formName)
                .contains("성형외과 상담", "시술 이벤트");
    }

    @Test
    @DisplayName("rail 카운트: 전체·미확인(열람 안 한 건)·폼별·상태별")
    void railCounts() {
        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25).counts();
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
        Long first = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25)
                .items().get(0).id();
        leadService.markSeen(owner.getId(), List.of(first), true);

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, true, 0, 25);
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
        Long newLead = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25)
                .items().stream().filter(i -> LeadStatuses.NEW.equals(i.status())).findFirst().orElseThrow().id();

        leadService.updateStatus(owner.getId(), newLead, LeadStatuses.VALID, null);

        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25).counts();
        assertThat(c.unseen()).isEqualTo(4);                // 상태만 바뀌었을 뿐 아무도 안 봤다
        assertThat(c.byStatus().get(LeadStatuses.NEW)).isEqualTo(2);
    }

    @Test
    @DisplayName("확인 처리는 상태를 건드리지 않는다")
    void markSeenKeepsStatus() {
        Long newLead = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25)
                .items().stream().filter(i -> LeadStatuses.NEW.equals(i.status())).findFirst().orElseThrow().id();

        leadService.markSeen(owner.getId(), List.of(newLead), true);

        InboxResponse.Counts c = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25).counts();
        assertThat(c.unseen()).isEqualTo(3);
        assertThat(c.byStatus().get(LeadStatuses.NEW)).isEqualTo(3); // 상태 분포는 그대로
    }

    @Test
    @DisplayName("출처 폼 필터: 특정 폼만")
    void filterByForm() {
        InboxResponse r = leadService.inbox(owner.getId(), null, null, formB.getId(), null, null, null, null, null, false, 0, 25);
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

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(4); // 여전히 내 것 4건만
        assertThat(r.items()).noneSatisfy(i -> assertThat(i.formName()).isEqualTo("남의폼"));
    }

    private User marketer(String email, String sub) {
        User u = new User(email, passwordEncoder.encode("pw12345678"), "마케터", null);
        u.setSubdomain(sub);
        return u;
    }

    private void saveLead(Form form, String status, String name) {
        saveLead(form, status, name, null);
    }

    private void saveLead(Form form, String status, String name, Map<String, Object> utm) {
        Lead l = new Lead(); // 기본 NEW
        l.setFormId(form.getId());
        if (!LeadStatuses.NEW.equals(status)) {
            l.changeStatus(status, null, java.time.Instant.now());
        }
        l.setAnswers(List.of(Map.of("label", "이름", "value", name)));
        l.setUtm(utm);
        leadRepository.save(l);
    }

    // ---------- 유입 파라미터(출처) 필터 · facet ----------

    @Test
    @DisplayName("유입 파라미터 필터: key=value 가 정확히 일치하는 리드만 남는다")
    void filtersByUtmKeyValue() {
        saveLead(formA, LeadStatuses.NEW, "당근유입", Map.of("media_from", "danggun", "campaign_name", "summer"));
        saveLead(formA, LeadStatuses.NEW, "메타유입", Map.of("media_from", "meta"));

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, null, null, null,
                "media_from", "danggun", false, 0, 25);
        assertThat(r.total()).isEqualTo(1);
        assertThat(r.items().get(0).utm()).containsEntry("media_from", "danggun");

        // 키만 있고 값이 없으면 필터가 꺼진 상태다(아직 고르는 중)
        InboxResponse all = leadService.inbox(owner.getId(), null, null, null, null, null, null,
                "media_from", null, false, 0, 25);
        assertThat(all.total()).isEqualTo(6);
    }

    @Test
    @DisplayName("검색(q)이 유입 파라미터 값도 본다 — 'danggun' 검색이 당근 유입 리드를 찾는다")
    void querySearchesUtmValues() {
        saveLead(formA, LeadStatuses.NEW, "당근유입", Map.of("media_from", "danggun"));

        InboxResponse r = leadService.inbox(owner.getId(), null, "danggun", null, null, null, null,
                null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(1);
        assertThat(r.items().get(0).utm()).containsEntry("media_from", "danggun");
    }

    @Test
    @DisplayName("utm facet: 등장한 키만, 값은 많이 나온 순 + 건수. 다른 마케터 리드는 안 섞인다(K5)")
    void utmFacets() {
        saveLead(formA, LeadStatuses.NEW, "a", Map.of("media_from", "danggun"));
        saveLead(formA, LeadStatuses.NEW, "b", Map.of("media_from", "danggun", "campaign_name", "summer"));
        saveLead(formB, LeadStatuses.NEW, "c", Map.of("media_from", "meta"));
        // 다른 마케터의 리드 — facet 에 절대 나오면 안 된다
        User other = userRepository.save(marketer("facet-m2@test.local", "facet-m2"));
        Form otherForm = formRepository.save(new Form(other.getId(), "남의 폼", FormType.BASIC));
        saveLead(otherForm, LeadStatuses.NEW, "x", Map.of("media_from", "kakao"));

        List<com.leadpot.lead.dto.UtmFacet> facets = leadService.utmFacets(owner.getId(), null);
        assertThat(facets).extracting(com.leadpot.lead.dto.UtmFacet::key)
                .containsExactly("media_from", "campaign_name"); // ads_name 은 등장 안 함 → 없음
        com.leadpot.lead.dto.UtmFacet media = facets.get(0);
        assertThat(media.values().get(0).value()).isEqualTo("danggun"); // 2건 > meta 1건
        assertThat(media.values().get(0).count()).isEqualTo(2);
        assertThat(media.values()).extracting(com.leadpot.lead.dto.UtmFacet.Value::value)
                .doesNotContain("kakao");

        // formId 를 주면 그 폼만
        List<com.leadpot.lead.dto.UtmFacet> onlyB = leadService.utmFacets(owner.getId(), formB.getId());
        assertThat(onlyB).hasSize(1);
        assertThat(onlyB.get(0).values()).extracting(com.leadpot.lead.dto.UtmFacet.Value::value)
                .containsExactly("meta");
    }

    // ---------- 분야(V35) — 접수 도장 · 필터 · 일괄 지정 ----------

    @Test
    @DisplayName("분야는 접수 시점 도장 — 폼에 분야를 지정해도 기존 리드는 잡히지 않는다")
    void categoryStampsOnlyNewLeads() {
        // 기존 리드 4건이 있는 상태에서 폼에 분야 지정 (setUp 의 리드들 = 지정 '이전' 접수분)
        formA.setCategory("개인회생");
        formRepository.save(formA);

        // 지정 이후 접수분에만 도장이 찍힌다(submit 경로를 흉내내 직접 새김)
        Lead after = new Lead();
        after.setFormId(formA.getId());
        after.setAnswers(List.of(Map.of("label", "이름", "value", "지정후접수")));
        after.setCategory(formA.getCategory());
        leadRepository.save(after);

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, "개인회생",
                null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(1); // 기존 4건은 제외, 지정 후 1건만
        assertThat(r.items().get(0).category()).isEqualTo("개인회생");

        // 분야별 카운트도 리드 기준 — 기존 리드는 세어지지 않는다
        InboxResponse allR = leadService.inbox(owner.getId(), null, null, null, null,
                null, null, null, null, false, 0, 25);
        assertThat(allR.counts().byCategory()).hasSize(1);
        assertThat(allR.counts().byCategory().get(0).count()).isEqualTo(1);
        assertThat(allR.items()).anySatisfy(i -> assertThat(i.category()).isNull());
    }

    @Test
    @DisplayName("일괄 분야 지정/해제 — 과거 리드 소급은 이 경로로만. 남의 리드는 건너뛴다(K5)")
    void bulkCategory() {
        List<Long> myIds = leadService.inbox(owner.getId(), null, null, null, null,
                null, null, null, null, false, 0, 25).items().stream().map(InboxResponse.Item::id).toList();
        // 남의 리드 하나
        User other = userRepository.save(marketer("bulk-cat@test.local", "bulk-cat"));
        Form otherForm = formRepository.save(new Form(other.getId(), "남의 폼", FormType.BASIC));
        saveLead(otherForm, LeadStatuses.NEW, "남의리드");
        Long otherId = leadService.inbox(other.getId(), null, null, null, null,
                null, null, null, null, false, 0, 25).items().get(0).id();

        List<Long> ids = new java.util.ArrayList<>(myIds);
        ids.add(otherId);
        int updated = leadService.bulkUpdateCategory(owner.getId(), ids, "장기렌트");
        assertThat(updated).isEqualTo(myIds.size()); // 남의 리드는 건너뜀

        InboxResponse r = leadService.inbox(owner.getId(), null, null, null, "장기렌트",
                null, null, null, null, false, 0, 25);
        assertThat(r.total()).isEqualTo(myIds.size());
        // 남의 리드는 그대로
        assertThat(leadService.inbox(other.getId(), null, null, null, null,
                null, null, null, null, false, 0, 25).items().get(0).category()).isNull();

        // 해제(빈 값)
        leadService.bulkUpdateCategory(owner.getId(), myIds, "");
        assertThat(leadService.inbox(owner.getId(), null, null, null, "장기렌트",
                null, null, null, null, false, 0, 25).total()).isZero();
    }
}
