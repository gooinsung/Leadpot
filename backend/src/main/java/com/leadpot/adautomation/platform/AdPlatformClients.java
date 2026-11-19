package com.leadpot.adautomation.platform;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.leadpot.common.error.InvalidSubmissionException;

/** 매체 → 어댑터. 스프링이 등록된 {@link AdPlatformClient} 빈을 모두 넘겨준다(새 매체 = 빈 하나 추가). */
@Component
public class AdPlatformClients {

    private final Map<AdPlatform, AdPlatformClient> clients = new EnumMap<>(AdPlatform.class);

    public AdPlatformClients(List<AdPlatformClient> all) {
        for (AdPlatformClient c : all) {
            clients.put(c.platform(), c);
        }
    }

    public AdPlatformClient get(AdPlatform platform) {
        AdPlatformClient c = clients.get(platform);
        if (c == null) {
            throw new InvalidSubmissionException(platform.label() + " 연동은 아직 준비 중입니다.");
        }
        return c;
    }

    public boolean supports(AdPlatform platform) {
        return clients.containsKey(platform);
    }
}
