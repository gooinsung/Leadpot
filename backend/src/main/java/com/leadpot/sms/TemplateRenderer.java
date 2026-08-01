package com.leadpot.sms;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.leadpot.form.Form;
import com.leadpot.lead.Lead;

/**
 * 템플릿 본문에 리드 값을 끼워 넣는다. 저장 형식은 <b>변수키</b>({@code {{f1}}})이고 화면에서는 항목명으로 보인다
 * (docs/MESSAGING-PLAN.md §4).
 *
 * <p>값을 찾는 순서: {@code answers[].varKey} → 없으면 {@code answers[].label}(과거 리드 폴백).
 * 값이 비면 빈 문자열로 치환하고 어떤 변수가 비었는지 돌려준다 — 조용히 이상한 문자가 나가지 않게.
 */
public final class TemplateRenderer {

    /**
     * {{f1}} · {{form.name}} 같은 변수. 한글 항목명({{이름}})도 받는다 —
     * 저장 형식은 변수키지만 마케터가 직접 항목명을 써넣는 경우가 있고, 그때 조용히 치환 안 되면 이상한 문자가 나간다.
     */
    private static final Pattern VAR = Pattern.compile("\\{\\{\\s*([^{}]+?)\\s*}}");
    private static final DateTimeFormatter DT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));

    private TemplateRenderer() {
    }

    /**
     * 렌더 결과.
     *
     * @param text        치환된 본문
     * @param missing     값이 비어 있던 변수 이름들(로그·경고용)
     */
    public record Rendered(String text, List<String> missing) {
    }

    /** 리드 기반 렌더. {@code lead} 가 null 이면 시스템 변수만 치환한다(미리보기용). */
    public static Rendered render(String template, Form form, Lead lead) {
        if (template == null || template.isBlank()) {
            return new Rendered("", List.of());
        }
        Map<String, String> values = values(form, lead);
        Set<String> missing = new HashSet<>();
        Matcher m = VAR.matcher(template);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String key = m.group(1);
            String value = values.get(key);
            if (value == null || value.isBlank()) {
                missing.add(key);
                value = "";
            }
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return new Rendered(out.toString(), new ArrayList<>(missing));
    }

    /** 이 템플릿이 쓰는 변수 이름 전부. 리드폼 저장 시 "사라진 변수" 판정에 쓴다(§2 안전장치). */
    public static Set<String> usedVars(String template) {
        Set<String> out = new java.util.LinkedHashSet<>();
        if (template == null) {
            return out;
        }
        Matcher m = VAR.matcher(template);
        while (m.find()) {
            out.add(m.group(1));
        }
        return out;
    }

    /** 리드 답변에서 변수키로 값 찾기. 없으면 항목명으로 폴백(varKey 도입 전 리드). */
    public static String answerValue(Lead lead, String varKeyOrLabel) {
        if (lead == null || lead.getAnswers() == null || varKeyOrLabel == null) {
            return "";
        }
        for (Map<String, Object> a : lead.getAnswers()) {
            if (varKeyOrLabel.equals(str(a.get("varKey")))) {
                return str(a.get("value"));
            }
        }
        for (Map<String, Object> a : lead.getAnswers()) {
            if (varKeyOrLabel.equals(str(a.get("label")))) {
                return str(a.get("value"));
            }
        }
        return "";
    }

    private static Map<String, String> values(Form form, Lead lead) {
        Map<String, String> values = new LinkedHashMap<>();
        // 시스템 변수
        if (form != null) {
            values.put("form.name", nn(form.getName()));
        }
        if (lead != null) {
            values.put("lead.createdAt", lead.getCreatedAt() == null ? "" : DT.format(lead.getCreatedAt()));
            // 리드 답변 — 변수키와 항목명 둘 다 키로 넣어 어느 쪽으로 써도 맞는다.
            if (lead.getAnswers() != null) {
                for (Map<String, Object> a : lead.getAnswers()) {
                    String value = str(a.get("value"));
                    String varKey = str(a.get("varKey"));
                    String label = str(a.get("label"));
                    if (!varKey.isBlank()) {
                        values.putIfAbsent(varKey, value);
                    }
                    if (!label.isBlank()) {
                        values.putIfAbsent(label, value);
                    }
                }
            }
        }
        return values;
    }

    private static String nn(String s) {
        return s == null ? "" : s;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }
}
