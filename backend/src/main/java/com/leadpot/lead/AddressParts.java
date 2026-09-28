package com.leadpot.lead;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 리드폼 '주소(우편번호 검색)' 항목의 값을 <b>우편번호</b>와 <b>주소</b>로 나눈다.
 *
 * <p>공개 폼은 주소를 {@code "(06234) 서울 강남구 테헤란로 123"} 한 문자열로 보낸다(화면·엑셀·알림은 이 값을 그대로 쓴다).
 * 외부 API 전달처럼 둘을 따로 써야 하는 곳을 위해, 접수할 때 답변에 {@link #ZONECODE}·{@link #ADDRESS} 키를
 * <b>함께 저장</b>한다(사용자 요구 2026-09-28). 예전에 접수된 리드처럼 키가 없으면 값을 다시 쪼개 쓴다.
 */
public final class AddressParts {

    /** 답변 맵에 따로 저장하는 키. */
    public static final String ZONECODE = "zonecode";
    public static final String ADDRESS = "address";

    /** 주소 입력 유형(public-ui fieldTypes.ts 의 "address"). */
    public static final String FIELD_TYPE = "address";

    /** "(우편번호) 주소" — 우편번호는 현행 5자리, 옛 6자리(000-000)도 허용. */
    private static final Pattern PATTERN = Pattern.compile("^\\s*\\(([0-9]{3}-?[0-9]{2,3})\\)\\s*(.*)$", Pattern.DOTALL);

    private AddressParts() {
    }

    /** 값 → [우편번호, 주소]. 형식이 아니면 우편번호는 빈 값, 주소는 값 전체. */
    public static String[] split(String value) {
        String v = value == null ? "" : value;
        Matcher m = PATTERN.matcher(v);
        if (m.matches()) {
            return new String[] {m.group(1), m.group(2).trim()};
        }
        return new String[] {"", v.trim()};
    }

    /** 주소 유형 답변에 우편번호·주소 키를 채운 새 목록. 다른 답변은 그대로 둔다. */
    public static List<Map<String, Object>> stamp(List<Map<String, Object>> answers) {
        return answers.stream().map(a -> {
            if (!FIELD_TYPE.equals(String.valueOf(a.get("fieldType")))) {
                return a;
            }
            String[] parts = split(a.get("value") == null ? "" : a.get("value").toString());
            Map<String, Object> copy = new LinkedHashMap<>(a);
            copy.put(ZONECODE, parts[0]);
            copy.put(ADDRESS, parts[1]);
            return copy;
        }).toList();
    }

    /**
     * 답변에서 원하는 부분만. part 가 {@link #ZONECODE}·{@link #ADDRESS} 가 아니면 값 전체.
     * 저장된 키를 먼저 쓰고, 없으면(예전 리드·다른 유형) 값을 쪼갠다.
     */
    public static String part(Map<String, Object> answer, String part) {
        String value = answer.get("value") == null ? "" : answer.get("value").toString();
        if (!ZONECODE.equals(part) && !ADDRESS.equals(part)) {
            return value;
        }
        Object stored = answer.get(part);
        if (stored != null) {
            return stored.toString();
        }
        String[] parts = split(value);
        return ZONECODE.equals(part) ? parts[0] : parts[1];
    }
}
