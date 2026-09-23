package com.leadpot.landing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.leadpot.auth.UserRepository;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.folder.FolderRepository;
import com.leadpot.form.FormRepository;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.lead.LeadRepository;

/** 랜딩 복사(LandingService.duplicate) — 저장소를 목으로 대체한 단위 테스트. */
class LandingDuplicateTest {

    private final LandingPageRepository landingRepository = mock(LandingPageRepository.class);
    private final LandingService service = new LandingService(landingRepository, mock(FormRepository.class),
            mock(UserRepository.class), mock(LeadRepository.class), mock(SiteIpBlockService.class),
            mock(FolderRepository.class));

    @Test
    void 새_주소_비공개_상태로_복제하고_같은_리드폼을_가리킨다() {
        LandingPage src = new LandingPage(7L, "Summer Event", "summer-event");
        Map<String, Object> formBlock = new LinkedHashMap<>(Map.of("type", "FORM", "formId", 42, "trigger", "inline"));
        src.setContent(List.of(Map.of("type", "IMAGE", "url", "https://img"), formBlock));
        src.setStatus("published");
        src.setTracking(Map.of("meta", "999"));
        src.setGoogleAdsSafe(true);
        src.setBgColor("#fafafa");
        src.setFolderId(5L);
        when(landingRepository.findByIdAndOwnerId(1L, 7L)).thenReturn(Optional.of(src));

        service.duplicate(7L, 1L);
        ArgumentCaptor<LandingPage> saved = ArgumentCaptor.forClass(LandingPage.class);
        verify(landingRepository).save(saved.capture());
        LandingPage copy = saved.getValue();

        assertEquals("Summer Event (복사본)", copy.getTitle());
        assertEquals("draft", copy.getStatus());
        assertNotEquals("summer-event", copy.getSlug());
        assertTrue(copy.getSlug().startsWith("summer-event-"));
        assertEquals(src.getContent(), copy.getContent());
        assertNotSame(formBlock, copy.getContent().get(1));
        assertEquals(42, copy.getContent().get(1).get("formId"));
        assertEquals(Map.of("meta", "999"), copy.getTracking());
        assertTrue(copy.isGoogleAdsSafe());
        assertEquals("#fafafa", copy.getBgColor());
        assertEquals(5L, copy.getFolderId());
        assertEquals(7L, copy.getOwnerId());
    }

    @Test
    void 남의_랜딩은_복사할_수_없다() {
        when(landingRepository.findByIdAndOwnerId(any(), any())).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.duplicate(7L, 1L));
    }
}
