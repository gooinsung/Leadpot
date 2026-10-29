package com.leadpot.quote.dto;

import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.validation.constraints.Size;

/**
 * 견적서 당사자(공급자 또는 받는 쪽) 복사본. 견적서 안에 JSON 으로 저장된다.
 * {@code bankAccount} 는 공급자만, {@code contactName} 은 주로 받는 쪽이 쓴다.
 */
public record QuoteParty(
        @Size(max = 120) String companyName,
        @Size(max = 60) String ceoName,
        @Size(max = 20) String bizNo,
        @Size(max = 60) String contactName,
        @Size(max = 40) String phone,
        @Size(max = 255) String email,
        @Size(max = 255) String address,
        @Size(max = 255) String bankAccount) {

    public static final QuoteParty EMPTY = new QuoteParty("", "", "", "", "", "", "", "");

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("companyName", nn(companyName));
        m.put("ceoName", nn(ceoName));
        m.put("bizNo", nn(bizNo));
        m.put("contactName", nn(contactName));
        m.put("phone", nn(phone));
        m.put("email", nn(email));
        m.put("address", nn(address));
        m.put("bankAccount", nn(bankAccount));
        return m;
    }

    public static QuoteParty fromMap(Map<String, Object> m) {
        if (m == null) {
            return EMPTY;
        }
        return new QuoteParty(s(m, "companyName"), s(m, "ceoName"), s(m, "bizNo"), s(m, "contactName"),
                s(m, "phone"), s(m, "email"), s(m, "address"), s(m, "bankAccount"));
    }

    private static String s(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? "" : v.toString();
    }

    private static String nn(String v) {
        return v == null ? "" : v.trim();
    }
}
