package com.leadpot.integration;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import com.google.api.services.sheets.v4.model.AppendDimensionRequest;
import com.google.api.services.sheets.v4.model.BatchUpdateSpreadsheetRequest;
import com.google.api.services.sheets.v4.model.BatchUpdateValuesRequest;
import com.google.api.services.sheets.v4.model.Request;
import com.google.api.services.sheets.v4.model.Sheet;
import com.google.api.services.sheets.v4.model.SheetProperties;
import com.google.api.services.sheets.v4.model.Spreadsheet;
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
 * <p><b>열은 헤더 이름으로 맞춘다(2026-08-12).</b> 예전엔 {@code values.append} 로 표 끝에 행을
 * 덧붙였는데, Sheets API 의 append 는 <b>감지한 표의 첫 열부터</b> 쓴다. 그래서 사용자가 시트
 * 왼쪽에 자기 열(예: {@code no})을 하나 삽입하면 그때부터 모든 신규 리드가 한 칸씩 밀려 들어갔다
 * (실제 사고 2026-08-12: 연락처가 이름 칸에 들어가고 연락처 칸이 비었다).
 * 지금은 1행을 읽어 {@code 헤더명 → 열} 로 맞춘 뒤 <b>그 열에만</b> 쓴다 —
 * 사용자가 손으로 관리하는 열({@code no}·{@code 특이사항}·{@code 1차콜} 등)은 건드리지 않고,
 * 열을 삽입하거나 순서를 바꿔도 깨지지 않는다.
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

    /** 행/열이 꽉 찬 시트에 쓰려 할 때 구글이 주는 오류. 넓히고 한 번 더 시도한다. */
    private static final String GRID_LIMIT = "exceeds grid limits";

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
     * 시트 맨 아래에 한 행을 쓴다. 성공하면 {@code null}, 실패하면 사람이 읽을 수 있는 사유를 돌려준다
     * (호출부가 그대로 알림 로그·테스트 결과에 넣는다).
     *
     * <p>{@code header} 와 {@code row} 는 <b>같은 길이의 짝</b>이다 — {@code header[i]} 는
     * {@code row[i]} 가 어느 열로 가야 하는지 알려주는 이름이다. 시트 1행에 그 이름이 있으면
     * 그 열에 쓰고, 없으면(새로 생긴 문항) 헤더 오른쪽 끝에 열을 만들어 쓴다.
     * 시트가 완전히 비어 있으면 {@code header} 를 첫 행으로 먼저 깐다.
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
        if (row == null || row.isEmpty()) {
            return "시트에 쓸 값이 비어 있습니다.";
        }
        List<Object> labels = header == null ? List.of() : header;
        if (labels.size() != row.size()) {
            // 호출부 버그. 이름이 없는 값은 헤더 오른쪽에 새 열로 빠지므로 조용히 넘기지 않고 남긴다.
            log.warn("시트 헤더와 값의 개수가 다릅니다(header={}, row={}) — 열이 어긋날 수 있습니다.",
                    labels.size(), row.size());
        }
        try {
            Sheets sheets = client();
            Grid grid = readGrid(sheets, id, tabName);

            // 빈 시트면 예전처럼 헤더를 첫 행으로 깔고 그 아래부터 쓴다.
            boolean writeHeader = grid.lastRow() == 0 && !labels.isEmpty();
            List<Object> sheetHeader = writeHeader ? labels : grid.header();
            Layout layout = plan(sheetHeader, labels, row.size());
            int targetRow = writeHeader ? 2 : grid.lastRow() + 1;

            List<ValueRange> data = new ArrayList<>();
            if (writeHeader) {
                data.add(cells(tabName, 1, 0, sheetHeader));
            }
            data.addAll(layout.writes(tabName, targetRow, row));

            try {
                write(sheets, id, data);
            } catch (GoogleJsonResponseException e) {
                if (!isGridLimit(e)) {
                    throw e;
                }
                // 행(기본 1000)이나 열(기본 26)이 꽉 찬 시트 — 부족한 만큼 넓히고 한 번만 다시.
                grow(sheets, id, tabName, targetRow, layout.width());
                write(sheets, id, data);
            }
            return null;
        } catch (GoogleJsonResponseException e) {
            return explain(e, tabName);
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    // ---------- 열 맞추기(순수 로직 — 네트워크 없이 테스트한다) ----------

    /**
     * 값이 들어갈 자리.
     *
     * @param columns      값 i 가 들어갈 열(0-based)
     * @param addedHeaders 시트 1행에 없어서 새로 만드는 열의 이름들
     * @param addedStart   그 새 열들이 시작하는 열(0-based)
     */
    record Layout(int[] columns, List<Object> addedHeaders, int addedStart) {

        /** 이 배치가 닿는 맨 오른쪽 열 +1 (= 필요한 시트 열 개수). */
        int width() {
            int max = addedStart + addedHeaders.size();
            for (int c : columns) {
                max = Math.max(max, c + 1);
            }
            return max;
        }

        /**
         * 실제로 보낼 쓰기 목록. 붙어 있는 열은 한 범위로 묶고, 우리 열이 아닌 칸은
         * 범위에서 빼서 <b>사용자가 손으로 채운 열을 절대 덮지 않는다</b>.
         */
        List<ValueRange> writes(String tabName, int rowNumber, List<Object> row) {
            List<ValueRange> out = new ArrayList<>();
            if (!addedHeaders.isEmpty()) {
                out.add(cells(tabName, 1, addedStart, addedHeaders));
            }
            List<Integer> order = new ArrayList<>();
            for (int i = 0; i < columns.length; i++) {
                order.add(i);
            }
            order.sort(Comparator.comparingInt(i -> columns[i]));

            int start = 0;
            while (start < order.size()) {
                int end = start;
                while (end + 1 < order.size()
                        && columns[order.get(end + 1)] == columns[order.get(end)] + 1) {
                    end++;
                }
                List<Object> run = new ArrayList<>();
                for (int k = start; k <= end; k++) {
                    run.add(row.get(order.get(k)));
                }
                out.add(cells(tabName, rowNumber, columns[order.get(start)], run));
                start = end + 1;
            }
            return out;
        }
    }

    /**
     * 시트 1행({@code sheetHeader})에 우리 이름({@code labels})을 맞춘다.
     * 이름이 있으면 그 열, 없으면 헤더 오른쪽 끝에 새 열. 한 열에 두 값이 겹치지 않게 한다.
     */
    static Layout plan(List<Object> sheetHeader, List<Object> labels, int valueCount) {
        Map<String, Integer> byLabel = new LinkedHashMap<>();
        int width = sheetHeader == null ? 0 : sheetHeader.size();
        for (int i = 0; i < width; i++) {
            String name = text(sheetHeader.get(i));
            if (!name.isBlank()) {
                byLabel.putIfAbsent(name, i);
            }
        }
        int[] columns = new int[valueCount];
        Set<Integer> used = new HashSet<>();
        List<Object> added = new ArrayList<>();
        int next = width;
        for (int i = 0; i < valueCount; i++) {
            String name = labels == null || i >= labels.size() ? "" : text(labels.get(i));
            Integer at = name.isBlank() ? null : byLabel.get(name);
            if (at == null || !used.add(at)) {
                at = next++;
                used.add(at);
                added.add(name);
            }
            columns[i] = at;
        }
        return new Layout(columns, added, width);
    }

    /** {@code 0 → A}, {@code 25 → Z}, {@code 26 → AA}. */
    static String columnLetter(int index) {
        StringBuilder sb = new StringBuilder();
        for (int n = index; n >= 0; n = n / 26 - 1) {
            sb.insert(0, (char) ('A' + n % 26));
        }
        return sb.toString();
    }

    // ---------- 내부 ----------

    /** 시트 1행과 마지막 데이터 행. */
    private record Grid(List<Object> header, int lastRow) {
    }

    /**
     * 1행(헤더)과 마지막 데이터 행을 <b>한 번의 호출로</b> 읽는다.
     * {@code values.get} 은 뒤쪽 빈 행·빈 칸을 잘라서 주므로 {@code A:ZZ} 로 넓게 물어도
     * 실제 데이터만큼만 내려온다 — 응답 크기는 시트에 쌓인 행 수에 비례한다.
     */
    private Grid readGrid(Sheets sheets, String id, String tabName) throws Exception {
        ValueRange r = sheets.spreadsheets().values().get(id, range(tabName, "A:ZZ")).execute();
        List<List<Object>> values = r.getValues();
        if (values == null || values.isEmpty()) {
            return new Grid(List.of(), 0);
        }
        return new Grid(values.get(0), values.size());
    }

    private void write(Sheets sheets, String id, List<ValueRange> data) throws Exception {
        sheets.spreadsheets().values()
                .batchUpdate(id, new BatchUpdateValuesRequest()
                        // USER_ENTERED: 날짜·숫자를 시트가 알아보게 넣는다(정렬·필터가 먹는다).
                        .setValueInputOption("USER_ENTERED")
                        .setData(data))
                .execute();
    }

    /** 한 행짜리 쓰기 범위. 끝 열까지 명시해서 범위가 애매해질 여지를 없앤다. */
    private static ValueRange cells(String tabName, int rowNumber, int startColumn, List<Object> values) {
        String from = columnLetter(startColumn) + rowNumber;
        String to = columnLetter(startColumn + values.size() - 1) + rowNumber;
        return new ValueRange()
                .setRange(range(tabName, from + ":" + to))
                .setValues(List.of(values));
    }

    /** 탭 이름이 있으면 {@code '탭'!A1} 형태로. 이름 안의 작은따옴표는 두 번 써서 escape 한다. */
    private static String range(String tabName, String cells) {
        if (tabName == null || tabName.isBlank()) {
            return cells; // 범위에 탭을 안 적으면 맨 앞 탭
        }
        return "'" + tabName.trim().replace("'", "''") + "'!" + cells;
    }

    private static boolean isGridLimit(GoogleJsonResponseException e) {
        if (e.getStatusCode() != 400) {
            return false;
        }
        String detail = e.getDetails() == null ? e.getMessage() : e.getDetails().getMessage();
        return detail != null && detail.toLowerCase().contains(GRID_LIMIT);
    }

    /** 시트의 행·열이 부족하면 부족한 만큼(+행은 여유분) 넓힌다. */
    private void grow(Sheets sheets, String id, String tabName, int neededRows, int neededColumns)
            throws Exception {
        Spreadsheet meta = sheets.spreadsheets().get(id)
                .setFields("sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))")
                .execute();
        SheetProperties props = tabProperties(meta, tabName);
        if (props == null || props.getGridProperties() == null) {
            return;
        }
        Integer rows = props.getGridProperties().getRowCount();
        Integer columns = props.getGridProperties().getColumnCount();
        List<Request> requests = new ArrayList<>();
        if (rows != null && neededRows > rows) {
            // 여유분을 함께 붙인다 — 꽉 찬 시트에 리드마다 한 행씩 늘리면 호출이 낭비된다.
            requests.add(appendDimension(props.getSheetId(), "ROWS", neededRows - rows + 200));
        }
        if (columns != null && neededColumns > columns) {
            requests.add(appendDimension(props.getSheetId(), "COLUMNS", neededColumns - columns));
        }
        if (requests.isEmpty()) {
            return;
        }
        sheets.spreadsheets()
                .batchUpdate(id, new BatchUpdateSpreadsheetRequest().setRequests(requests))
                .execute();
    }

    private static Request appendDimension(Integer sheetId, String dimension, int length) {
        return new Request().setAppendDimension(new AppendDimensionRequest()
                .setSheetId(sheetId)
                .setDimension(dimension)
                .setLength(length));
    }

    /** 탭 이름으로 시트 속성 찾기. 이름이 비면 맨 앞 탭(range() 와 같은 규칙). */
    private static SheetProperties tabProperties(Spreadsheet meta, String tabName) {
        List<Sheet> sheets = meta.getSheets();
        if (sheets == null || sheets.isEmpty()) {
            return null;
        }
        if (tabName == null || tabName.isBlank()) {
            return sheets.get(0).getProperties();
        }
        String want = tabName.trim();
        for (Sheet s : sheets) {
            if (s.getProperties() != null && want.equals(s.getProperties().getTitle())) {
                return s.getProperties();
            }
        }
        return null;
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

    private static String text(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static String cut(String s) {
        if (s == null) {
            return "";
        }
        return s.length() <= 200 ? s : s.substring(0, 200) + "…";
    }
}
