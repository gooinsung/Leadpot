package com.leadpot.advertiser;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.InviteAcceptRequest;
import com.leadpot.advertiser.dto.InviteInfoResponse;
import com.leadpot.advertiser.dto.InviteRequest;
import com.leadpot.advertiser.dto.InviteResponse;
import com.leadpot.auth.AuthService;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.auth.dto.TokenResponse;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.EmailAlreadyUsedException;
import com.leadpot.common.error.NotFoundException;

/**
 * 광고주 초대 발급 / 수락.
 * <p>
 * 마케터가 비밀번호를 직접 정해주지 않고 <b>초대 링크</b>를 보내는 이유:
 * 마케터가 광고주의 비밀번호를 알고 있으면 "내가 안 봤다"는 광고주의 주장과
 * 감사 로그가 충돌해 기록의 증거 가치가 사라진다.
 */
@Service
public class AdvertiserInviteService {

    private final AdvertiserInviteRepository inviteRepository;
    private final UserRepository userRepository;
    private final AdvertiserService advertiserService;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final long ttlHours;

    public AdvertiserInviteService(AdvertiserInviteRepository inviteRepository,
            UserRepository userRepository,
            AdvertiserService advertiserService,
            AuthService authService,
            PasswordEncoder passwordEncoder,
            @Value("${app.advertiser.invite-ttl-hours}") long ttlHours) {
        this.inviteRepository = inviteRepository;
        this.userRepository = userRepository;
        this.advertiserService = advertiserService;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
        this.ttlHours = ttlHours;
    }

    // ---------- 마케터: 발급 / 조회 / 재발급 / 취소 ----------

    @Transactional
    public InviteResponse issue(Long marketerId, InviteRequest req) {
        User marketer = userRepository.findById(marketerId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        String email = normalizeEmail(req.email());

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyUsedException("이미 리드팟에 등록된 이메일입니다. 다른 이메일로 초대해주세요.");
        }
        inviteRepository.findByMarketerIdAndEmailAndAcceptedAtIsNull(marketerId, email)
                .filter(i -> i.isUsable(Instant.now()))
                .ifPresent(i -> {
                    throw new ConflictException(
                            "이 이메일로 이미 초대가 발급되어 있습니다. 링크를 다시 받으려면 재발급을 눌러주세요.");
                });
        advertiserService.checkCanAddAdvertiser(marketer);

        String token = InviteTokens.newToken();
        AdvertiserInvite invite = new AdvertiserInvite(marketerId, email,
                blankToNull(req.name()), blankToNull(req.company()),
                InviteTokens.hash(token), Instant.now().plus(ttlHours, ChronoUnit.HOURS));
        inviteRepository.save(invite);
        return InviteResponse.issued(invite, token);
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> list(Long marketerId) {
        return inviteRepository.findByMarketerIdOrderByCreatedAtDesc(marketerId).stream()
                .map(InviteResponse::of)
                .toList();
    }

    /**
     * 링크 재발급. 토큰 원문은 저장하지 않으므로 마케터가 링크를 잃어버리면 이 방법밖에 없다.
     * 이전 링크는 즉시 무효가 된다.
     */
    @Transactional
    public InviteResponse reissue(Long marketerId, Long inviteId) {
        AdvertiserInvite invite = inviteRepository.findByIdAndMarketerId(inviteId, marketerId)
                .orElseThrow(() -> new NotFoundException("초대를 찾을 수 없습니다."));
        if (invite.getAcceptedAt() != null) {
            throw new ConflictException("이미 수락된 초대입니다.");
        }
        String token = InviteTokens.newToken();
        invite.reissue(InviteTokens.hash(token), Instant.now().plus(ttlHours, ChronoUnit.HOURS));
        return InviteResponse.issued(invite, token);
    }

    @Transactional
    public void cancel(Long marketerId, Long inviteId) {
        AdvertiserInvite invite = inviteRepository.findByIdAndMarketerId(inviteId, marketerId)
                .orElseThrow(() -> new NotFoundException("초대를 찾을 수 없습니다."));
        if (invite.getAcceptedAt() != null) {
            throw new ConflictException("이미 수락된 초대는 취소할 수 없습니다. 광고주 계정을 삭제해주세요.");
        }
        inviteRepository.delete(invite);
    }

    // ---------- 공개: 초대 확인 / 수락 ----------

    @Transactional(readOnly = true)
    public InviteInfoResponse info(String token) {
        AdvertiserInvite invite = loadUsable(token);
        User marketer = userRepository.findById(invite.getMarketerId())
                .orElseThrow(() -> new NotFoundException("초대를 찾을 수 없습니다."));
        return new InviteInfoResponse(invite.getEmail(), invite.getName(), invite.getCompany(),
                marketer.getName(), marketer.getCompany());
    }

    /** 수락 → 광고주 계정 생성 → 자동 로그인 토큰 반환. */
    @Transactional
    public TokenResponse accept(String token, InviteAcceptRequest req) {
        AdvertiserInvite invite = loadUsable(token);
        // 발급 이후 같은 이메일로 가입되는 경합 상황 대비(마지막 방어선은 users.email UNIQUE)
        if (userRepository.existsByEmail(invite.getEmail())) {
            throw new EmailAlreadyUsedException("이미 사용 중인 이메일입니다. 초대한 담당자에게 문의해주세요.");
        }
        String name = blankToNull(req.name()) != null ? req.name().trim()
                : (invite.getName() != null ? invite.getName() : invite.getEmail());

        User advertiser = User.advertiser(
                invite.getEmail(),
                passwordEncoder.encode(req.password()),
                name,
                blankToNull(req.phone()),
                invite.getMarketerId(),
                invite.getCompany());
        userRepository.save(advertiser);
        invite.accept(advertiser.getId(), Instant.now());
        return authService.issueTokens(advertiser);
    }

    private AdvertiserInvite loadUsable(String token) {
        if (token == null || token.isBlank()) {
            throw new NotFoundException("초대 링크가 올바르지 않습니다.");
        }
        AdvertiserInvite invite = inviteRepository.findByTokenHash(InviteTokens.hash(token))
                .orElseThrow(() -> new NotFoundException("초대 링크가 올바르지 않습니다."));
        if (invite.getAcceptedAt() != null) {
            throw new ConflictException("이미 사용된 초대 링크입니다. 로그인해주세요.");
        }
        if (!invite.getExpiresAt().isAfter(Instant.now())) {
            throw new ConflictException("초대 링크가 만료되었습니다. 초대한 담당자에게 재발급을 요청해주세요.");
        }
        return invite;
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
