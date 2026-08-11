package com.leadpot.integration;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import com.google.api.services.sheets.v4.model.ValueRange;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;

/**
 * 구글시트 쓰기 — <b>서비스 계정</b>으로 Sheets API 를 직접 호출한다.
 *
 * <p>예전 방식(Apps Script 웹앱 웹훅)은 광고주 시트마다 스크립트를 심고 배포해야 했고,
 * 웹앱이 <b>배포한 사람의 구글 권한으로</b> 실행돼 그 사람이 시트 공유에서 빠지는 순간
 * 조용히 끊겼다. 서비스 계정은 사람 계정과 분리돼 있어 그 문제가 없다 —
 * 광고주는 <b>서비스 계정 이메일을 시트 편집자로 추가</b>하기만 하면 된다.
 *
 * <p>키({@code GOOGLE_SHEETS_CREDENTIALS})가 없으면 이 빈은 '미설정' 상태로 살아 있고
 * 시트 전송만 건너뛴다 — 로컬 개발이나 키 발급 전에도 서버는 정상 기동해야 하기 때문이다.
 */
@Component
public class GoogleSheetsClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetsClient.class);

    /** 구글시트 URL 에서 시트 ID 만 뽑는다. {@code .../spreadsheets/d/<ID>/edit#gid=0} */
    private static final Pattern SHEET_URL_ID = Pattern.compile("/spreadsheets/d/([a-zA-Z0-9-_]+)");

    /** 시트 ID 자체의 생김새(URL 이 아니라 ID 를 그대로 붙여넣은 경우). */
    private static final Pattern BARE_ID = Pattern.compile("^[a-zA-Z0-9-_]{20,}$");

    private final String credentialsRaw;
    /** 인증은 한 번만 만들어 재사용한다(매 리드마다 토큰을 새로 받으면 느리다). */
    private volatile Sheets cached;
    private volatile String serviceAccountEmail = "";

    public GoogleSheetsClient(@Value("${app.google.sheets-credentials:}") String credentialsRaw) {
        this.credentialsRaw = credentialsRaw == null ? "" : credentialsRaw.trim();
    }

    /** 서비스 계정 키가 설정돼 있는지. 미설정이면 시트 전송을 아예 시도하지 않는다. */
    public boolean isConfigured() {
        return !credentialsRaw.isBlank();
    }

    /**
     * 광고주에게 "이 이메일을 편집자로 추가하세요" 라고 안내할 주소.
     * 키가 없거나 깨졌으면 빈 문자열.
     */
    public String serviceAccountEmail() {
        if (!isConfigured()) {
            return "";
        }
        if (serviceAccountEmail.isEmpty()) {
            try {
                client(); // 부수효과로 이메일을 채운다
            } catch (Exception e) {
                log.warn("구글 서비스 계정 키를 읽지 못했습니다: {}", e.toString());
            }
        }
        return serviceAccountEmail;
    }

    /**
     * 시트에 한 행을 덧붙인다. 성공하면 {@code null}, 실패하면 사람이 읽을 수 있는 사유를 돌려준다
     * (호출부가 그대로 알림 로그·테스트 결과에 넣는다).
     *
     * <p>{@code header} 는 <b>시트가 비어 있을 때만</b> 첫 행으로 먼저 넣는다 —
     * 예전 Apps Script 와 같은 동작이다(사용자 확정 2026-08-11).
     *
     * @param spreadsheetIdOrUrl 시트 ID 또는 시트 URL(둘 다 받는다)
     * @param tabName            탭(시트) 이름. 비우면 맨 앞 탭.
     */
    public String appendRow(String spreadsheetIdOrUrl, String tabName, List<Object> header, List<Object> row) {
        if (!isConfigured()) {
            return "서버에 구글 서비스 계정 키가 설정되지 않았습니다(GOOGLE_SHEETS_CREDENTIALS).";
        }
        String id = extractSpreadsheetId(spreadsheetIdOrUrl);
        if (id == null) {
            return "시트 ID 를 알아볼 수 없습니다: " + cut(spreadsheetIdOrUrl);
        }
        try {
            Sheets sheets = client();
            if (isEmptySheet(sheets, id, tabName) && header != null && !header.isEmpty()) {
                append(sheets, id, tabName, header);
            }
            append(sheets, id, tabName, row);
            return null;
        } catch (GoogleJsonResponseException e) {
            return explain(e, tabName);
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    // ---------- 내부 ----------

    /** 첫 칸(A1)이 비어 있으면 '아직 아무것도 안 쓴 시트'로 본다(예전 Apps Script 의 getLastRow()===0 자리). */
    private boolean isEmptySheet(Sheets sheets, String id, String tabName) throws Exception {
        ValueRange r = sheets.spreadsheets().values().get(id, range(tabName, "A1:A1")).execute();
        List<List<Object>> values = r.getValues();
        return values == null || values.isEmpty() || values.get(0).isEmpty()
                || String.valueOf(values.get(0).get(0)).isBlank();
    }

    private void append(Sheets sheets, String id, String tabName, List<Object> values) throws Exception {
        sheets.spreadsheets().values()
                .append(id, range(tabName, "A1"), new ValueRange().setValues(List.of(values)))
                // USER_ENTERED: 날짜·숫자를 시트가 알아보게 넣는다(정렬·필터가 먹는다).
                .setValueInputOption("USER_ENTERED")
                .setInsertDataOption("INSERT_ROWS")
                .execute();
    }

    /** 탭 이름이 있으면 {@code '탭'!A1} 형태로. 이름 안의 작은따옴표는 두 번 써서 escape 한다. */
    private static String range(String tabName, String cells) {
        if (tabName == null || tabName.isBlank()) {
            return cells; // 범위에 탭을 안 적으면 맨 앞 탭
        }
        return "'" + tabName.trim().replace("'", "''") + "'!" + cells;
    }

    private Sheets client() throws Exception {
        Sheets local = cached;
        if (local != null) {
            return local;
        }
        synchronized (this) {
            if (cached == null) {
                GoogleCredentials creds = GoogleCredentials
                        .fromStream(new ByteArrayInputStream(decodeKey()))
                        .createScoped(List.of(SheetsScopes.SPREADSHEETS));
                if (creds instanceof ServiceAccountCredentials sa) {
                    serviceAccountEmail = sa.getClientEmail();
                }
                cached = new Sheets.Builder(
                        GoogleNetHttpTransport.newTrustedTransport(),
                        GsonFactory.getDefaultInstance(),
                        new HttpCredentialsAdapter(creds))
                        .setApplicationName("Leadpot")
                        .build();
            }
            return cached;
        }
    }

    /**
     * 키는 <b>원본 JSON</b> 이든 <b>base64</b> 든 받는다.
     * JSON 은 줄바꿈이 들어 있어 {@code .env} 한 줄에 넣기 까다로워서 base64 를 권장한다.
     */
    private byte[] decodeKey() {
        if (credentialsRaw.startsWith("{")) {
            return credentialsRaw.getBytes(StandardCharsets.UTF_8);
        }
        return Base64.getDecoder().decode(credentialsRaw.replaceAll("\\s", ""));
    }

    /** 구글이 준 오류를 광고주 연동에서 실제로 자주 나는 원인으로 바꿔준다. */
    private static String explain(GoogleJsonResponseException e, String tabName) {
        String detail = e.getDetails() == null ? e.getMessage() : e.getDetails().getMessage();
        return switch (e.getStatusCode()) {
            case 403 -> "시트 접근 권한이 없습니다 — 시트 공유에서 서비스 계정 이메일을 '편집자'로 추가했는지 확인하세요. (" + cut(detail) + ")";
            case 404 -> "그 시트를 찾을 수 없습니다 — 시트 URL/ID 를 확인하세요. (" + cut(detail) + ")";
            case 400 -> "요청이 거부됐습니다 — 탭 이름"
                    + (tabName == null || tabName.isBlank() ? "(맨 앞 탭)" : " '" + tabName + "'")
                    + " 이 실제로 있는지 확인하세요. (" + cut(detail) + ")";
            case 429 -> "구글 API 호출 한도를 넘었습니다. 잠시 후 다시 시도하세요.";
            default -> "HTTP " + e.getStatusCode() + " " + cut(detail);
        };
    }

    /**
     * 시트 URL 이든 ID 든 ID 만 뽑아낸다. 알아볼 수 없으면 {@code null}.
     * (사용자가 주소창을 통째로 붙여넣는 일이 흔하다.)
     */
    public static String extractSpreadsheetId(String input) {
        if (input == null) {
            return null;
        }
        String s = input.trim();
        if (s.isEmpty()) {
            return null;
        }
        Matcher m = SHEET_URL_ID.matcher(s);
        if (m.find()) {
            return m.group(1);
        }
        return BARE_ID.matcher(s).matches() ? s : null;
    }

    private static String cut(String s) {
        if (s == null) {
            return "";
        }
        return s.length() <= 200 ? s : s.substring(0, 200) + "…";
    }
}
