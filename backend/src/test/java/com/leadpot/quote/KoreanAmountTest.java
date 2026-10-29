package com.leadpot.quote;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class KoreanAmountTest {

    @Test
    @DisplayName("금액을 한글로 읽는다 — 십·백·천 앞의 '일'은 생략")
    void toHangul() {
        assertThat(KoreanAmount.toHangul(2_750_000)).isEqualTo("이백칠십오만");
        assertThat(KoreanAmount.toHangul(10_000)).isEqualTo("일만");
        assertThat(KoreanAmount.toHangul(1_100)).isEqualTo("천백");
        assertThat(KoreanAmount.toHangul(100_000_001)).isEqualTo("일억일");
        assertThat(KoreanAmount.toHangul(0)).isEqualTo("영");
        assertThat(KoreanAmount.toHangul(1_234_567_890)).isEqualTo("십이억삼천사백오십육만칠천팔백구십");
    }
}
