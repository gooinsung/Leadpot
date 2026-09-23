package com.leadpot.common;

/** 복사본 이름 규칙(리드폼·랜딩 복사 공통) — 원래 이름 뒤에 " (복사본)" 을 붙인다. */
public final class CopyNames {

    /** 이름 컬럼 한도(forms.name·landing_pages.title 모두 255) — 넘치면 원래 이름 쪽을 자른다. */
    static final int MAX_LENGTH = 255;
    static final String SUFFIX = " (복사본)";

    private CopyNames() {
    }

    public static String of(String original) {
        String base = original == null ? "" : original.trim();
        int room = MAX_LENGTH - SUFFIX.length();
        if (base.length() > room) {
            base = base.substring(0, room).trim();
        }
        return base + SUFFIX;
    }
}
