package com.leadpot.lead;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import com.leadpot.common.error.InvalidSubmissionException;

/** 리드 일괄 처리용 엑셀(.xlsx)/CSV 양식 생성 + 업로드 파싱. */
@Service
public class LeadExcelService {

    /** 헤더(컬럼 라벨)만 있는 .xlsx 양식. */
    public byte[] templateXlsx(List<String> cols) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("리드양식");
            Row header = sheet.createRow(0);
            for (int i = 0; i < cols.size(); i++) {
                header.createCell(i).setCellValue(cols.get(i));
                sheet.setColumnWidth(i, 20 * 256);
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 헤더만 있는 CSV 양식(엑셀 호환 UTF-8 BOM). */
    public byte[] templateCsv(List<String> cols) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cols.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(csv(cols.get(i)));
        }
        sb.append("\r\n");
        byte[] bom = { (byte) 0xEF, (byte) 0xBB, (byte) 0xBF };
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }

    /** 업로드 파일 → 행 목록(헤더→값 맵). 확장자로 xlsx/csv 판별. */
    public List<Map<String, String>> parse(String filename, byte[] bytes) {
        String name = filename == null ? "" : filename.toLowerCase();
        if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
            return parseXlsx(bytes);
        }
        return parseCsv(bytes);
    }

    private List<Map<String, String>> parseXlsx(byte[] bytes) {
        List<Map<String, String>> rows = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet == null) {
                return rows;
            }
            DataFormatter fmt = new DataFormatter();
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                return rows;
            }
            List<String> headers = new ArrayList<>();
            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                headers.add(fmt.formatCellValue(headerRow.getCell(c)).trim());
            }
            for (int r = sheet.getFirstRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                Map<String, String> map = new LinkedHashMap<>();
                for (int c = 0; c < headers.size(); c++) {
                    String h = headers.get(c);
                    if (h.isEmpty()) {
                        continue;
                    }
                    map.put(h, fmt.formatCellValue(row.getCell(c)).trim());
                }
                rows.add(map);
            }
        } catch (IOException | RuntimeException e) {
            throw new InvalidSubmissionException("엑셀 파일을 읽을 수 없습니다. 양식(.xlsx)이 맞는지 확인해주세요.");
        }
        return rows;
    }

    private List<Map<String, String>> parseCsv(byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) {
            text = text.substring(1); // BOM 제거
        }
        List<List<String>> table = parseCsvText(text);
        List<Map<String, String>> rows = new ArrayList<>();
        if (table.isEmpty()) {
            return rows;
        }
        List<String> headers = table.get(0);
        for (int i = 1; i < table.size(); i++) {
            List<String> vals = table.get(i);
            Map<String, String> map = new LinkedHashMap<>();
            for (int c = 0; c < headers.size(); c++) {
                String h = headers.get(c).trim();
                if (h.isEmpty()) {
                    continue;
                }
                map.put(h, c < vals.size() ? vals.get(c) : "");
            }
            rows.add(map);
        }
        return rows;
    }

    /** 간단 CSV 파서(따옴표·콤마·개행 처리). */
    private List<List<String>> parseCsvText(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> cur = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(ch);
                }
            } else if (ch == '"') {
                inQuotes = true;
            } else if (ch == ',') {
                cur.add(field.toString());
                field.setLength(0);
            } else if (ch == '\n') {
                cur.add(field.toString());
                field.setLength(0);
                rows.add(cur);
                cur = new ArrayList<>();
            } else if (ch != '\r') {
                field.append(ch);
            }
        }
        if (field.length() > 0 || !cur.isEmpty()) {
            cur.add(field.toString());
            rows.add(cur);
        }
        rows.removeIf(r -> r.stream().allMatch(s -> s == null || s.trim().isEmpty()));
        return rows;
    }

    private static String csv(String v) {
        String s = v == null ? "" : v;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
