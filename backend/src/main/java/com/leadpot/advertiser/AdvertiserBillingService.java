package com.leadpot.advertiser;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.form.Form;
import com.leadpot.lead.Lead;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadStatuses;
import com.leadpot.sms.AfterCommitSms;
import com.leadpot.sms.MessageLog;
import com.leadpot.sms.SmsService;

/**
 * 광고주 선입금 과금(V31) — 원장 기록과 알림의 단일 창구.
 *
 * <h3>규칙 (2026-08-08 사용자 확정)</h3>
 * <ul>
 * <li><b>차감</b>: 리드가 {@code VALID}(유효)로 <b>들어오는 순간</b> 단가만큼 DEBIT.
 *     상태를 스캔하지 않고 전이 이벤트로만 기록하므로, 과금 설정 전의 옛 유효 리드가
 *     소급 청구되는 일이 없다.</li>
 * <li><b>환급</b>: 유효에서 <b>빠져나가는 순간</b>(AS 인정→무효 포함) 차감분만큼 REFUND.
 *     리드별 순액({@code netChargedForLead})으로 판정해 중복 차감·중복 환급이 안 된다.</li>
 * <li><b>잔액 소진돼도 수집은 계속</b> — 잔액이 마이너스로 내려간다(후정산).</li>
 * <li><b>잔액 알림</b>: 차감 후 잔액이 임계값 미만이면 결제 담당자에게 문자.
 *     수신번호는 마케터 지정({@code balanceAlertPhone}) → 광고주 등록({@code notifyPhone})
 *     → 없으면 발송 안 함. 임계 아래에 머무는 동안 반복 발송하지 않는다.</li>
 * <li><b>일 목표 알림</b>: 그날 접수 수가 목표에 닿으면 마케터에게 문자(하루 1회).</li>
 * </ul>
 */
