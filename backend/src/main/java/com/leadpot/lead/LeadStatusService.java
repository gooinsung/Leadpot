package com.leadpot.lead;

import java.time.Instant;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserFormGrant;
import com.leadpot.advertiser.AdvertiserFormGrantRepository;
import com.leadpot.common.error.InvalidSubmissionException;

/**
 * 리드 진행상태 변경의 <b>단일 관문</b>(V29). 마케터 API·광고주 API·자동 승인·AS 처리 전부 여기를 지난다.
 *
 * <p>한 곳에 모은 이유: 상태 전이에는 항상 두 가지가 따라붙는다 —
 * ① 역할별 권한 검증(무효는 마케터만, AS요청은 플로우 전용),
 * ② 이력 메모(공유 축이므로 광고주에게도 보인다).
 * 호출부마다 흩어지면 하나가 빠진 경로가 반드시 생긴다.
 *
 * <p>소유권 검증(이 리드가 이 사용자 것인가)은 <b>호출부 책임</b>이다 — 마케터는 폼 소유,
 * 광고주는 grant 로 각자 확인한 뒤 넘어온다.
 */
@Service
public class LeadStatusService {

    private final CustomLeadStatusRepository customStatusRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final LeadNoteRepository noteRepository;

    public LeadStatusService(CustomLeadStatusRepository customStatusRepository,
            AdvertiserFormGrantRepository grantRepository,
            LeadNoteRepository noteRepository) {
        this.customStatusRepository = customStatusRepository;
        this.grantRepository = grantRepository;
        this.noteRepository = noteRepository;
    }

    /** 마케터의 상태 변경. 무효 진입·해제 포함 전부 가능(AS요청만 플로우 전용). */
    @Transactional
    public void changeByMarketer(Long marketerId, Lead lead, String status, Long customStatusId) {
        if (!LeadStatuses.MARKETER_SETTABLE.contains(status)) {
            throw new InvalidSubmissionException(LeadStatuses.AS_REQUESTED.equals(status)
                    ? "AS요청은 광고주의 AS 접수로만 만들어집니다."
                    : "상태 값이 올바르지 않습니다.");
        }
        if (LeadStatuses.AS_REQUESTED.equals(lead.getStatus())) {
            throw new InvalidSubmissionException("AS 처리 대기 중인 리드입니다. AS 인정/거부로 처리해주세요.");
        }
        apply(lead, status, customStatusId, marketerId, "상태 변경(마케터)");
    }

    /**
     * 광고주의 상태 변경. 무효는 넣지도 빼지도 못하고, AS 대기 중에도 잠긴다(사용자 확정).
     *
     * <p>⚠️ <b>유효로 확정된 뒤에는 광고주가 직접 상태를 바꿀 수 없다(2026-08-20 사용자 확정)</b> —
     * 유효는 확정 판정이라 광고주가 마음대로 되돌리면(예: 유효 → 신규) 근거 없이 뒤집히게 된다.
     * 되돌리고 싶으면 AS 요청으로 마케터에게 넘긴다({@link LeadAsRequestService}) — 인정되면 무효,
     * 거부되면 유효 유지로 마케터가 판정한다.
     */
    @Transactional
    public void changeByAdvertiser(Long advertiserId, Lead lead, String status, Long customStatusId) {
        if (!LeadStatuses.ADVERTISER_SETTABLE.contains(status)) {
            throw new InvalidSubmissionException(LeadStatuses.INVALID.equals(status)
                    ? "무효 처리는 마케터만 할 수 있습니다. AS 요청을 이용해주세요."
                    : "상태 값이 올바르지 않습니다.");
        }
        if (LeadStatuses.INVALID.equals(lead.getStatus())) {
            throw new InvalidSubmissionException("무효 리드의 상태는 마케터만 변경할 수 있습니다.");
        }
        if (LeadStatuses.AS_REQUESTED.equals(lead.getStatus())) {
            throw new InvalidSubmissionException("AS 처리 대기 중인 리드입니다. 마케터의 처리 결과를 기다려주세요.");
        }
        if (LeadStatuses.VALID.equals(lead.getStatus())) {
            throw new InvalidSubmissionException("이미 유효로 확정된 리드입니다. 상태를 바꾸려면 AS 요청을 이용해주세요.");
        }
        apply(lead, status, customStatusId, advertiserId, "상태 변경(광고주)");
    }

