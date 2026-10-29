package com.leadpot.advertiser;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.dto.AdvertiserProfileRequest;
import com.leadpot.advertiser.dto.AdvertiserProfileResponse;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.quote.QuoteRepository;
import com.leadpot.quote.dto.QuoteParty;

/**
 * 광고주 정보(견적서 받는 쪽) 관리. 소유 마케터만(남의 것은 404).
 * 포털 계정 연결은 <b>내 광고주 계정</b>이면서 아직 다른 광고주 정보에 연결되지 않은 것만 허용한다.
 */
@Service
public class AdvertiserProfileService {

    private final AdvertiserProfileRepository repository;
    private final UserRepository userRepository;
    private final QuoteRepository quoteRepository;

    public AdvertiserProfileService(AdvertiserProfileRepository repository, UserRepository userRepository,
            QuoteRepository quoteRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.quoteRepository = quoteRepository;
    }

    @Transactional(readOnly = true)
    public List<AdvertiserProfileResponse> list(Long ownerId) {
        Map<Long, Object[]> stats = new HashMap<>();
        for (Object[] row : quoteRepository.summarizeByAdvertiserProfile(ownerId)) {
            stats.put((Long) row[0], row);
        }
        return repository.findByOwnerIdOrderByCompanyNameAsc(ownerId).stream()
                .map(p -> toResponse(p, stats.get(p.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdvertiserProfileResponse get(Long ownerId, Long id) {
        return toResponse(loadOwned(ownerId, id), statsOf(ownerId, id));
    }

    @Transactional
    public AdvertiserProfileResponse create(Long ownerId, AdvertiserProfileRequest req) {
        AdvertiserProfile p = new AdvertiserProfile(ownerId, req.companyName());
        apply(ownerId, p, req);
        repository.save(p);
        return toResponse(p, null);
    }

    @Transactional
    public AdvertiserProfileResponse update(Long ownerId, Long id, AdvertiserProfileRequest req) {
        AdvertiserProfile p = loadOwned(ownerId, id);
        apply(ownerId, p, req);
        return toResponse(p, statsOf(ownerId, id));
    }

    /** 삭제해도 견적서는 남는다(받는 쪽 정보는 견적서에 복사돼 있고, 연결만 끊긴다 — DB on delete set null). */
    @Transactional
    public void delete(Long ownerId, Long id) {
        repository.delete(loadOwned(ownerId, id));
    }

    /** 견적서 받는 쪽 정보로 광고주 정보를 만든다('이 정보를 광고주로 저장'). */
    @Transactional
    public AdvertiserProfile createFromParty(Long ownerId, QuoteParty party) {
        if (party.companyName() == null || party.companyName().isBlank()) {
            throw new InvalidSubmissionException("광고주로 저장하려면 회사명이 필요합니다.");
        }
        AdvertiserProfile p = new AdvertiserProfile(ownerId, party.companyName());
        p.update(party.companyName(), party.ceoName(), party.bizNo(), party.contactName(), party.phone(),
                party.email(), party.address(), "");
        return repository.save(p);
    }

    /**
     * 초대를 수락해 광고주 계정이 생기면 광고주 정보도 하나 만들어 연결한다 —
     * 광고주 관리에서 계정과 견적 이력을 한 줄로 보게 하려고.
     */
    @Transactional
    public void createForNewAccount(User advertiser) {
        if (advertiser.getParentUserId() == null || repository.findByAdvertiserUserId(advertiser.getId()).isPresent()) {
            return;
        }
        String company = advertiser.getCompany() != null && !advertiser.getCompany().isBlank()
                ? advertiser.getCompany() : advertiser.getName();
        AdvertiserProfile p = new AdvertiserProfile(advertiser.getParentUserId(), company);
        p.update(company, "", "", advertiser.getName(), advertiser.getPhone(), advertiser.getEmail(), "", "");
        p.setAdvertiserUserId(advertiser.getId());
        repository.save(p);
    }

    public AdvertiserProfile loadOwned(Long ownerId, Long id) {
        return repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("광고주 정보를 찾을 수 없습니다."));
    }

    private void apply(Long ownerId, AdvertiserProfile p, AdvertiserProfileRequest req) {
        p.update(req.companyName(), req.ceoName(), req.bizNo(), req.contactName(), req.phone(), req.email(),
                req.address(), req.memo());
        Long accountId = req.advertiserUserId();
        if (accountId != null) {
            User account = userRepository.findById(accountId)
                    .filter(u -> u.getRole() == Role.ADVERTISER && ownerId.equals(u.getParentUserId()))
                    .orElseThrow(() -> new NotFoundException("광고주 계정을 찾을 수 없습니다."));
            repository.findByAdvertiserUserId(account.getId())
                    .filter(other -> !other.getId().equals(p.getId()))
                    .ifPresent(other -> {
                        throw new ConflictException("이 계정은 이미 '" + other.getCompanyName() + "'에 연결돼 있습니다.");
                    });
        }
        p.setAdvertiserUserId(accountId);
    }

    private Object[] statsOf(Long ownerId, Long id) {
        for (Object[] row : quoteRepository.summarizeByAdvertiserProfile(ownerId)) {
            if (id.equals(row[0])) {
                return row;
            }
        }
        return null;
    }

    private AdvertiserProfileResponse toResponse(AdvertiserProfile p, Object[] stats) {
        String accountEmail = p.getAdvertiserUserId() == null ? null
                : userRepository.findById(p.getAdvertiserUserId()).map(User::getEmail).orElse(null);
        long count = stats == null ? 0 : ((Number) stats[1]).longValue();
        LocalDate last = stats == null ? null : (LocalDate) stats[2];
        return new AdvertiserProfileResponse(p.getId(), p.getCompanyName(), p.getCeoName(), p.getBizNo(),
                p.getContactName(), p.getPhone(), p.getEmail(), p.getAddress(), p.getMemo(),
                p.getAdvertiserUserId(), accountEmail, count, last, p.getUpdatedAt());
    }
}
