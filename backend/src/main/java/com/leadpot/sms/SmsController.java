package com.leadpot.sms;

import java.io.IOException;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.leadpot.auth.Plan;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;

/** 문자 발송 상태·이력·테스트 발송 API (로그인 필요, 본인 계정 것만). */
@RestController
@RequestMapping("/api/sms")
public class SmsController {

    /** 이력 화면 1페이지 크기. 페이지네이션은 필요해지면 추가한다. */
    private static final int PAGE_SIZE = 100;

    private final SmsService smsService;
    private final MessageLogRepository logRepository;
    private final UserRepository userRepository;

    public SmsController(SmsService smsService, MessageLogRepository logRepository, UserRepository userRepository) {
        this.smsService = smsService;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
    }

    /**
     * 문자 발송 현황.
     *
     * @param ready       지금 보낼 수 있는 상태인가
     * @param senderPhone 실제로 나갈 발신번호(마스킹)
     * @param used        이번 달 사용량
     * @param limit       이번 달 한도. 0 이면 무제한
     * @param failed      이번 달 실패 건수 — 자동 발송은 조용히 실패하므로 눈에 띄게 노출한다
     */
    public record SmsStatus(boolean ready, String senderPhone,
            long used, int limit, long failed, Plan plan) {
    }

    @GetMapping("/status")
    public SmsStatus status(@AuthenticationPrincipal Jwt jwt) {
        Long ownerId = userId(jwt);
        User me = userRepository.findById(ownerId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        SmsCredentials cred = smsService.resolveCredentials(ownerId, null);
        long failed = logRepository.countByOwnerIdAndStatusAndCreatedAtGreaterThanEqual(
                ownerId, MessageLog.STATUS_FAILED, monthStart());
        return new SmsStatus(cred.usable(),
                PhoneNumbers.mask(cred.senderPhone()), smsService.usedThisMonth(ownerId),
                smsService.monthlyLimit(me.getPlan()), failed, me.getPlan());
    }

    /** 발송 이력 항목(수신번호는 마스킹된 값이다). */
    public record MessageLogItem(Long id, String channel, String recipientType, String recipient,
            String body, String status, String error, boolean systemCredential, String createdAt) {

        static MessageLogItem from(MessageLog m) {
            return new MessageLogItem(m.getId(), m.getChannel(), m.getRecipientType(), m.getRecipient(),
                    m.getRenderedBody(), m.getStatus(), m.getError(), m.isSystemCredential(),
                    m.getCreatedAt() == null ? null : m.getCreatedAt().toString());
        }
    }

    @GetMapping("/logs")
    public List<MessageLogItem> logs(@AuthenticationPrincipal Jwt jwt) {
        return logRepository.findByOwnerIdOrderByCreatedAtDesc(userId(jwt), PageRequest.of(0, PAGE_SIZE))
                .stream().map(MessageLogItem::from).toList();
    }

    /** 테스트 발송 요청. 번호를 비우면 내 계정 연락처로 보낸다. */
    public record TestSendRequest(String to, String text) {
    }

    /** 테스트 발송 결과 — 실패 사유를 그대로 돌려줘야 조치가 된다(미등록 발신번호·잔액 부족 등). */
    public record TestSendResult(boolean ok, String status, String error, String channel, int bytes) {
    }

    @PostMapping("/test")
    public TestSendResult test(@AuthenticationPrincipal Jwt jwt, @RequestBody TestSendRequest request) {
        Long ownerId = userId(jwt);
        User me = userRepository.findById(ownerId)
                .orElseThrow(() -> new NotFoundException("계정을 찾을 수 없습니다."));
        String to = request.to() == null || request.to().isBlank() ? me.getPhone() : request.to();
        String text = request.text() == null || request.text().isBlank()
                ? "[리드팟] 문자 발송 연동 테스트입니다."
                : request.text();
        MessageLog entry = smsService.send(SmsService.SmsRequest.to(ownerId, to, text, MessageLog.TO_TEST));
        return new TestSendResult(MessageLog.STATUS_SENT.equals(entry.getStatus()), entry.getStatus(),
                entry.getError(), entry.getChannel(), SolapiSmsSender.byteLength(text));
    }

    /**
     * 첨부 업로드 결과.
     *
     * @param imageId 리드폼 설정에 저장할 값(대행사 fileId)
     * @param bytes   변환 후 크기 — 원본이 얼마나 줄었는지 화면에 보여준다
     */
    public record AttachmentResult(String imageId, int bytes) {
    }

    /**
     * 고객향 문자에 붙일 이미지 첨부. 규격(JPG·200KB)은 서버가 맞춘다 — 마케터는 명함 사진을 그대로 올리면 된다.
     * 첨부가 붙은 문자는 <b>MMS(건당 60원)</b>로 나간다.
     */
    @PostMapping("/attachment")
    public AttachmentResult attachment(@AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new InvalidSubmissionException("파일이 비어 있습니다.");
        }
        byte[] jpeg = SmsImages.toMmsJpeg(file.getBytes());
        SmsSender.UploadResult result = smsService.uploadAttachment(userId(jwt), jpeg,
                file.getOriginalFilename());
        if (!result.ok()) {
            // 대행사 사유를 그대로 올려보낸다(잔액·권한 등) — 감춰봐야 조치가 안 된다.
            throw new InvalidSubmissionException("첨부 업로드에 실패했습니다. " + result.error());
        }
        return new AttachmentResult(result.fileId(), jpeg.length);
    }

    /** 본문 길이·과금 구분 미리보기(저장 없이). 편집기에서 SMS/LMS 전환을 바로 보여주기 위한 것. */
    @GetMapping("/measure")
    public TestSendResult measure(@RequestParam String text) {
        return new TestSendResult(true, "MEASURED", null, SolapiSmsSender.channelOf(text),
                SolapiSmsSender.byteLength(text));
    }

    private static java.time.Instant monthStart() {
        java.time.ZoneId kst = java.time.ZoneId.of("Asia/Seoul");
        return java.time.LocalDate.now(kst).withDayOfMonth(1).atStartOfDay(kst).toInstant();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
