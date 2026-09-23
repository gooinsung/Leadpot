package com.leadpot.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * JSONB 컬럼 값(Map/List 중첩)의 깊은 복사. 리드폼·랜딩 복사에서 원본 엔티티와 같은 객체를
 * 공유하지 않게 한다 — 공유하면 한쪽을 고칠 때 같은 트랜잭션 안의 다른 쪽까지 바뀐 것으로 보인다.
 * 문자열·숫자·불리언은 불변이라 그대로 둔다.
 */
public final class JsonCopies {

    private JsonCopies() {
    }

    public static Map<String, Object> map(Map<String, Object> src) {
        if (src == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        src.forEach((k, v) -> out.put(k, value(v)));
        return out;
    }

    public static List<Map<String, Object>> list(List<Map<String, Object>> src) {
        if (src == null) {
            return null;
        }
        List<Map<String, Object>> out = new ArrayList<>(src.size());
        for (Map<String, Object> m : src) {
            out.add(map(m));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Object value(Object v) {
        if (v instanceof Map<?, ?> m) {
            return map((Map<String, Object>) m);
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>(l.size());
            for (Object o : l) {
                out.add(value(o));
            }
            return out;
        }
        return v;
    }
}
