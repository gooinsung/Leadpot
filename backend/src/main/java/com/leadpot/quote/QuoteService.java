package com.leadpot.quote;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.account.BusinessProfileService;
import com.leadpot.account.dto.BusinessProfileDto;
import com.leadpot.advertiser.AdvertiserProfile;
import com.leadpot.advertiser.AdvertiserProfileService;
import com.leadpot.common.error.ConflictException;
import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.quote.dto.QuoteItem;
import com.leadpot.quote.dto.QuoteParty;
import com.leadpot.quote.dto.QuoteRequest;
import com.leadpot.quote.dto.QuoteResponse;
import com.leadpot.quote.dto.QuoteSummary;

/**
 * 견적서. 소유 마케터만(남의 것은 404).
 * <ul>
 * <li>작성중(DRAFT)만 고칠 수 있다. 저장할 때마다 공급자 칸을 마이페이지 사업장 정보로 새로 채운다.</li>
 * <li>발행(ISSUED)하면 그 시점 내용으로 잠긴다 — 고치려면 복제해서 새 번호로 낸다.</li>
 * <li>번호는 {@code Q-YYMM-NNN}(계정·월별 일련번호). 만들 때 붙인다.</li>
 * </ul>
 */
@Service
public class QuoteService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter NO_MONTH = DateTimeFormatter.ofPattern("yyMM");

    private final QuoteRepository repository;
    private final BusinessProfileService businessProfileService;
    private final AdvertiserProfileService advertiserProfileService;

    public QuoteService(QuoteRepository repository, BusinessProfileService businessProfileService,
            AdvertiserProfileService advertiserProfileService) {
        this.repository = repository;
        this.businessProfileService = businessProfileService;
        this.advertiserProfileService = advertiserProfileService;
    }

    @Transactional(readOnly = true)
    public List<QuoteSummary> list(Long ownerId, Long advertiserProfileId) {
        List<Quote> quotes = advertiserProfileId == null
                ? repository.findByOwnerIdOrderByIssueDateDescIdDesc(ownerId)
                : repository.findByOwnerIdAndAdvertiserProfileIdOrderByIssueDateDescIdDesc(ownerId, advertiserProfileId);
        return quotes.stream().map(QuoteSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public QuoteResponse get(Long ownerId, Long id) {
        return QuoteResponse.from(loadOwned(ownerId, id));
    }

    @Transactional
    public QuoteResponse create(Long ownerId, QuoteRequest req) {
        LocalDate issueDate = req.issueDate() != null ? req.issueDate() : today();
        Quote q = new Quote(ownerId, nextQuoteNo(ownerId, issueDate));
        apply(ownerId, q, req);
        repository.save(q);
        return QuoteResponse.from(q);
    }

    @Transactional
    public QuoteResponse update(Long ownerId, Long id, QuoteRequest req) {
        Quote q = loadOwned(ownerId, id);
        if (q.getStatus() != QuoteStatus.DRAFT) {
            throw new ConflictException("발행된 견적서는 고칠 수 없습니다. 복제해서 새로 만들어주세요.");
        }
        apply(ownerId, q, req);
        return QuoteResponse.from(q);
    }

    /** 발행 — 공급자 칸을 마지막으로 새로 채우고 잠근다. */
    @Transactional
    public QuoteResponse issue(Long ownerId, Long id) {
        Quote q = loadOwned(ownerId, id);
        if (q.getStatus() != QuoteStatus.DRAFT) {
            throw new ConflictException("이미 발행된 견적서입니다.");
        }
        boolean hasItem = q.getItems().stream().map(QuoteItem::fromMap).anyMatch(i -> !i.name().isBlank());
        if (!hasItem) {
            throw new InvalidSubmissionException("품목을 한 줄 이상 입력해야 발행할 수 있습니다.");
        }
        q.setSupplier(supplierSnapshot(ownerId));
        q.setStatus(QuoteStatus.ISSUED);
        q.setIssuedAt(Instant.now());
        return QuoteResponse.from(q);
    }

    /** 발행 뒤 상태(발행 · 수락 · 거절) 변경. 작성중으로는 되돌리지 않는다. */
    @Transactional
    public QuoteResponse changeStatus(Long ownerId, Long id, QuoteStatus status) {
        Quote q = loadOwned(ownerId, id);
        if (q.getStatus() == QuoteStatus.DRAFT || status == QuoteStatus.DRAFT) {
            throw new InvalidSubmissionException("작성중 견적서는 먼저 발행해주세요. 발행된 견적서는 작성중으로 되돌릴 수 없습니다.");
        }
        q.setStatus(status);
        return QuoteResponse.from(q);
    }

    /** 복제 — 같은 받는 쪽·품목·안내 문구로 오늘 날짜 새 작성중 견적서를 만든다(반복 발행의 핵심). */
    @Transactional
    public QuoteResponse duplicate(Long ownerId, Long id) {
        Quote src = loadOwned(ownerId, id);
        LocalDate today = today();
        Quote q = new Quote(ownerId, nextQuoteNo(ownerId, today));
        q.setAdvertiserProfileId(src.getAdvertiserProfileId());
        q.setTitle(src.getTitle());
        q.setIssueDate(today);
        q.setValidUntil(src.getValidUntil() == null ? null
                : today.plusDays(ChronoUnit.DAYS.between(src.getIssueDate(), src.getValidUntil())));
        q.setVatMode(src.getVatMode());
        q.setRecipient(src.getRecipient());
        q.setItems(new ArrayList<>(src.getItems()));
        q.setNotes(new ArrayList<>(src.getNotes()));
        q.setSupplier(supplierSnapshot(ownerId));
        q.setTotals(src.getSupplyTotal(), src.getVatTotal(), src.getGrandTotal());
        repository.save(q);
        return QuoteResponse.from(q);
    }

    /** 수동 입력 견적서의 받는 쪽을 광고주 정보로 저장하고 연결한다(광고주 관리에서도 보이게). */
    @Transactional
    public QuoteResponse saveAsAdvertiser(Long ownerId, Long id) {
        Quote q = loadOwned(ownerId, id);
        if (q.getAdvertiserProfileId() != null) {
            throw new ConflictException("이미 광고주에 연결된 견적서입니다.");
        }
        AdvertiserProfile p = advertiserProfileService.createFromParty(ownerId, QuoteParty.fromMap(q.getRecipient()));
        q.setAdvertiserProfileId(p.getId());
        return QuoteResponse.from(q);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        repository.delete(loadOwned(ownerId, id));
    }

    /** PDF 렌더링용 원본(소유 확인 포함). */
    @Transactional(readOnly = true)
    public QuoteResponse loadForPdf(Long ownerId, Long id) {
        return get(ownerId, id);
    }

    private void apply(Long ownerId, Quote q, QuoteRequest req) {
        QuoteParty recipient = req.recipient();
        if (recipient.companyName() == null || recipient.companyName().isBlank()) {
            throw new InvalidSubmissionException("받는 쪽 회사명을 입력해주세요.");
        }
        Long profileId = req.advertiserProfileId();
        if (profileId != null) {
            advertiserProfileService.loadOwned(ownerId, profileId); // 내 광고주인지 확인(아니면 404)
        } else if (req.saveAsAdvertiser()) {
            profileId = advertiserProfileService.createFromParty(ownerId, recipient).getId();
        }
        VatMode mode = req.vatMode() != null ? req.vatMode() : VatMode.EXCLUDED;
        List<QuoteItem> items = req.items() == null ? List.of() : req.items();
        LocalDate issueDate = req.issueDate() != null ? req.issueDate() : (q.getIssueDate() != null ? q.getIssueDate() : today());
        if (req.validUntil() != null && req.validUntil().isBefore(issueDate)) {
            throw new InvalidSubmissionException("유효기간은 견적일 이후여야 합니다.");
        }

        q.setAdvertiserProfileId(profileId);
        q.setTitle(req.title().trim());
        q.setIssueDate(issueDate);
        q.setValidUntil(req.validUntil());
        q.setVatMode(mode);
        q.setRecipient(recipient.toMap());
        q.setItems(items.stream().map(QuoteItem::toMap).toList());
        q.setNotes(req.notes() == null ? List.of()
                : req.notes().stream().map(String::trim).filter(s -> !s.isEmpty()).toList());
        q.setSupplier(supplierSnapshot(ownerId));
        QuoteCalculator.Totals t = QuoteCalculator.totals(items, mode);
        q.setTotals(t.supply(), t.vat(), t.grand());
    }

    private Map<String, Object> supplierSnapshot(Long ownerId) {
        BusinessProfileDto b = businessProfileService.get(ownerId);
        return new QuoteParty(b.companyName(), b.ceoName(), b.bizNo(), "", b.phone(), b.email(), b.address(),
                b.bankAccount()).toMap();
    }

    /** {@code Q-YYMM-NNN} — 그 달에 이미 쓴 번호 중 가장 큰 일련번호 + 1. */
    String nextQuoteNo(Long ownerId, LocalDate date) {
        String prefix = "Q-" + date.format(NO_MONTH) + "-";
        int max = 0;
        for (String no : repository.findQuoteNosByPrefix(ownerId, prefix)) {
            try {
                max = Math.max(max, Integer.parseInt(no.substring(prefix.length())));
            } catch (NumberFormatException e) {
                // 형식이 다른 번호는 무시
            }
        }
        return prefix + String.format("%03d", max + 1);
    }

    private Quote loadOwned(Long ownerId, Long id) {
        return repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("견적서를 찾을 수 없습니다."));
    }

    private static LocalDate today() {
        return LocalDate.now(KST);
    }
}
