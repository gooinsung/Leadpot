package com.leadpot.tag;

import java.util.ArrayList;
import java.util.List;

/** 리드폼·랜딩 태그 정리 — 공백 제거·중복 제거, 최대 20개·각 30자. 비면 null(DB 에 빈 배열을 남기지 않는다). */
public final class ContentTags {

    public static final int MAX_COUNT = 20;
    public static final int MAX_LENGTH = 30;

    private ContentTags() {
    }

    public static List<String> clean(List<String> tags) {
        List<String> out = new ArrayList<>();
        if (tags != null) {
            for (String t : tags) {
                String v = t == null ? "" : t.trim();
                if (v.length() > MAX_LENGTH) {
                    v = v.substring(0, MAX_LENGTH);
                }
                if (!v.isEmpty() && !out.contains(v)) {
                    out.add(v);
                }
                if (out.size() >= MAX_COUNT) {
                    break;
                }
            }
        }
        return out.isEmpty() ? null : out;
    }
}
