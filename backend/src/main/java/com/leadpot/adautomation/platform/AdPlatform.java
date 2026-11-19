package com.leadpot.adautomation.platform;

/**
 * 광고 매체. 새 매체를 붙일 때는 여기에 값을 추가하고 {@link AdPlatformClient} 구현체를 하나 만든다.
 * 화면·규칙 엔진은 매체 이름을 모르고 {@link AdPlatformClient} 계약만 본다.
 */
public enum AdPlatform {
    KARROT("당근"),
    META("메타"),
    GOOGLE("구글");

    private final String label;

    AdPlatform(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