    /**
     * 내부 전이(자동 승인·AS 인정/거부·AS 접수). 권한 검증 없이 이력·과금만 처리한다 —
     * 호출부가 이미 각자의 규칙을 통과했다. {@code notePrefix} 가 이력 문구의 머리가 된다.
     */
    @Transactional
    public void apply(Lead lead, String status, Long customStatusId, Long actorId, String notePrefix) {
        String before = lead.getStatus();
        Long beforeCustomId = lead.getCustomStatusId();
        Long resolvedCustomId = LeadStatuses.CUSTOM.equals(status)
                ? requireUsableCustomStatus(lead.getFormId(), customStatusId).getId()
                : null;
        if (status.equals(before) && java.util.Objects.equals(resolvedCustomId, beforeCustomId)) {
            return; // 같은 상태로의 변경은 이력을 남기지 않는다
        }
        lead.changeStatus(status, resolvedCustomId, Instant.now());
        // 공유 축이므로 이력도 공유(ALL) — 광고주 화면의 이력과 마케터 화면의 이력이 같은 사실을 본다.
        noteRepository.save(new LeadNote(lead.getId(), actorId, LeadNote.KIND_SYSTEM,
                notePrefix + ": " + label(before, beforeCustomId) + " → " + label(status, resolvedCustomId),
                LeadNote.VISIBILITY_ALL));
    }

    /**
     * 커스텀 상태 검증 — <b>이 리드폼의 광고주 것</b>이어야 한다. 다른 광고주의 정의를 갖다 쓰면
     * 이름이 남의 계정에서 관리되는 이상한 상태가 된다. 보관(archived)된 정의도 새로 지정할 수 없다.
     */
    private CustomLeadStatus requireUsableCustomStatus(Long formId, Long customStatusId) {
        if (customStatusId == null) {
            throw new InvalidSubmissionException("사용자 상태를 함께 지정해주세요.");
        }
        Long formAdvertiserId = grantRepository.findByFormId(formId)
                .map(AdvertiserFormGrant::getAdvertiserId)
                .orElseThrow(() -> new InvalidSubmissionException(
                        "이 리드폼에는 연결된 광고주가 없어 사용자 상태를 쓸 수 없습니다."));
        CustomLeadStatus def = customStatusRepository.findById(customStatusId)
                .filter(s -> s.getAdvertiserId().equals(formAdvertiserId))
                .orElseThrow(() -> new InvalidSubmissionException("사용자 상태를 찾을 수 없습니다."));
        if (def.isArchived()) {
            throw new InvalidSubmissionException("보관된 상태입니다. 보관을 해제한 뒤 사용해주세요.");
        }
        return def;
    }

    /** 이력 문구용 라벨(커스텀은 정의 이름 조회). */
    private String label(String status, Long customStatusId) {
        String customName = null;
        if (LeadStatuses.CUSTOM.equals(status) && customStatusId != null) {
            customName = customStatusRepository.findById(customStatusId)
                    .map(CustomLeadStatus::getName).orElse(null);
        }
        return LeadStatuses.label(status, customName);
    }

    /** 리드폼에 연결된 광고주의 커스텀 상태 이름 조회(화면·CSV 라벨용 헬퍼). */
    @Transactional(readOnly = true)
    public Optional<String> customStatusName(Long customStatusId) {
        if (customStatusId == null) {
            return Optional.empty();
        }
        return customStatusRepository.findById(customStatusId).map(CustomLeadStatus::getName);
    }
}
