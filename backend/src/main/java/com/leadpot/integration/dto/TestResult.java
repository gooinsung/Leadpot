package com.leadpot.integration.dto;

import java.util.List;

/** 연동 테스트 결과. 채널별 성공/실패 사유를 담는다. */
public record TestResult(List<ChannelResult> results) {

    public record ChannelResult(String channel, boolean ok, String message) {
    }
}
