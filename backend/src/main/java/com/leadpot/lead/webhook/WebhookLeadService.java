package com.leadpot.lead.webhook;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.stereotype.Service;

import com.leadpot.common.error.NotFoundException;
import com.leadpot.common.error.RateLimitedException;
import com.leadpot.form.Form;
import com.leadpot.form.FormRepository;
import com.leadpot.form.FormService;
import com.leadpot.form.FormSource;
import com.leadpot.form.WebhookTokens;
import com.leadpot.lead.LeadRepository;
import com.leadpot.lead.LeadService;
import com.leadpot.lead.dto.LeadSubmitRequest;

/**
 * 범용 인바운드 웹훅 리드 수신(V39). 벤더 무관 — Zapier·Make·LeadsBridge 등 무엇이 POST 하든
 * 같은 경로로 받는다(docs/META-LEADS-PLAN.md). 토큰으로 리드폼을 찾고, 마케터가 저장해둔 매핑으로
 * 답변/동의를 구성해 {@link LeadService#submit(LeadSubmitRequest, LeadService.Visitor, boolean)} 을
 * 그대로 태운다 — 문자·텔레그램 알림이 실제로 나가는 유일한 경로다(importRows 는 알림이 안 나간다).
 */
@Service
public class WebhookLeadService {

    private final FormRepository formRepository;
    private final FormService formService;
    private final LeadRepository leadRepository;
    private final LeadService leadService;
    private final WebhookRateLimiter rateLimiter;

    public WebhookLeadService(FormRepository formRepository, FormService formService,
            LeadRepository leadRepository, LeadService leadService, WebhookRateLimiter rateLimiter) {
        this.formRepository = formRepository;
        this.formService = formService;
        this.leadRepository = leadRepository;
        this.leadService = leadService;
        this.rateLimiter = rateLimiter;
    }

    /** true 면 실제로 리드가 새로 생성됨. false 면 멱등성에 걸려 조용히 버려짐(재시도·재전송). */
    public boolean receive(String rawToken, Map<String, Object> payload) {
        Form form = formRepository.findByWebhookTokenHashAndSource(WebhookTokens.hash(rawToken), FormSource.WEBHOOK)
                .orElseThrow(() -> new NotFoundException("웹훅을 찾을 수 없습니다."));
        if (!rateLimiter.allow(form.getId())) {
            throw new RateLimitedException("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        }
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        String externalId = externalId(form, safePayload);
        if (leadRepository.existsByFormIdAndExternalId(form.getId(), externalId)) {
            return false;
        }
        Instant now = Instant.now();
        try {
            LeadSubmitRequest req = buildRequest(form, safePayload, externalId);
            LeadService.Visitor visitor = new LeadService.Visitor(null, "webhook", null, null);
            leadService.submit(req, visitor, true);
            formService.recordWebhookReceipt(form.getId(), safePayload, now, null);
            return true;
        } catch (RuntimeException e) {
            formService.recordWebhookReceipt(form.getId(), safePayload, now, e.getMessage());
            throw e;
        }
    }

    @SuppressWarnings("unchecked")
    private LeadSubmitRequest buildRequest(Form form, Map<String, Object> payload, String externalId) {
        Map<String, Object> cfg = form.getWebhookConfig();
        Map<String, String> answerMapping = cfg == null ? Map.of()
                : (Map<String, String>) cfg.getOrDefault("answerMapping", Map.of());
        Map<String, String> consentMapping = cfg == null ? Map.of()
                : (Map<String, String>) cfg.getOrDefault("consentMapping", Map.of());
        List<String> alwaysAgreed = cfg == null ? List.of()
                : (List<String>) cfg.getOrDefault("alwaysAgreedConsents", List.of());

        List<Map<String, Object>> answers = new ArrayList<>();
        for (Map.Entry<String, String> e : answerMapping.entrySet()) {
            Object v = payload.get(e.getKey());
            if (v == null) {
                continue;
            }
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("label", e.getValue());
            a.put("value", String.valueOf(v));
            answers.add(a);
        }

        // 원본 키 → 동의 제목 매핑을 뒤집어(제목 기준) 폼의 동의 항목을 전부 순서대로 채운다.
        // LeadService.validate 는 "제출된 동의 배열"만 보므로, 매핑 안 된 항목도 agreed=false 로
        // 넣어야 required 검증이 원래 의도대로 동작한다(동의 안 하면 접수 자체가 안 되게, §4-2).
        //
        // alwaysAgreedConsents 는 그 반대 상황을 위한 예외다 — 원본이 애초에 동의해야만 데이터를
        // 넘기는 구조(예: 메타 잠재고객 폼은 동의 체크 없이 제출 자체가 안 됨)라 페이로드에 동의를
        // 나타내는 값 자체가 없을 수 있다. 이 목록에 있으면 페이로드 값과 무관하게 항상 동의로 본다.
        Map<String, String> titleToRawKey = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : consentMapping.entrySet()) {
            titleToRawKey.put(e.getValue(), e.getKey());
        }
        List<Map<String, Object>> consents = new ArrayList<>();
        for (Map<String, Object> item : form.consentItems()) {
            Object title = item.get("title");
            boolean required = Boolean.TRUE.equals(item.get("required"));
            boolean agreed;
            if (title instanceof String s && alwaysAgreed.contains(s)) {
                agreed = true;
            } else {
                String rawKey = title instanceof String s ? titleToRawKey.get(s) : null;
                agreed = rawKey != null && isTruthy(payload.get(rawKey));
            }
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("title", title);
            c.put("required", required);
            c.put("agreed", agreed);
            consents.add(c);
        }

        return new LeadSubmitRequest(form.getId(), null, answers, consents, null, null, externalId);
    }

    private static boolean isTruthy(Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        String s = String.valueOf(v).trim().toLowerCase();
        return s.equals("true") || s.equals("1") || s.equals("yes") || s.equals("y")
                || s.equals("동의") || s.equals("on");
    }

    /** 외부 고유값(설정돼 있으면) 또는 정규화된 페이로드 해시(폴백, 베스트에포트 — META-LEADS-PLAN §4-1). */
    private String externalId(Form form, Map<String, Object> payload) {
        Map<String, Object> cfg = form.getWebhookConfig();
        String key = cfg == null ? null : (String) cfg.get("externalIdKey");
        if (key != null && !key.isBlank()) {
            Object v = payload.get(key);
            if (v != null && !String.valueOf(v).isBlank()) {
                String s = String.valueOf(v).trim();
                return s.length() > 255 ? s.substring(0, 255) : s;
            }
        }
        return "sha256:" + sha256(canonical(payload));
    }

    private static String canonical(Map<String, Object> payload) {
        TreeMap<String, Object> sorted = new TreeMap<>(payload);
        StringBuilder sb = new StringBuilder();
        sorted.forEach((k, v) -> sb.append(k).append('=').append(v).append('&'));
        return sb.toString();
    }

    private static String sha256(String s) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 사용할 수 없습니다.", e);
        }
    }
}
