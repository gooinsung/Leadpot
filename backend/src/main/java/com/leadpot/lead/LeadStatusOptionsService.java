package com.leadpot.lead;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserFormGrant;
import com.leadpot.advertiser.AdvertiserFormGrantRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;

/**
 * 진행상태 선택지 목록 + 광고주 커스텀 상태 CRUD (V29).
 *
 * <p>커스텀 상태는 <b>광고주 계정 단위</b>다 — 그 광고주가 권한을 가진 모든 리드폼에서 공유된다.
 * 마케터는 같은 폼에서 이 선택지를 조회·지정만 하고, 만들고 고치는 건 광고주 몫이다(사용자 확정).
 */
@Service
public class LeadStatusOptionsService {

    /** 커스텀 상태 개수 상한 — 무한정 만들면 선택 UI 가 무너진다. */
    private static final int MAX_CUSTOM = 20;

    private final CustomLeadStatusRepository customStatusRepository;
    private final AdvertiserFormGrantRepository grantRepository;
    private final LeadRepository leadRepository;

    public LeadStatusOptionsService(CustomLeadStatusRepository customStatusRepository,
            AdvertiserFormGrantRepository grantRepository, LeadRepository leadRepository) {
        this.customStatusRepository = customStatusRepository;
        this.grantRepository = grantRepository;
        this.leadRepository = leadRepository;
    }

    /**
     * 상태 선택지 하나.
     *
     * @param key            필터·표시 키(고정=코드, 커스텀=C{id})
     * @param status         저장할 status 값(NEW/VALID/AS_REQUESTED/INVALID/CUSTOM)
     * @param customStatusId 커스텀일 때의 정의 id
     * @param label          화면 라벨
     * @param custom         커스텀 여부
     * @param archived       보관 여부(선택 목록에서는 항상 false — 관리 화면에서만 true 가 온다)
     */
    public record StatusOption(String key, String status, Long customStatusId, String label,
            boolean custom, boolean archived) {

        static StatusOption fixed(String code) {
            return new StatusOption(code, code, null, LeadStatuses.FIXED_LABELS.get(code), false, false);
        }

        static StatusOption of(CustomLeadStatus def) {
            return new StatusOption("C" + def.getId(), LeadStatuses.CUSTOM, def.getId(),
                    def.getName(), true, def.isArchived());
        }
    }

    /** 광고주 화면의 선택지: 고정 4개 + 내 커스텀(보관 제외). 무효는 읽기전용 표시용으로 포함된다. */
    @Transactional(readOnly = true)
    public List<StatusOption> optionsForAdvertiser(Long advertiserId) {
        return options(advertiserId);
    }

    /** 마케터 화면의 선택지: 그 폼에 연결된 광고주의 커스텀을 함께 내려준다. 광고주가 없으면 고정 4개만. */
    @Transactional(readOnly = true)
    public List<StatusOption> optionsForForm(Long formId) {
        Long advertiserId = grantRepository.findByFormId(formId)
                .map(AdvertiserFormGrant::getAdvertiserId).orElse(null);
        return options(advertiserId);
    }

    private List<StatusOption> options(Long advertiserId) {
        List<StatusOption> out = new ArrayList<>();
        for (String code : LeadStatuses.FIXED_LABELS.keySet()) {
            out.add(StatusOption.fixed(code));
        }
        if (advertiserId != null) {
            customStatusRepository.findByAdvertiserIdAndArchivedFalseOrderBySortOrderAscIdAsc(advertiserId)
                    .forEach(def -> out.add(StatusOption.of(def)));
        }
        return out;
    }

    /** 관리 화면용 — 보관 포함 내 커스텀 전부. */
    @Transactional(readOnly = true)
    public List<StatusOption> manageList(Long advertiserId) {
        return customStatusRepository.findByAdvertiserIdOrderBySortOrderAscIdAsc(advertiserId)
                .stream().map(StatusOption::of).toList();
    }

    /** 커스텀 상태 생성(광고주 본인). 고정 상태와 겹치는 이름은 혼란만 주므로 막는다. */
    @Transactional
    public StatusOption create(Long advertiserId, String rawName) {
        String name = cleanName(rawName);
        if (LeadStatuses.FIXED_LABELS.containsValue(name)) {
            throw new InvalidSubmissionException("기본 상태(" + name + ")와 같은 이름은 만들 수 없습니다.");
        }
        if (customStatusRepository.findByAdvertiserIdAndName(advertiserId, name).isPresent()) {
            throw new InvalidSubmissionException("이미 같은 이름의 상태가 있습니다.");
        }
        if (customStatusRepository.countByAdvertiserIdAndArchivedFalse(advertiserId) >= MAX_CUSTOM) {
            throw new InvalidSubmissionException("사용자 상태는 최대 " + MAX_CUSTOM + "개까지 만들 수 있습니다.");
        }
        int nextOrder = customStatusRepository.findByAdvertiserIdOrderBySortOrderAscIdAsc(advertiserId)
                .stream().mapToInt(CustomLeadStatus::getSortOrder).max().orElse(0) + 1;
        return StatusOption.of(customStatusRepository.save(new CustomLeadStatus(advertiserId, name, nextOrder)));
    }

    /** 이름 변경·보관 토글(광고주 본인 것만). 이력의 옛 문구는 그대로 남는다(당시 표기가 사실). */
    @Transactional
    public StatusOption update(Long advertiserId, Long id, String rawName, Boolean archived) {
        CustomLeadStatus def = requireOwn(advertiserId, id);
        if (rawName != null && !rawName.isBlank()) {
            String name = cleanName(rawName);
            if (!name.equals(def.getName())) {
                if (LeadStatuses.FIXED_LABELS.containsValue(name)) {
                    throw new InvalidSubmissionException("기본 상태(" + name + ")와 같은 이름은 쓸 수 없습니다.");
                }
                if (customStatusRepository.findByAdvertiserIdAndName(advertiserId, name).isPresent()) {
                    throw new InvalidSubmissionException("이미 같은 이름의 상태가 있습니다.");
                }
                def.rename(name);
            }
        }
        if (archived != null) {
            def.setArchived(archived);
        }
        return StatusOption.of(def);
    }

    /**
     * 삭제 — <b>아직 아무 리드도 쓰지 않은 정의만</b> 지울 수 있다. 쓰는 리드가 있으면 보관을 안내한다.
     * (DB FK 는 set null 이라 강제로 지워도 깨지진 않지만, 리드 화면의 상태 이름이 사라진다.)
     */
    @Transactional
    public void delete(Long advertiserId, Long id) {
        CustomLeadStatus def = requireOwn(advertiserId, id);
        if (leadRepository.existsByCustomStatusId(id)) {
            throw new InvalidSubmissionException("이 상태를 쓰는 리드가 있어 삭제할 수 없습니다. 대신 보관해주세요.");
        }
        customStatusRepository.delete(def);
    }

    private CustomLeadStatus requireOwn(Long advertiserId, Long id) {
        return customStatusRepository.findById(id)
                .filter(s -> s.getAdvertiserId().equals(advertiserId))
                .orElseThrow(() -> new NotFoundException("상태를 찾을 수 없습니다."));
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw new InvalidSubmissionException("상태 이름을 입력해주세요.");
        }
        if (name.length() > CustomLeadStatus.NAME_MAX) {
            throw new InvalidSubmissionException("상태 이름은 " + CustomLeadStatus.NAME_MAX + "자 이내로 해주세요.");
        }
        return name;
    }
}
