package com.leadpot.quote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.account.BusinessProfileService;
import com.leadpot.account.dto.BusinessProfileDto;
import com.leadpot.advertiser.AdvertiserProfileService;
import com.leadpot.advertiser.dto.AdvertiserProfileRequest;
import com.leadpot.advertiser.dto.AdvertiserProfileResponse;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.quote.dto.QuoteItem;
import com.leadpot.quote.dto.QuoteParty;
import com.leadpot.quote.dto.QuoteRequest;
import com.leadpot.quote.dto.QuoteResponse;

/**
 * 견적서 — 받는 쪽 두 방식(수동 입력 / 기존 광고주), 번호, 발행 잠금, 복제, 소유 격리, PDF.
 */
@SpringBootTest
@Transactional
class QuoteServiceTest {

    @Autowired
    private QuoteService service;
    @Autowired
    private QuotePdfRenderer pdfRenderer;
    @Autowired
    private AdvertiserProfileService profileService;
    @Autowired
    private BusinessProfileService businessProfileService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;
    private User other;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(new User("quote-a@test.local", passwordEncoder.encode("pw12345678"), "마케터", null));
        other = userRepository.save(new User("quote-b@test.local", passwordEncoder.encode("pw12345678"), "남", null));
        businessProfileService.save(owner.getId(), new BusinessProfileDto("라이징마케팅", "배재준", "620-19-29711",
                "서울시 강남구", "010-2235-7368", "hi@rising.kr", "국민 123-45 배재준"));
    }

    private static QuoteParty party(String company) {
        return new QuoteParty(company, "", "", "김담당", "010-1111-2222", "", "", "");
    }

    private static QuoteRequest manual(String company, boolean save) {
        return new QuoteRequest(null, save, party(company), "개인회생 DB 공급", LocalDate.of(2026, 10, 29),
                LocalDate.of(2026, 11, 12), VatMode.EXCLUDED,
                List.of(new QuoteItem("개인회생 DB", "메타, 유튜브", 50, 50_000, "")),
                List.of("상기 견적가는 변동될 수 있습니다.", "  "));
    }

    @Test
    @DisplayName("수동 입력 — 광고주 등록 없이 발급되고, 공급자는 사업장 정보로 채워지고, 합계는 서버가 계산한다")
    void manualRecipient() {
        QuoteResponse q = service.create(owner.getId(), manual("법률사무소 OOO", false));

        assertThat(q.advertiserProfileId()).isNull();
        assertThat(q.recipient().companyName()).isEqualTo("법률사무소 OOO");
        assertThat(q.supplier().companyName()).isEqualTo("라이징마케팅");
        assertThat(q.supplier().bankAccount()).isEqualTo("국민 123-45 배재준");
        assertThat(q.supplyTotal()).isEqualTo(2_500_000);
        assertThat(q.vatTotal()).isEqualTo(250_000);
        assertThat(q.grandTotal()).isEqualTo(2_750_000);
        assertThat(q.grandTotalHangul()).isEqualTo("이백칠십오만");
        assertThat(q.notes()).containsExactly("상기 견적가는 변동될 수 있습니다."); // 빈 줄은 버린다
        assertThat(q.status()).isEqualTo(QuoteStatus.DRAFT);
        assertThat(profileService.list(owner.getId())).isEmpty();
    }

    @Test
    @DisplayName("수동 입력 + '광고주로 저장' — 광고주 정보가 생기고 광고주 관리 목록에 견적 건수가 잡힌다")
    void manualSaveAsAdvertiser() {
        QuoteResponse q = service.create(owner.getId(), manual("새 광고주", true));

        List<AdvertiserProfileResponse> profiles = profileService.list(owner.getId());
        assertThat(profiles).hasSize(1);
        assertThat(profiles.get(0).companyName()).isEqualTo("새 광고주");
        assertThat(profiles.get(0).contactName()).isEqualTo("김담당");
        assertThat(profiles.get(0).quoteCount()).isEqualTo(1);
        assertThat(q.advertiserProfileId()).isEqualTo(profiles.get(0).id());
        assertThat(service.list(owner.getId(), profiles.get(0).id())).hasSize(1);
    }

    @Test
    @DisplayName("저장 안 한 수동 견적서도 나중에 [광고주로 저장]으로 연결할 수 있다")
    void saveAsAdvertiserLater() {
        QuoteResponse q = service.create(owner.getId(), manual("나중 광고주", false));
        QuoteResponse linked = service.saveAsAdvertiser(owner.getId(), q.id());

        assertThat(linked.advertiserProfileId()).isNotNull();
        assertThatThrownBy(() -> service.saveAsAdvertiser(owner.getId(), q.id())).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("기존 광고주 선택 — 남의 광고주 정보는 고를 수 없다")
    void existingAdvertiserMustBeMine() {
        AdvertiserProfileResponse mine = profileService.create(owner.getId(),
                new AdvertiserProfileRequest("내 광고주", "", "", "", "", "", "", "", null));
        AdvertiserProfileResponse theirs = profileService.create(other.getId(),
                new AdvertiserProfileRequest("남의 광고주", "", "", "", "", "", "", "", null));

        QuoteRequest ok = new QuoteRequest(mine.id(), false, party("내 광고주"), "견적", null, null, null,
                List.of(), List.of());
        assertThat(service.create(owner.getId(), ok).advertiserProfileId()).isEqualTo(mine.id());

        QuoteRequest bad = new QuoteRequest(theirs.id(), false, party("남의 광고주"), "견적", null, null, null,
                List.of(), List.of());
        assertThatThrownBy(() -> service.create(owner.getId(), bad)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("번호는 계정·월별 일련번호(Q-YYMM-NNN)")
    void numbering() {
        QuoteResponse a = service.create(owner.getId(), manual("A", false));
        QuoteResponse b = service.create(owner.getId(), manual("B", false));
        QuoteResponse c = service.create(other.getId(), manual("C", false));

        assertThat(a.quoteNo()).isEqualTo("Q-2610-001");
        assertThat(b.quoteNo()).isEqualTo("Q-2610-002");
        assertThat(c.quoteNo()).isEqualTo("Q-2610-001");
    }

    @Test
    @DisplayName("발행하면 잠긴다 — 고치기는 막히고, 상태는 발행·수락·거절 사이만 오간다")
    void issueLocks() {
        QuoteResponse q = service.create(owner.getId(), manual("잠금", false));
        QuoteResponse issued = service.issue(owner.getId(), q.id());

        assertThat(issued.status()).isEqualTo(QuoteStatus.ISSUED);
        assertThat(issued.issuedAt()).isNotNull();
        assertThatThrownBy(() -> service.update(owner.getId(), q.id(), manual("수정", false)))
                .isInstanceOf(ConflictException.class);
        assertThat(service.changeStatus(owner.getId(), q.id(), QuoteStatus.ACCEPTED).status())
                .isEqualTo(QuoteStatus.ACCEPTED);
        assertThatThrownBy(() -> service.changeStatus(owner.getId(), q.id(), QuoteStatus.DRAFT))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("품목이 없으면 발행할 수 없다")
    void issueNeedsItems() {
        QuoteRequest empty = new QuoteRequest(null, false, party("빈"), "견적", null, null, null, List.of(), List.of());
        QuoteResponse q = service.create(owner.getId(), empty);
        assertThatThrownBy(() -> service.issue(owner.getId(), q.id())).isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("발행 후 사업장 정보를 바꿔도 발행된 견적서의 공급자 칸은 그대로다")
    void issuedSnapshotIsFrozen() {
        QuoteResponse q = service.create(owner.getId(), manual("스냅샷", false));
        service.issue(owner.getId(), q.id());
        businessProfileService.save(owner.getId(), new BusinessProfileDto("바뀐상호", "", "", "", "", "", ""));

        assertThat(service.get(owner.getId(), q.id()).supplier().companyName()).isEqualTo("라이징마케팅");
    }

    @Test
    @DisplayName("복제 — 같은 받는 쪽·품목으로 새 번호의 작성중 견적서가 생긴다")
    void duplicate() {
        QuoteResponse q = service.create(owner.getId(), manual("반복", true));
        service.issue(owner.getId(), q.id());
        QuoteResponse copy = service.duplicate(owner.getId(), q.id());

        assertThat(copy.id()).isNotEqualTo(q.id());
        assertThat(copy.quoteNo()).isNotEqualTo(q.quoteNo());
        assertThat(copy.status()).isEqualTo(QuoteStatus.DRAFT);
        assertThat(copy.advertiserProfileId()).isEqualTo(q.advertiserProfileId());
        assertThat(copy.items()).hasSize(1);
        assertThat(copy.grandTotal()).isEqualTo(q.grandTotal());
        assertThat(copy.validUntil()).isEqualTo(copy.issueDate().plusDays(14)); // 원본과 같은 유효기간 길이
    }

    @Test
    @DisplayName("남의 견적서는 보이지도 고쳐지지도 않는다(404)")
    void ownerIsolation() {
        QuoteResponse q = service.create(owner.getId(), manual("격리", false));
        assertThatThrownBy(() -> service.get(other.getId(), q.id())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(other.getId(), q.id())).isInstanceOf(NotFoundException.class);
        assertThat(service.list(other.getId(), null)).isEmpty();
    }

    @Test
    @DisplayName("광고주 정보를 지워도 견적서는 남는다")
    void deletingAdvertiserKeepsQuotes() {
        QuoteResponse q = service.create(owner.getId(), manual("지울 광고주", true));
        profileService.delete(owner.getId(), q.advertiserProfileId());
        assertThat(service.get(owner.getId(), q.id()).recipient().companyName()).isEqualTo("지울 광고주");
    }

    @Test
    @DisplayName("PDF — 한글이 임베드 폰트로 들어가고 금액·품목·특수문자가 그대로 찍힌다")
    void pdf() throws Exception {
        QuoteRequest req = new QuoteRequest(null, false, party("법률사무소 <&> \"OOO\""), "DB 공급", LocalDate.of(2026, 10, 29),
                null, VatMode.EXCLUDED, List.of(new QuoteItem("개인회생 DB", "메타", 50, 50_000, "")), List.of("안내"));
        QuoteResponse q = service.create(owner.getId(), req);
        byte[] pdf = pdfRenderer.render(q);

        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        try (PDDocument doc = PDDocument.load(pdf)) {
            String text = new PDFTextStripper().getText(doc);
            assertThat(text).contains("견적번호", "법률사무소 <&> \"OOO\"", "개인회생 DB", "2,750,000", "이백칠십오만",
                    "라이징마케팅", "국민 123-45 배재준");
        }
    }
}
