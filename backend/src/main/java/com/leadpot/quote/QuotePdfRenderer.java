package com.leadpot.quote;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.leadpot.quote.dto.QuoteParty;
import com.leadpot.quote.dto.QuoteResponse;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;

/**
 * 견적서 PDF — 서버에서 만들어 항상 같은 모양으로 나온다(사용자 결정 2026-10-29: 브라우저 인쇄가 아니라 서버 생성).
 * <p>
 * XHTML 을 그려 openhtmltopdf 로 변환한다. 한글은 번들한 나눔고딕(OFL, 한자를 뺀 부분집합 —
 * {@code resources/fonts/README.md})을 임베드한다. 서버에 한글 폰트가 없어도 깨지지 않게 하려고.
 */
@Component
public class QuotePdfRenderer {

    private static final String FONT = "NanumGothic";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy. MM. dd.");

    private final byte[] regular = load("/fonts/NanumGothic-Regular.ttf");
    private final byte[] bold = load("/fonts/NanumGothic-Bold.ttf");

    public byte[] render(QuoteResponse q) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder b = new PdfRendererBuilder();
            b.useFastMode();
            b.useFont(() -> new ByteArrayInputStream(regular), FONT, 400, FontStyle.NORMAL, true);
            b.useFont(() -> new ByteArrayInputStream(bold), FONT, 700, FontStyle.NORMAL, true);
            b.withHtmlContent(html(q), null);
            b.toStream(out);
            b.run();
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("견적서 PDF 생성 실패", e);
        }
    }

    String html(QuoteResponse q) {
        QuoteParty to = q.recipient();
        QuoteParty from = q.supplier();
        boolean included = q.vatMode() == VatMode.INCLUDED;
        StringBuilder h = new StringBuilder(8_000);
        h.append("<html><head><meta charset=\"UTF-8\"/><style>").append(CSS).append("</style></head><body>");

        h.append("<h1>견 적 서</h1>");

        // 머리: 왼쪽 = 받는 쪽·견적 정보, 오른쪽 = 공급자
        h.append("<table class=\"head\"><tr><td class=\"head-l\">");
        h.append("<p class=\"to\"><b>").append(esc(to.companyName())).append("</b> 귀하</p>");
        h.append("<table class=\"kv\">");
        kv(h, "견적번호", q.quoteNo());
        kv(h, "건명", q.title());
        kv(h, "견적일", date(q.issueDate()));
        if (q.validUntil() != null) {
            kv(h, "유효기간", date(q.validUntil()) + " 까지");
        }
        kv(h, "담당자", to.contactName());
        kv(h, "연락처", to.phone());
        kv(h, "이메일", to.email());
        h.append("</table><p class=\"lead\">아래와 같이 견적합니다.</p></td>");

        h.append("<td class=\"head-r\"><table class=\"supplier\"><tr><th class=\"sv\" rowspan=\"6\">공<br/>급<br/>자</th>");
        h.append("<th>상호</th><td>").append(esc(from.companyName())).append("</td></tr>");
        supplierRow(h, "대표자", from.ceoName());
        supplierRow(h, "사업자번호", from.bizNo());
        supplierRow(h, "주소", from.address());
        supplierRow(h, "연락처", from.phone());
        supplierRow(h, "이메일", from.email());
        h.append("</table></td></tr></table>");

        // 총액 띠
        h.append("<table class=\"sum\"><tr><th>합계금액</th><td><b>일금 ")
                .append(esc(q.grandTotalHangul())).append("원정</b> (₩").append(won(q.grandTotal())).append(")")
                .append("<span class=\"vat\">").append(vatLabel(q.vatMode())).append("</span></td></tr></table>");

        // 품목 표
        h.append("<table class=\"items\"><thead><tr><th class=\"no\">No</th><th>품목</th><th>설명</th>")
                .append("<th class=\"n\">수량</th><th class=\"n\">단가</th><th class=\"n\">")
                .append(included ? "금액(VAT 포함)" : "공급가액").append("</th><th>비고</th></tr></thead><tbody>");
        int no = 1;
        for (QuoteResponse.Line l : q.items()) {
            h.append("<tr><td class=\"no\">").append(no++).append("</td><td>").append(esc(l.name()))
                    .append("</td><td>").append(esc(l.description())).append("</td><td class=\"n\">")
                    .append(won(l.quantity())).append("</td><td class=\"n\">").append(won(l.unitPrice()))
                    .append("</td><td class=\"n\">").append(won(l.amount())).append("</td><td>")
                    .append(esc(l.note())).append("</td></tr>");
        }
        h.append("</tbody></table>");

        h.append("<table class=\"totals\">");
        totalRow(h, "공급가액", q.supplyTotal(), false);
        totalRow(h, q.vatMode() == VatMode.EXEMPT ? "부가세 (면세)" : "부가세", q.vatTotal(), false);
        totalRow(h, "총액", q.grandTotal(), true);
        h.append("</table>");

        if (q.notes() != null && !q.notes().isEmpty()) {
            h.append("<div class=\"notes\"><p class=\"notes-t\">안내 사항</p><ol>");
            for (String n : q.notes()) {
                h.append("<li>").append(esc(n)).append("</li>");
            }
            h.append("</ol></div>");
        }
        if (!from.bankAccount().isBlank()) {
            h.append("<p class=\"bank\">입금 계좌: <b>").append(esc(from.bankAccount())).append("</b></p>");
        }
        h.append("</body></html>");
        return h.toString();
    }

    private static void kv(StringBuilder h, String k, String v) {
        if (v == null || v.isBlank()) {
            return;
        }
        h.append("<tr><th>").append(esc(k)).append("</th><td>").append(esc(v)).append("</td></tr>");
    }

    private static void supplierRow(StringBuilder h, String k, String v) {
        h.append("<tr><th>").append(esc(k)).append("</th><td>").append(esc(v)).append("</td></tr>");
    }

    private static void totalRow(StringBuilder h, String label, long amount, boolean strong) {
        h.append("<tr").append(strong ? " class=\"grand\"" : "").append("><th>").append(esc(label))
                .append("</th><td>").append(won(amount)).append("원</td></tr>");
    }

    private static String vatLabel(VatMode m) {
        return switch (m) {
            case EXCLUDED -> "부가세 포함 (공급가액 + 부가세 10%)";
            case INCLUDED -> "부가세 포함 금액";
            case EXEMPT -> "면세";
        };
    }

    private static String date(LocalDate d) {
        return d == null ? "" : d.format(DATE);
    }

    private static String won(long v) {
        return NumberFormat.getNumberInstance(Locale.KOREA).format(v);
    }

    /** XHTML 이스케이프 — 사용자가 넣은 값은 전부 여기를 거친다. */
    static String esc(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> {
                    // XML 1.0 에서 허용되지 않는 제어문자는 버린다(파서가 실패한다).
                    if (c >= 0x20 || c == '\t' || c == '\n' || c == '\r') {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }

    private static byte[] load(String path) {
        try (InputStream in = QuotePdfRenderer.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("폰트 파일이 없습니다: " + path);
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static final String CSS = """
            @page { size: A4; margin: 16mm 14mm 18mm; }
            body { font-family: 'NanumGothic'; font-size: 9.5pt; color: #1f2329; line-height: 1.45; }
            h1 { text-align: center; font-size: 24pt; font-weight: 700; letter-spacing: 6pt; margin: 0 0 7mm; }
            table { border-collapse: collapse; width: 100%; }
            .head td.head-l { width: 50%; vertical-align: top; padding-right: 5mm; }
            .head td.head-r { width: 50%; vertical-align: top; }
            .to { font-size: 13pt; margin: 0 0 3mm; border-bottom: 1.2pt solid #1f2329; padding-bottom: 1.5mm; }
            .kv th { text-align: left; font-weight: 400; color: #6b7280; width: 20mm; padding: 0.6mm 0; }
            .kv td { padding: 0.6mm 0; }
            .lead { margin: 3mm 0 0; color: #374151; }
            .supplier th, .supplier td { border: 0.6pt solid #9ca3af; padding: 1.4mm 2mm; font-size: 9pt; }
            .supplier th { background: #f3f4f6; font-weight: 700; width: 20mm; text-align: center; }
            .supplier th.sv { width: 7mm; padding: 1mm; line-height: 1.9; }
            .sum { margin: 6mm 0 4mm; }
            .sum th, .sum td { border: 1.2pt solid #1f2329; padding: 2.4mm 3mm; font-size: 11pt; }
            .sum th { background: #f3f4f6; width: 28mm; }
            .sum .vat { float: right; font-size: 8.5pt; color: #6b7280; padding-top: 0.8mm; }
            .items th, .items td { border: 0.6pt solid #9ca3af; padding: 1.8mm 2mm; }
            .items thead th { background: #f3f4f6; font-weight: 700; text-align: center; }
            .items .no { width: 8mm; text-align: center; }
            .items .n { text-align: right; white-space: nowrap; }
            .totals { width: 70mm; margin: 3mm 0 0 auto; }
            .totals th, .totals td { border: 0.6pt solid #9ca3af; padding: 1.6mm 2.4mm; }
            .totals th { background: #f3f4f6; text-align: left; font-weight: 700; }
            .totals td { text-align: right; }
            .totals tr.grand th, .totals tr.grand td { font-size: 11pt; border-top: 1.2pt solid #1f2329; }
            .notes { margin-top: 7mm; }
            .notes-t { font-weight: 700; margin: 0 0 1.5mm; }
            .notes ol { margin: 0; padding-left: 5mm; color: #374151; }
            .notes li { margin-bottom: 0.8mm; }
            .bank { margin-top: 5mm; }
            """;
}
