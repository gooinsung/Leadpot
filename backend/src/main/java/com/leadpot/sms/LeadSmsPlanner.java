package com.leadpot.sms;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.advertiser.AdvertiserFormGrant;
import com.leadpot.advertiser.AdvertiserFormGrantRepository;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;
import com.leadpot.form.Form;
import com.leadpot.form.FormBlock;
import com.leadpot.lead.Lead;

/**
 * 리드 접수 시 나갈 문자 목록을 만든다(전송은 하지 않음).
 *
 * <p>대상 3종(docs/MESSAGING-PLAN.md §6):
 * <ol>
 *   <li><b>마케터</b> — 리드 발생 알림. 수신은 계정 연락처.</li>
 *   <li><b>광고주</b> — 리드 접수 알림. <b>마케터가 리드폼별로 켠다</b>(광고주가 스스로 켜는 게 아니다).</li>
 *   <li><b>고객(리드 본인)</b> — 마케터가 쓴 템플릿. 수신번호는 리드폼의 연락처 항목에서 가져온다.</li>
 * </ol>
 *
 * <p>설정은 리드폼의 {@code settingsConfig}(JSONB)에 둔다 — 기존 텔레그램·구글시트 토글과 같은 자리라
 * 마이그레이션이 필요 없다.
 *
 * <p>순수 조회라 대상 선정 로직을 테스트에서 결정적으로 검증할 수 있다
 * ({@code NotificationService.planDispatches} 와 같은 설계).
 */
