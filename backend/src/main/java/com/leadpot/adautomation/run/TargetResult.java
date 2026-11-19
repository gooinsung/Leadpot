package com.leadpot.adautomation.run;

import com.leadpot.adautomation.platform.AdPlatform;

/** 동작을 대상 하나에 실행한 결과(알림·화면용). */
public record TargetResult(AdPlatform platform, String campaignName, boolean success, String message) {
}
