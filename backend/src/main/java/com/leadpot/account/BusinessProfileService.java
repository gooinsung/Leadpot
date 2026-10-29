package com.leadpot.account;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.account.dto.BusinessProfileDto;

/** 마이페이지 사업장 정보. 아직 저장한 적 없으면 빈 값으로 보인다(행은 처음 저장할 때 만든다). */
@Service
public class BusinessProfileService {

    private final BusinessProfileRepository repository;

    public BusinessProfileService(BusinessProfileRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public BusinessProfileDto get(Long userId) {
        return repository.findById(userId).map(BusinessProfileDto::from).orElse(BusinessProfileDto.EMPTY);
    }

    @Transactional
    public BusinessProfileDto save(Long userId, BusinessProfileDto req) {
        BusinessProfile p = repository.findById(userId).orElseGet(() -> repository.save(new BusinessProfile(userId)));
        p.update(req.companyName(), req.ceoName(), req.bizNo(), req.address(), req.phone(), req.email(),
                req.bankAccount());
        return BusinessProfileDto.from(p);
    }
}