@Service
public class AdvertiserBillingService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final AdvertiserFormGrantRepository grantRepository;
    private final AdvertiserLedgerRepository ledgerRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final com.leadpot.form.FormRepository formRepository;
    private final AfterCommitSms afterCommitSms;

    public AdvertiserBillingService(AdvertiserFormGrantRepository grantRepository,
            AdvertiserLedgerRepository ledgerRepository, LeadRepository leadRepository,
            UserRepository userRepository, com.leadpot.form.FormRepository formRepository,
            AfterCommitSms afterCommitSms) {
        this.grantRepository = grantRepository;
        this.ledgerRepository = ledgerRepository;
        this.leadRepository = leadRepository;
        this.userRepository = userRepository;
        this.formRepository = formRepository;
        this.afterCommitSms = afterCommitSms;
    }

    // ---------- 상태 전이 훅 (LeadStatusService 가 호출) ----------

    /**
     * 상태 전이에 따른 차감/환급. 호출 트랜잭션에 참여한다 — 상태 변경과 원장이 함께 커밋/롤백돼야 한다.
     *
     * @param actorId 전이를 일으킨 사용자(이력용). 자동 승인은 폼 소유 마케터.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void onStatusChanged(Lead lead, String before, String after, Long actorId) {
        boolean enteredValid = !LeadStatuses.VALID.equals(before) && LeadStatuses.VALID.equals(after);
        boolean leftValid = LeadStatuses.VALID.equals(before) && !LeadStatuses.VALID.equals(after);
        if (!enteredValid && !leftValid) {
            return;
        }
        AdvertiserFormGrant grant = grantRepository.findByFormId(lead.getFormId()).orElse(null);
        if (grant == null || grant.getUnitPrice() <= 0) {
            return; // 과금 계약이 없는 리드폼 — 원장을 만들지 않는다
        }
        long alreadyCharged = -ledgerRepository.netChargedForLead(lead.getId()); // 차감돼 있으면 양수
        if (enteredValid && alreadyCharged <= 0) {
            ledgerRepository.save(new AdvertiserLedgerEntry(grant, AdvertiserLedgerEntry.TYPE_DEBIT,
                    -grant.getUnitPrice(), lead.getId(), "유효 확정", actorId));
            maybeSendBalanceAlert(grant);
        } else if (leftValid && alreadyCharged > 0) {
            // 환급은 실제 차감된 금액 그대로 — 그 사이 단가가 바뀌었어도 받은 만큼 돌려준다.
            ledgerRepository.save(new AdvertiserLedgerEntry(grant, AdvertiserLedgerEntry.TYPE_REFUND,
                    (int) alreadyCharged, lead.getId(),
                    LeadStatuses.INVALID.equals(after) ? "AS 인정 환급" : "유효 해제 환급", actorId));
        }
    }

    /** 차감 직후 잔액이 임계값 미만이면 결제 담당자에게 문자를 예약한다(커밋 후 발송). */
    private void maybeSendBalanceAlert(AdvertiserFormGrant grant) {
        if (!grant.isBalanceAlertEnabled() || grant.getBalanceAlertThreshold() <= 0) {
            return;
        }
        long balance = ledgerRepository.balance(grant.getFormId());
        if (balance >= grant.getBalanceAlertThreshold()) {
            return;
        }
        if (grant.getBalanceAlertSentAt() != null) {
            return; // 임계 아래에 머무는 동안 반복 발송 금지 — 충전 시 초기화된다
        }
        String to = pick(grant.getBalanceAlertPhone(), grant.getNotifyPhone());
        if (to == null) {
            return; // 마케터 지정도 광고주 등록도 없으면 보내지 않는다(사용자 확정)
        }
        grant.setBalanceAlertSentAt(Instant.now());
        Long ownerId = formOwnerId(grant);
        String name = displayName(grant);
        String text = "[리드팟] '" + name + "' 광고 잔액이 " + won(balance) + "원 남았습니다."
                + " 충전이 필요하면 담당 마케터에게 연락해주세요.";
        afterCommitSms.send(SmsService.SmsRequest.to(ownerId, to, text, MessageLog.TO_ADVERTISER)
                .forLead(grant.getFormId(), null));
    }

    // ---------- 신규 접수 훅 (NotificationService 가 호출) ----------

    /**
     * 일 목표 달성 검사(제출 트랜잭션 안에서). 목표에 닿는 순간 마케터 문자를 예약하고
     * 오늘 날짜를 찍어 하루 1회로 제한한다. 커밋이 안 되면 문자도 안 나간다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void checkDailyGoal(Form form, Lead lead) {
        AdvertiserFormGrant grant = grantRepository.findByFormId(form.getId()).orElse(null);
        if (grant == null || grant.getDailyGoal() <= 0) {
            return;
        }
        LocalDate today = LocalDate.now(KST);
        if (today.equals(grant.getGoalAlertDate())) {
            return; // 오늘 이미 알렸다
        }
        Instant todayStart = today.atStartOfDay(KST).toInstant();
        long todayCount = leadRepository.countByFormIdAndDeletedAtIsNullAndCreatedAtAfter(form.getId(), todayStart);
        if (todayCount < grant.getDailyGoal()) {
            return;
        }
        grant.setGoalAlertDate(today);
        String to = marketerPhone(form);
        if (to == null) {
            return;
        }
        String text = "[리드팟] '" + form.getName() + "' 리드의 일 목표 수량(" + grant.getDailyGoal()
                + "건)을 달성했어요.";
        afterCommitSms.send(SmsService.SmsRequest.to(form.getOwnerId(), to, text, MessageLog.TO_MARKETER)
                .forLead(form.getId(), lead.getId()));
    }

    // ---------- 마케터 조작 (충전·설정) ----------

    /** 충전 기록(마케터). 잔액이 임계값 위로 회복되면 잔액 알림 억제를 푼다. */
    @Transactional
    public void recordCharge(AdvertiserFormGrant grant, int amount, String memo, Long marketerId) {
        if (amount <= 0) {
            throw new InvalidSubmissionException("충전 금액은 1원 이상이어야 합니다.");
        }
        ledgerRepository.save(new AdvertiserLedgerEntry(grant, AdvertiserLedgerEntry.TYPE_CHARGE,
                amount, null, memo == null || memo.isBlank() ? "충전" : memo.trim(), marketerId));
        if (grant.getBalanceAlertSentAt() != null
                && ledgerRepository.balance(grant.getFormId()) >= grant.getBalanceAlertThreshold()) {
            grant.setBalanceAlertSentAt(null);
        }
    }

    /** 이번 달(KST) 수익 — 차감−환급. */
    @Transactional(readOnly = true)
    public long earnedThisMonth(Long formId) {
        LocalDate first = LocalDate.now(KST).withDayOfMonth(1);
        return ledgerRepository.earnedBetween(formId,
                first.atStartOfDay(KST).toInstant(),
                first.plusMonths(1).atStartOfDay(KST).toInstant());
    }

    @Transactional(readOnly = true)
    public long balance(Long formId) {
        return ledgerRepository.balance(formId);
    }

    // ---------- 마케터 화면 API (BillingController) ----------

    /** 과금 화면 요약. 이 리드폼이 내 것인지는 호출부(컨트롤러)가 확인했다. */
    public record BillingView(
            boolean linked,
            String advertiserName,
            /** 광고주가 등록한 접수 알림 번호(마스킹). 잔액 알림의 폴백 대상이 있는지 보여준다. */
            String notifyPhoneMasked,
            int unitPrice,
            int dailyGoal,
            int totalGoal,
            boolean balanceAlertEnabled,
            int balanceAlertThreshold,
            String balanceAlertPhone,
            long balance,
            long earnedThisMonth,
            long todayLeads,
            long validLeads,
            java.util.List<LedgerRow> ledger) {
    }

    public record LedgerRow(Long id, String entryType, int amount, Long leadId, String memo,
            Instant createdAt) {
    }

    /** 과금 요약 조회 — 리드폼에 광고주가 없으면 linked=false 로 안내만 한다. */
    @Transactional(readOnly = true)
    public BillingView view(Long formId) {
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId).orElse(null);
        if (grant == null) {
            return new BillingView(false, null, null, 0, 0, 0, false, 0, null, 0, 0, 0, 0, java.util.List.of());
        }
        String advName = userRepository.findById(grant.getAdvertiserId())
                .map(u -> u.getCompany() != null && !u.getCompany().isBlank() ? u.getCompany() : u.getName())
                .orElse("광고주");
        Instant todayStart = LocalDate.now(KST).atStartOfDay(KST).toInstant();
        long today = leadRepository.countByFormIdAndDeletedAtIsNullAndCreatedAtAfter(formId, todayStart);
        long valid = leadRepository.countByFormIdAndDeletedAtIsNullAndStatus(formId, LeadStatuses.VALID);
        java.util.List<LedgerRow> rows = ledgerRepository.findTop50ByFormIdOrderByCreatedAtDescIdDesc(formId)
                .stream().map(e -> new LedgerRow(e.getId(), e.getEntryType(), e.getAmount(), e.getLeadId(),
                        e.getMemo(), e.getCreatedAt()))
                .toList();
        return new BillingView(true, advName,
                com.leadpot.sms.PhoneNumbers.mask(grant.getNotifyPhone()),
                grant.getUnitPrice(), grant.getDailyGoal(), grant.getTotalGoal(),
                grant.isBalanceAlertEnabled(), grant.getBalanceAlertThreshold(), grant.getBalanceAlertPhone(),
                ledgerRepository.balance(formId), earnedThisMonth(formId), today, valid, rows);
    }

    /** 과금 설정 저장(마케터). 광고주 미연결이면 설정할 수 없다(계약 대상이 없다). */
    @Transactional
    public BillingView updateSettings(Long formId, int unitPrice, int dailyGoal, int totalGoal,
            boolean alertEnabled, int alertThreshold, String alertPhone) {
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .orElseThrow(() -> new InvalidSubmissionException(
                        "이 리드폼에는 연결된 광고주가 없습니다. 광고주 관리에서 먼저 연결해주세요."));
        if (unitPrice < 0 || dailyGoal < 0 || totalGoal < 0 || alertThreshold < 0) {
            throw new InvalidSubmissionException("금액·수량은 0 이상이어야 합니다.");
        }
        String phone = null;
        if (alertPhone != null && !alertPhone.isBlank()) {
            phone = com.leadpot.sms.PhoneNumbers.normalize(alertPhone);
            if (phone == null) {
                throw new InvalidSubmissionException("잔액 알림 수신번호 형식이 올바르지 않습니다.");
            }
        }
        grant.applyBilling(unitPrice, dailyGoal, totalGoal, alertEnabled, alertThreshold, phone);
        // 임계값·번호가 바뀌면 억제 상태를 푼다 — 새 기준으로 다시 판정하게.
        grant.setBalanceAlertSentAt(null);
        return view(formId);
    }

    /** 충전 기록(마케터, 컨트롤러 진입점). */
    @Transactional
    public BillingView charge(Long formId, int amount, String memo, Long marketerId) {
        AdvertiserFormGrant grant = grantRepository.findByFormId(formId)
                .orElseThrow(() -> new InvalidSubmissionException("이 리드폼에는 연결된 광고주가 없습니다."));
        recordCharge(grant, amount, memo, marketerId);
        return view(formId);
    }

    // ---------- 내부 ----------

    private Long formOwnerId(AdvertiserFormGrant grant) {
        // 원장 알림의 발송 계정 = 폼 소유 마케터. 광고주는 발송 권한 체계(V25) 밖이다.
        return userRepository.findById(grant.getAdvertiserId())
                .map(User::getParentUserId)
                .orElse(null);
    }

    private String displayName(AdvertiserFormGrant grant) {
        return grant.getDisplayName() == null || grant.getDisplayName().isBlank()
                ? "리드폼 " + grant.getFormId()
                : grant.getDisplayName();
    }

    /** 마케터 수신번호 — 리드폼 지정(smsMarketerPhone) 우선, 없으면 계정 연락처(LeadSmsPlanner ① 과 동일). */
    private String marketerPhone(Form form) {
        String to = form.getSettingsConfig() == null ? null
                : str(form.getSettingsConfig().get("smsMarketerPhone"));
        if (to == null || to.isBlank()) {
            to = userRepository.findById(form.getOwnerId()).map(User::getPhone).orElse(null);
        }
        return to == null || to.isBlank() ? null : to;
    }

    private static String pick(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second == null || second.isBlank() ? null : second;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static String won(long n) {
        return String.format("%,d", n);
    }
}
