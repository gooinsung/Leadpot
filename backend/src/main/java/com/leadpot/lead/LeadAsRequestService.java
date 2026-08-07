package com.leadpot.lead;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.integration.NotificationService;
import com.leadpot.lead.dto.LeadAsRequestResponse;

/**
 * AS 요청 처리(V30) — 접수(광고주)와 해소(마케터)의 업무 규칙.
 *
 * <p>소유권 검증은 호출부 책임이다(광고주=grant, 마케터=폼 소유). 여기서는
 * 요청 자체의 규칙(중복 접수 금지·사유 필수)과 상태 전이·알림만 다룬다.
 */
@Service
public class LeadAsRequestService {

    /** 증빙 이미지 최대 개수 — 무한정 첨부로 저장소·화면이 무너지지 않게. */
    private static final int MAX_EVIDENCE = 5;
    private static final int MAX_REASON = 2000;

    private final LeadAsRequestRepository asRepository;
    private final LeadStatusService leadStatusService;
    private final FormRepository formRepository;
    private final NotificationService notificationService;

    public LeadAsRequestService(LeadAsRequestRepository asRepository, LeadStatusService leadStatusService,
            FormRepository formRepository, NotificationService notificationService) {
        this.asRepository = asRepository;
        this.leadStatusService = leadStatusService;
        this.formRepository = formRepository;
        this.notificationService = notificationService;
    }

    /**
     * 광고주 AS 접수. 리드 상태를 {@code AS_REQUESTED} 로 바꾸고 마케터에게 알린다(커밋 후).
     *
     * <p>무효 리드는 접수 대상이 아니다 — 이미 과금 제외라 다툴 것이 없다.
     * 유효 리드는 접수할 수 있다(그게 이 기능의 핵심 — "이 유효 판정에 이의 있음").
     */
    @Transactional
    public LeadAsRequestResponse request(Long advertiserId, Lead lead, String rawReason,
            List<String> evidenceUrls) {
        String reason = rawReason == null ? "" : rawReason.trim();
        if (reason.isEmpty()) {
            throw new InvalidSubmissionException("AS 요청 사유를 입력해주세요.");
        }
        if (reason.length() > MAX_REASON) {
            throw new InvalidSubmissionException("사유는 " + MAX_REASON + "자 이내로 입력해주세요.");
        }
        if (LeadStatuses.INVALID.equals(lead.getStatus())) {
            throw new InvalidSubmissionException("이미 무효 처리된 리드입니다.");
        }
        if (asRepository.findByLeadIdAndStatus(lead.getId(), LeadAsRequest.STATUS_OPEN).isPresent()) {
            throw new InvalidSubmissionException("이미 처리 대기 중인 AS 요청이 있습니다.");
        }
        List<String> evidence = evidenceUrls == null ? List.of()
                : evidenceUrls.stream().filter(u -> u != null && !u.isBlank()).limit(MAX_EVIDENCE).toList();

        LeadAsRequest req = asRepository.save(new LeadAsRequest(lead.getId(), advertiserId, reason, evidence));
        // 상태 전이(이력·과금 훅 포함). AS_REQUESTED 는 이 플로우로만 진입한다.
        leadStatusService.apply(lead, LeadStatuses.AS_REQUESTED, null, advertiserId, "AS 요청(광고주)");
        // 마케터 알림(텔레그램+문자) — 커밋 후 발송. 알림톡은 M7(템플릿 심사 후) 때 채널만 바꾼다.
        Form form = formRepository.findById(lead.getFormId()).orElse(null);
        if (form != null) {
            notificationService.notifyAsRequest(form, lead, reason);
        }
        return LeadAsRequestResponse.from(req);
    }

    /**
     * 마케터 해소 — 인정이면 리드 <b>무효</b>(과금 환급), 거부면 <b>유효</b> 확정.
     * 거부→유효는 "이 리드는 정당했다"는 판정의 자연스러운 귀결이다(유효여야 과금이 유지된다).
     */
    @Transactional
    public LeadAsRequestResponse resolve(Long marketerId, Lead lead, boolean accept, String note) {
        LeadAsRequest req = asRepository.findByLeadIdAndStatus(lead.getId(), LeadAsRequest.STATUS_OPEN)
                .orElseThrow(() -> new NotFoundException("처리 대기 중인 AS 요청이 없습니다."));
        req.resolve(accept, marketerId, note, Instant.now());
        if (accept) {
            leadStatusService.apply(lead, LeadStatuses.INVALID, null, marketerId, "AS 인정(마케터)");
        } else {
            leadStatusService.apply(lead, LeadStatuses.VALID, null, marketerId, "AS 거부(마케터)");
        }
        return LeadAsRequestResponse.from(req);
    }

    /** 리드의 AS 요청 이력(최신순). 마케터·광고주 화면 공용. */
    @Transactional(readOnly = true)
    public List<LeadAsRequestResponse> history(Long leadId) {
        return asRepository.findByLeadIdOrderByCreatedAtDesc(leadId)
                .stream().map(LeadAsRequestResponse::from).toList();
    }
}
