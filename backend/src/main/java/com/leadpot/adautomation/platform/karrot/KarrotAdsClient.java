package com.leadpot.adautomation.platform.karrot;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.leadpot.adautomation.platform.AdPlatform;
import com.leadpot.adautomation.platform.AdPlatformClient;
import com.leadpot.adautomation.platform.AdPlatformException;
import com.leadpot.adautomation.platform.AdPlatformException.Kind;
import com.leadpot.common.error.InvalidSubmissionException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 당근 광고 OpenAPI(Beta) 어댑터.
 *
 * <p>근거: https://businessdaangn.gitbook.io/business.daangn/ads-pro/tools/openapi ·
 * https://ads-openapi.kr.karrotmarket.com/ (v0.7.0, 2026-11-13 확인)
 * <ul>
 * <li>인증: 헤더 {@code X-API-KEY}(키) + {@code X-ADVERTISER-ID}(광고계정 ID). 키 1개 = 광고계정 1개.</li>
 * <li>키를 재발급하면 기존 키는 <b>즉시 폐기</b>된다 → 401/403 이면 연결을 INVALID 로 돌린다.</li>
 * <li>전문가모드 광고계정만 된다. 검색광고 캠페인은 조회만 된다(켜기/끄기 불가로 표시).</li>
 * <li>호출 한도: 광고 관리 API 분당 60회(계정 단위). 초과 시 429 — 재시도하지 않고 실패로 알린다(결정 13).</li>
 * </ul>
 */
@Component
public class KarrotAdsClient implements AdPlatformClient {

    static final String API_KEY = "apiKey";
    static final String ADVERTISER_ID = "advertiserId";

    private static final int PAGE_SIZE = 100;
    /** 캠페인 목록 페이지 상한(100개 × 20 = 2,000개). 그 이상은 한도만 갉아먹으므로 자른다. */
    private static final int MAX_PAGES = 20;

    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final String baseUrl;

