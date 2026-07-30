package com.leadpot.advertiser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.GrantUpdateRequest;
import com.leadpot.advertiser.dto.GrantView;
import com.leadpot.advertiser.dto.InviteAcceptRequest;
import com.leadpot.advertiser.dto.InviteRequest;
import com.leadpot.advertiser.dto.InviteResponse;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.PlanLimitExceededException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormType;

/**
 * A2 핵심 규칙 검증: 1리드폼:1광고주 · 소유권 격리 · 플랜 상한 · 초대 링크 1회성.
 * <p>
 * 이 규칙이 깨지면 <b>리드가 엉뚱한 광고주에게 노출</b>되므로 테스트를 완화하지 말고 원인을 고칠 것.
 */
@SpringBootTest
@Transactional
class AdvertiserGrantRulesTest {

    @Autowired
    private AdvertiserService advertiserService;
    @Autowired
    private AdvertiserInviteService inviteService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User marketer;
    private User otherMarketer;

    @BeforeEach
    void setUp() {
        marketer = saveMarketer("m1@test.local", "m1");
        otherMarketer = saveMarketer("m2@test.local", "m2");
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

    private static GrantUpdateRequest grantOf(Long... formIds) {
        return new GrantUpdateRequest(java.util.Arrays.stream(formIds)
                .map(id -> new GrantUpdateRequest.Item(id, null, null, true, true, true))
                .toList());
    }

    @Test
    @DisplayName("리드폼 하나를 두 광고주에게 부여하면 409 (1리드폼:1광고주)")
    void formCannotBeGrantedToTwoAdvertisers() {
        User a1 = saveAdvertiser("a1@test.local", marketer);
        User a2 = saveAdvertiser("a2@test.local", marketer);
        Form form = saveForm(marketer, "공용폼");

        advertiserService.replaceGrants(marketer.getId(), a1.getId(), grantOf(form.getId()));

        assertThatThrownBy(() -> advertiserService.replaceGrants(marketer.getId(), a2.getId(), grantOf(form.getId())))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("이미 다른 광고주");
    }

    @Test
    @DisplayName("권한을 회수한 리드폼은 다른 광고주에게 다시 부여할 수 있다")
    void revokedFormCanBeReassigned() {
        User a1 = saveAdvertiser("a1@test.local", marketer);
        User a2 = saveAdvertiser("a2@test.local", marketer);
        Form form = saveForm(marketer, "이전폼");

        advertiserService.replaceGrants(marketer.getId(), a1.getId(), grantOf(form.getId()));
        // 빈 목록 = 전부 회수
        advertiserService.replaceGrants(marketer.getId(), a1.getId(), new GrantUpdateRequest(List.of()));

        List<GrantView> views = advertiserService.replaceGrants(marketer.getId(), a2.getId(), grantOf(form.getId()));
        assertThat(views).anySatisfy(v -> {
            assertThat(v.formId()).isEqualTo(form.getId());
            assertThat(v.granted()).isTrue();
        });
    }

    @Test
    @DisplayName("남의 리드폼은 내 광고주에게 부여할 수 없다 (404)")
    void cannotGrantOtherMarketersForm() {
        User a1 = saveAdvertiser("a1@test.local", marketer);
        Form foreign = saveForm(otherMarketer, "남의폼");

        assertThatThrownBy(() -> advertiserService.replaceGrants(marketer.getId(), a1.getId(), grantOf(foreign.getId())))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("남의 광고주는 조회·수정할 수 없다 (404 — 존재 노출 방지)")
    void cannotTouchOtherMarketersAdvertiser() {
        User foreignAdvertiser = saveAdvertiser("foreign@test.local", otherMarketer);

        assertThatThrownBy(() -> advertiserService.requireOwned(marketer.getId(), foreignAdvertiser.getId()))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> advertiserService.grantViews(marketer.getId(), foreignAdvertiser.getId()))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> advertiserService.delete(marketer.getId(), foreignAdvertiser.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("다른 광고주가 쓰는 리드폼은 목록에서 takenBy 로 표시된다")
    void takenFormIsMarked() {
        User a1 = saveAdvertiser("a1@test.local", marketer);
        User a2 = saveAdvertiser("a2@test.local", marketer);
        Form form = saveForm(marketer, "선점폼");
        advertiserService.replaceGrants(marketer.getId(), a1.getId(), grantOf(form.getId()));

        List<GrantView> views = advertiserService.grantViews(marketer.getId(), a2.getId());
        assertThat(views).anySatisfy(v -> {
            assertThat(v.formId()).isEqualTo(form.getId());
            assertThat(v.granted()).isFalse();
            assertThat(v.takenBy()).isNotNull();
        });
    }

    @Test
    @DisplayName("FREE 플랜은 광고주 1명 — 초과 초대는 409")
    void freePlanLimitsAdvertiserCount() {
        saveAdvertiser("a1@test.local", marketer); // 이미 1명

        assertThatThrownBy(() -> inviteService.issue(marketer.getId(),
                new InviteRequest("new@test.local", "새담당", "새회사")))
                .isInstanceOf(PlanLimitExceededException.class);
    }

    @Test
    @DisplayName("초대 수락 시 광고주 계정이 소유 마케터와 함께 생성된다")
    void acceptCreatesAdvertiserUnderMarketer() {
        InviteResponse issued = inviteService.issue(marketer.getId(),
                new InviteRequest("invited@test.local", "초대받은사람", "초대회사"));
        assertThat(issued.token()).isNotBlank();

        inviteService.accept(issued.token(), new InviteAcceptRequest("pw12345678", null, null));

        User created = userRepository.findByEmail("invited@test.local").orElseThrow();
        assertThat(created.getRole()).isEqualTo(Role.ADVERTISER);
        assertThat(created.getParentUserId()).isEqualTo(marketer.getId());
        assertThat(created.isActive()).isTrue();
        assertThat(created.getSubdomain()).isNull();
        assertThat(created.getCompany()).isEqualTo("초대회사");
    }

    @Test
    @DisplayName("같은 초대 링크를 두 번 쓸 수 없다")
    void inviteTokenIsSingleUse() {
        InviteResponse issued = inviteService.issue(marketer.getId(),
                new InviteRequest("once@test.local", null, null));
        inviteService.accept(issued.token(), new InviteAcceptRequest("pw12345678", null, null));

        assertThatThrownBy(() -> inviteService.accept(issued.token(),
                new InviteAcceptRequest("pw12345678", null, null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("재발급하면 이전 링크는 무효가 된다")
    void reissueInvalidatesOldLink() {
        InviteResponse first = inviteService.issue(marketer.getId(),
                new InviteRequest("reissue@test.local", null, null));
        InviteResponse second = inviteService.reissue(marketer.getId(), first.id());

        assertThat(second.token()).isNotEqualTo(first.token());
        assertThatThrownBy(() -> inviteService.info(first.token()))
                .isInstanceOf(NotFoundException.class);
        assertThat(inviteService.info(second.token()).email()).isEqualTo("reissue@test.local");
    }

    @Test
    @DisplayName("이미 리드팟에 있는 이메일로는 초대할 수 없다")
    void cannotInviteExistingEmail() {
        assertThatThrownBy(() -> inviteService.issue(marketer.getId(),
                new InviteRequest(otherMarketer.getEmail(), null, null)))
                .hasMessageContaining("이미 리드팟에 등록된 이메일");
    }

    @Test
    @DisplayName("광고주를 삭제하면 부여된 권한도 사라진다")
    void deletingAdvertiserRemovesGrants() {
        User a1 = saveAdvertiser("a1@test.local", marketer);
        Form form = saveForm(marketer, "삭제폼");
        advertiserService.replaceGrants(marketer.getId(), a1.getId(), grantOf(form.getId()));

        advertiserService.delete(marketer.getId(), a1.getId());

        assertThat(userRepository.findById(a1.getId())).isEmpty();
        // 폼은 남고, 다시 다른 광고주에게 부여할 수 있어야 한다
        User a2 = saveAdvertiser("a2@test.local", marketer);
        assertThat(advertiserService.replaceGrants(marketer.getId(), a2.getId(), grantOf(form.getId())))
                .anySatisfy(v -> assertThat(v.granted()).isTrue());
    }
}