@Service
public class LeadSmsPlanner {

    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("MM/dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));

    private final AdvertiserFormGrantRepository grantRepository;
    private final UserRepository userRepository;
    private final String publicBaseUrl;

    public LeadSmsPlanner(AdvertiserFormGrantRepository grantRepository, UserRepository userRepository,
            @Value("${app.public-base-url:https://app.lead-pot.com}") String publicBaseUrl) {
        this.grantRepository = grantRepository;
        this.userRepository = userRepository;
        this.publicBaseUrl = trimTrailingSlash(publicBaseUrl);
    }

    /** 이 리드에 대해 실제로 나갈 문자 목록. 켜져 있지 않으면 빈 목록. */
    @Transactional(readOnly = true)
    public List<SmsService.SmsRequest> plan(Form form, Lead lead) {
        List<SmsService.SmsRequest> out = new ArrayList<>();
        Map<String, Object> cfg = form.getSettingsConfig();
        if (cfg == null) {
            return out;
        }
        // 리드폼별 발신번호 지정. 화면에서는 아직 제공하지 않아 항상 비어 있고 시스템 발신번호로 나간다.
        // 구조만 남겨둔다 — 위임 등록이 끝난 마케터에게 자기 번호를 열어줄 자리다(MESSAGING-PLAN §11).
        String senderPhone = str(cfg.get("smsSenderPhone"));

        // ① 마케터 — 리드 발생 알림. 리드폼에 지정한 번호가 우선이고, 비우면 계정 연락처로 떨어진다.
        // 수신번호가 끝내 비어도 목록에는 넣는다 — 조용히 사라지지 않고 SKIPPED 로 이력에 남아야 한다.
        if (on(cfg.get("smsMarketerEnabled"))) {
            String to = str(cfg.get("smsMarketerPhone"));
            if (to.isBlank()) {
                User marketer = userRepository.findById(form.getOwnerId()).orElse(null);
                to = marketer == null ? "" : nn(marketer.getPhone());
            }
            out.add(request(form, lead, to, marketerText(form, lead), MessageLog.TO_MARKETER, senderPhone));
        }

        // ② 광고주 — 마케터가 켰고 + 광고주가 연결됐고 + 광고주가 자기 번호를 등록했을 때만.
        //
        // ⚠️ 수신번호는 오직 광고주가 포털에서 직접 등록한 값(grant.notifyPhone)만 쓴다(V28).
        // 예전에는 마케터가 cfg.smsAdvertiserPhone 에 남의 번호를 대신 넣을 수 있었고 계정 연결이
        // 없어도 보냈다. 그 번호의 주인은 동의한 적도 끌 수도 없었다 — 발신 채널이 리드팟 명의
        // 하나라 신고 한 번에 전 고객 알림이 막힌다(MESSAGING-PLAN §9). 마케터 계정 연락처로의
        // 폴백도 없애야 한다. 광고주 알림이 마케터 번호로 가면 동의 근거가 다시 사라진다.
        //
        // 번호가 없으면 목록에서 빼지 않고 빈 수신번호로 넣는다 — 조용히 사라지지 않고
        // SKIPPED 로 이력에 남아야 마케터가 "왜 안 왔지"를 추적할 수 있다(①과 같은 원칙).
        if (on(cfg.get("smsAdvertiserEnabled"))) {
            AdvertiserFormGrant grant = grantRepository.findByFormId(form.getId())
                    .filter(g -> g.isEffective(Instant.now()))
                    .orElse(null);
            String to = "";
            if (grant != null && grant.hasNotifyPhone()) {
                User adv = userRepository.findById(grant.getAdvertiserId()).orElse(null);
                if (adv != null && adv.getRole() == Role.ADVERTISER && adv.isActive()) {
                    to = nn(grant.getNotifyPhone());
                }
            }
            out.add(request(form, lead, to, advertiserText(grant, form, lead), MessageLog.TO_ADVERTISER, senderPhone));
        }

        // ③ 고객(리드 본인) — 마케터가 쓴 템플릿. 본문이 비어 있으면 보내지 않는다.
        if (on(cfg.get("smsLeadEnabled"))) {
            String body = str(cfg.get("smsLeadBody"));
            String imageId = str(cfg.get("smsLeadImageId"));
            // 본문이 비어도 첨부만 보내는 건 의미가 있다(명함 한 장). 둘 다 없을 때만 건너뛴다.
            if (!body.isBlank() || !imageId.isBlank()) {
                String to = leadPhone(form, lead, str(cfg.get("smsLeadPhoneVarKey")));
                out.add(request(form, lead, to,
                        TemplateRenderer.render(body, form, lead).text(), MessageLog.TO_LEAD, senderPhone)
                        .withImage(blankToNull(imageId)));
            }
        }
        return out;
    }

    /**
     * 고객 수신번호. 마케터가 항목을 지정했으면 그 변수키로, 안 했으면 리드폼의 첫 연락처(tel) 항목으로 찾는다.
     * (지정을 강제하면 기존 리드폼에서 바로 못 쓰므로 자동 추론을 둔다.)
     */
    String leadPhone(Form form, Lead lead, String varKey) {
        if (!varKey.isBlank()) {
            return TemplateRenderer.answerValue(lead, varKey);
        }
        for (FormBlock b : form.getBlocks()) {
            if ("tel".equals(b.getFieldType())) {
                String key = b.getVarKey() != null ? b.getVarKey() : b.answerLabel();
                String value = TemplateRenderer.answerValue(lead, key);
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return "";
    }

    private SmsService.SmsRequest request(Form form, Lead lead, String to, String text,
            String recipientType, String senderPhone) {
        return new SmsService.SmsRequest(form.getOwnerId(), to, text, recipientType,
                form.getId(), lead.getId(), null, null, blankToNull(senderPhone), null);
    }

    /**
     * 마케터·광고주 알림 본문. 개인정보(이름·연락처)를 넣지 않는다 —
     * 접수 사실만 알리고 값은 리드팟에서 본다(알림톡 §9 와 같은 기준). 본문이 짧아 SMS 단가(18원)로 유지된다.
     */
    private String marketerText(Form form, Lead lead) {
        return "[리드팟] 새 리드 접수\n"
                + nn(form.getName()) + "\n"
                + DT.format(lead.getCreatedAt() != null ? lead.getCreatedAt() : Instant.now()) + "\n"
                + publicBaseUrl + "/leads";
    }

    /** @param grant 없을 수 있다 — 마케터가 광고주 번호를 직접 넣으면 권한 연결 없이도 나간다. */
    private String advertiserText(AdvertiserFormGrant grant, Form form, Lead lead) {
        String name = grant != null && grant.getDisplayName() != null && !grant.getDisplayName().isBlank()
                ? grant.getDisplayName()
                : nn(form.getName());
        return "[리드팟] 새 리드 접수\n"
                + name + "\n"
                + DT.format(lead.getCreatedAt() != null ? lead.getCreatedAt() : Instant.now()) + "\n"
                + publicBaseUrl + "/client";
    }

    private static boolean on(Object v) {
        return Boolean.TRUE.equals(v);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String trimTrailingSlash(String s) {
        if (s == null || s.isBlank()) {
            return "";
        }
        String t = s.trim();
        return t.endsWith("/") ? t.substring(0, t.length() - 1) : t;
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }
}
