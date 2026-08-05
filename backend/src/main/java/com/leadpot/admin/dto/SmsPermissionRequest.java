package com.leadpot.admin.dto;

import java.util.List;

/**
 * 문자 발송 권한 변경 요청.
 *
 * @param enabled         발송 자체 허용 여부
 * @param allowedChannels 허용 채널({@code SMS}·{@code LMS}·{@code MMS}). 알 수 없는 값은 버린다.
 *                        단가가 크게 갈리므로 채널별로 통제한다.
 * @param monthlyLimit    월 상한. <b>0 = 금지, 양수 = 그 건수, -1 = 무제한.</b>
 *                        ⚠️ 예전 플랜 상수는 0 을 무제한으로 봤다 — 반대다(V25 주석 참고).
 */
public record SmsPermissionRequest(Boolean enabled, List<String> allowedChannels, Integer monthlyLimit) {
}
