package com.leadpot.advertiser;

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

import com.leadpot.advertiser.dto.AdvertiserNoteResponse;
import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadNote;
import com.leadpot.lead.LeadNoteRepository;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadService;

import jakarta.persistence.EntityManager;

/**
 * 광고주 삭제 검증 — 메모를 남긴 광고주도 삭제되고, 그 메모는 <b>작성자만 비워진 채 보존</b>된다.
 *
 * <p>배경(2026-08-06): {@code lead_notes.owner_id} 의 FK 에 {@code on delete} 절이 없어
 * 메모를 남긴 광고주를 삭제하면 FK 위반으로 500 이 났다. V27 로 {@code on delete set null} 로 바꾸고
 * {@link AdvertiserService#delete} 가 삭제 전에 작성자를 비우도록 했다.
 *
 * <p><b>⚠️ 이 테스트가 FK 자체를 검증하지는 못한다.</b> 테스트는 H2 이고 스키마를 Hibernate 가 만드는데,
 * {@code LeadNote.ownerId} 는 연관관계가 아닌 단순 컬럼이라 <b>H2 에는 FK 가 아예 생기지 않는다</b>
 * (그래서 수정 전에도 H2 에서는 삭제가 성공했다 — 운영 Postgres 에서만 터졌다).
 * 여기서 검증하는 것은 <b>메모 보존과 작성자 비우기</b>, 그리고 작성자가 지워진 메모를 읽을 때
 * 응답 생성이 깨지지 않는다는 것이다.
 */
@SpringBootTest
@Transactional
class AdvertiserDeleteTest {

    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private AdvertiserLeadService advertiserLeadService;
    @Autowired
    private LeadService leadService;
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
    private EntityManager em;

    private User marketer;
    private User advertiser;
    private Form form;
    private Lead lead;

    @BeforeEach
    void setUp() {
        User m = new User("del-m@test.local", passwordEncoder.encode("pw12345678"), "마케터", null);
        m.setSubdomain("del-m");
        marketer = userRepository.save(m);
        advertiser = userRepository.save(User.advertiser("del-a@test.local",
                passwordEncoder.encode("pw12345678"), "광고주", null, marketer.getId(), "회사"));
        form = formRepository.save(new Form(marketer.getId(), "폼", FormType.BASIC));
        Lead l = new Lead();
        l.setFormId(form.getId());
        l.setAnswers(List.of(Map.of("label", "이름", "value", "홍길동")));
        lead = leadRepository.save(l);
        advertiserService.replaceGrants(marketer.getId(), advertiser.getId(),
                new GrantUpdateRequest(List.of(
                        new GrantUpdateRequest.Item(form.getId(), null, null, true, true, true))));
    }

    @Test
    @DisplayName("메모를 남긴 광고주도 삭제된다 — 메모는 남고 작성자만 비워진다")
    void deletesAdvertiserAndKeepsNotes() {
        advertiserLeadService.addNote(advertiser.getId(), lead.getId(), "상담 완료했습니다", "127.0.0.1");
        em.flush();

        advertiserService.delete(marketer.getId(), advertiser.getId());
        em.flush();
        em.clear();

        assertThat(userRepository.findById(advertiser.getId())).isEmpty();

        List<LeadNote> notes = noteRepository.findByLeadIdOrderByCreatedAtAsc(lead.getId());
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0).getBody()).isEqualTo("상담 완료했습니다"); // 내용 보존
        assertThat(notes.get(0).getOwnerId()).isNull();                    // 작성자만 비움
        assertThat(notes.get(0).isAuthorDeleted()).isTrue();
    }

    @Test
    @DisplayName("작성자가 지워진 메모도 마케터 화면에서 읽힌다(authorDeleted=true)")
    void marketerSeesOrphanedNote() {
        advertiserLeadService.addNote(advertiser.getId(), lead.getId(), "광고주 메모", "127.0.0.1");
        em.flush();
        advertiserService.delete(marketer.getId(), advertiser.getId());
        em.flush();
        em.clear();

        var notes = leadService.listNotes(marketer.getId(), lead.getId());
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0).authorDeleted()).isTrue();
        assertThat(notes.get(0).body()).isEqualTo("광고주 메모");
    }

    @Test
    @DisplayName("작성자가 null 인 메모로 광고주 응답을 만들어도 NPE 가 나지 않는다")
    void advertiserResponseHandlesNullAuthor() {
        LeadNote orphan = noteRepository.save(
                new LeadNote(lead.getId(), advertiser.getId(), LeadNote.KIND_MEMO, "고아 메모",
                        LeadNote.VISIBILITY_ALL));
        em.flush();
        noteRepository.clearOwner(advertiser.getId());
        em.flush();
        em.clear();

        LeadNote reloaded = noteRepository.findById(orphan.getId()).orElseThrow();
        AdvertiserNoteResponse res = AdvertiserNoteResponse.of(reloaded, advertiser.getId(), null);
        assertThat(res.mine()).isFalse(); // 작성자가 없으니 '내 메모'가 아니다
        assertThat(res.authorRole()).isNull(); // 작성자 삭제 → 역할 미상
        assertThat(res.body()).isEqualTo("고아 메모");
    }

    @Test
    @DisplayName("메모가 없는 광고주도 그대로 삭제된다(기존 동작 유지)")
    void deletesAdvertiserWithoutNotes() {
        advertiserService.delete(marketer.getId(), advertiser.getId());
        em.flush();
        assertThat(userRepository.findById(advertiser.getId())).isEmpty();
    }
}