    public KarrotAdsClient(
            @Value("${app.ad-automation.karrot.base-url:https://ads-openapi.kr.karrotmarket.com}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    @Override
    public AdPlatform platform() {
        return AdPlatform.KARROT;
    }

    @Override
    public List<CredentialField> credentialFields() {
        return List.of(
                new CredentialField(ADVERTISER_ID, "광고계정 ID(광고주 ID)", false, "예: 123456",
                        "당근 전문가모드 광고 관리 화면에서 확인하는 숫자 ID"),
                new CredentialField(API_KEY, "OpenAPI 키", true, "발급받은 키를 붙여넣기",
                        "전문가모드 › 고객센터 › 온라인 문의 › [광고 도구 및 전환] › [OpenAPI 키 발급]"));
    }

    @Override
    public Map<String, String> normalizeCredentials(Map<String, String> input) {
        String apiKey = trim(input == null ? null : input.get(API_KEY));
        String advertiserId = trim(input == null ? null : input.get(ADVERTISER_ID));
        if (apiKey == null || apiKey.length() < 8 || apiKey.length() > 500) {
            throw new InvalidSubmissionException("당근 OpenAPI 키를 확인해주세요.");
        }
        if (advertiserId == null || !advertiserId.matches("\\d{1,19}")) {
            throw new InvalidSubmissionException("광고계정 ID(광고주 ID)는 숫자만 입력해주세요.");
        }
        Map<String, String> out = new LinkedHashMap<>();
        out.put(API_KEY, apiKey);
        out.put(ADVERTISER_ID, advertiserId);
        return out;
    }

    @Override
    public String credentialsHint(Map<String, String> credentials) {
        String key = credentials.getOrDefault(API_KEY, "");
        String tail = key.length() > 4 ? key.substring(key.length() - 4) : "";
        return "광고계정 " + credentials.getOrDefault(ADVERTISER_ID, "?") + " · 키 …" + tail;
    }

    @Override
    public List<AdAccount> listAccounts(Map<String, String> credentials) {
        // 키 1개 = 광고계정 1개라 '목록'은 늘 1개다. 캠페인 1건 조회로 키가 살아 있는지 확인한다.
        get(credentials, "/v1/campaigns?pageNumber=1&pageSize=1");
        String id = credentials.get(ADVERTISER_ID);
        return List.of(new AdAccount(id, "당근 광고계정 " + id));
    }

    @Override
    public List<AdCampaign> listCampaigns(Map<String, String> credentials, String accountId) {
        checkAccount(credentials, accountId);
        List<AdCampaign> out = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = get(credentials, "/v1/campaigns?pageNumber=" + page + "&pageSize=" + PAGE_SIZE
                    + "&liveStatuses=ON&liveStatuses=OFF");
            JsonNode list = body.path("campaigns");
            for (int i = 0; i < list.size(); i++) {
                out.add(toCampaign(list.get(i)));
            }
            int totalPages = body.path("pagination").path("totalPageCount").asInt(1);
            if (list.size() < PAGE_SIZE || page >= totalPages) {
                break;
            }
        }
        return out;
    }

    @Override
    public void setCampaignActive(Map<String, String> credentials, String accountId, String campaignId,
            boolean active) {
        checkAccount(credentials, accountId);
        if (campaignId == null || !campaignId.matches("[A-Za-z0-9_-]{1,64}")) {
            throw new AdPlatformException(Kind.NOT_FOUND, "캠페인 ID 가 올바르지 않습니다.");
        }
        String path = "/v1/campaigns/" + URLEncoder.encode(campaignId, StandardCharsets.UTF_8)
                + (active ? "/resume" : "/pause");
        send(credentials, HttpRequest.newBuilder(URI.create(baseUrl + path))
                .POST(HttpRequest.BodyPublishers.noBody()));
    }

    // ---------- 내부 ----------

    static AdCampaign toCampaign(JsonNode c) {
        String liveStatus = c.path("liveStatus").asString("");
        String status = c.path("status").asString("");
        boolean search = "Search".equals(c.path("type").asString(""));
        return new AdCampaign(
                c.path("id").asString(""),
                c.path("title").asString("(이름 없음)"),
                "ON".equals(liveStatus),
                statusLabel(liveStatus, status) + (search ? " · 검색광고(조회 전용)" : ""),
                search);
    }

    private static String statusLabel(String liveStatus, String status) {
        if ("OFF".equals(liveStatus)) {
            return "꺼짐";
        }
        return switch (status) {
            case "NORMAL" -> "운영 중";
            case "BUDGET_EXCEEDED" -> "켜짐 · 예산 소진";
            case "UNAVAILABLE" -> "켜짐 · 운영 불가";
            case "OFF" -> "꺼짐";
            default -> "켜짐";
        };
    }

    private void checkAccount(Map<String, String> credentials, String accountId) {
        if (accountId == null || !accountId.equals(credentials.get(ADVERTISER_ID))) {
            throw new AdPlatformException(Kind.NOT_FOUND, "이 연결로 접근할 수 없는 광고계정입니다.");
        }
    }

    private JsonNode get(Map<String, String> credentials, String pathAndQuery) {
        String body = send(credentials, HttpRequest.newBuilder(URI.create(baseUrl + pathAndQuery)).GET());
        try {
            return json.readTree(body == null || body.isBlank() ? "{}" : body);
        } catch (RuntimeException e) {
            throw new AdPlatformException(Kind.OTHER, "당근 응답을 해석하지 못했습니다.", e);
        }
    }

    private String send(Map<String, String> credentials, HttpRequest.Builder builder) {
        HttpRequest req = builder
                .timeout(Duration.ofSeconds(10))
                .header("X-API-KEY", credentials.getOrDefault(API_KEY, ""))
                .header("X-ADVERTISER-ID", credentials.getOrDefault(ADVERTISER_ID, ""))
                .header("Accept", "application/json")
                .build();
        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            throw new AdPlatformException(Kind.TEMPORARY, "당근 응답 시간이 초과됐습니다.", e);
        } catch (IOException e) {
            throw new AdPlatformException(Kind.TEMPORARY, "당근에 연결하지 못했습니다.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AdPlatformException(Kind.TEMPORARY, "당근 호출이 중단됐습니다.", e);
        }
        int code = res.statusCode();
        if (code / 100 == 2) {
            return res.body();
        }
        throw toError(code, res.body());
    }

    static AdPlatformException toError(int code, String body) {
        String detail = cut(body, 200);
        return switch (code) {
            case 401, 403 -> new AdPlatformException(Kind.AUTH_INVALID,
                    "당근이 키를 거절했습니다(키 재발급·광고계정 ID 확인 필요). HTTP " + code);
            case 404 -> new AdPlatformException(Kind.NOT_FOUND, "당근에서 대상을 찾지 못했습니다. HTTP 404");
            case 429 -> new AdPlatformException(Kind.RATE_LIMITED, "당근 호출 한도(분당 60회)를 넘었습니다. 잠시 뒤 다시 시도해주세요.");
            default -> code >= 500
                    ? new AdPlatformException(Kind.TEMPORARY, "당근 서버 오류 HTTP " + code)
                    : new AdPlatformException(Kind.OTHER, "당근이 요청을 거절했습니다. HTTP " + code
                            + (detail.isEmpty() ? "" : " · " + detail));
        };
    }

    private static String trim(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return "";
        }
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }
}
