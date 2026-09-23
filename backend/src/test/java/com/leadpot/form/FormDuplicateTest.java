package com.leadpot.form;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import com.leadpot.ipblock.IpBlockHitRepository;
import com.leadpot.ipblock.IpBlockRepository;
import com.leadpot.ipblock.SiteIpBlockService;
import com.leadpot.lead.LeadRepository;

/** 리드폼 복사(FormService.duplicate) — 저장소를 목으로 대체한 단위 테스트. */
class FormDuplicateTest {

    private final FormRepository formRepository = mock(FormRepository.class);
    private final FormService service = new FormService(formRepository, mock(SiteIpBlockService.class),
            mock(UserRepository.class), mock(LeadRepository.class), mock(IpBlockRepository.class),
            mock(IpBlockHitRepository.class), mock(FolderRepository.class));

    private static Form source() {
        Form f = new Form(7L, "상담 신청", FormType.STEP);
        f.setCategory("개인회생");
        f.setRequirePhoneVerification(true);
        f.setFolderId(3L);
        f.setSource(FormSource.WEBHOOK);
        f.setWebhookTokenHash("hash");
        f.setWebhookConfig(Map.of("externalIdKey", "id"));
        f.setStyleConfig(new LinkedHashMap<>(Map.of("color", "#123456")));
        f.setTrackingConfig(Map.of("meta", "999"));
        FormBlock name = new FormBlock();
        name.setBlockType(BlockType.FIELD);
        name.setFieldType("text");
        name.setLabel("이름");
        name.setRequired(true);
        name.setVarKey("f3");
        name.setStepNo(1);
        FormBlock html = new FormBlock();
        html.setBlockType(BlockType.HTML);
        html.setContent(Map.of("html", "<p>안내</p>"));
        f.replaceBlocks(List.of(name, html));
        return f;
    }

    private Form duplicate(Form src) {
        when(formRepository.findByIdAndOwnerId(1L, 7L)).thenReturn(Optional.of(src));
        service.duplicate(7L, 1L);
        ArgumentCaptor<Form> saved = ArgumentCaptor.forClass(Form.class);
        verify(formRepository).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void 내용과_설정을_복제하고_이름에_복사본을_붙인다() {
        Form src = source();
        Form copy = duplicate(src);

        assertEquals("상담 신청 (복사본)", copy.getName());
        assertEquals(FormType.STEP, copy.getFormType());
        assertEquals("개인회생", copy.getCategory());
        assertEquals(3L, copy.getFolderId());
        assertEquals(Map.of("color", "#123456"), copy.getStyleConfig());
        assertNotSame(src.getStyleConfig(), copy.getStyleConfig());
        assertEquals(Map.of("meta", "999"), copy.getTrackingConfig());

        assertEquals(2, copy.getBlocks().size());
        FormBlock first = copy.getBlocks().get(0);
        assertNotSame(src.getBlocks().get(0), first);
        assertSame(copy, first.getForm());
        assertEquals("이름", first.getLabel());
        assertEquals("f3", first.getVarKey()); // 템플릿이 가리키는 변수키 유지
        assertEquals(1, first.getStepNo());
        assertNull(copy.getBlocks().get(1).getVarKey());
    }

    @Test
    void 웹훅_설정과_토큰은_복사하지_않는다() {
        Form copy = duplicate(source());

        assertEquals(FormSource.SELF, copy.getSource());
        assertNull(copy.getWebhookTokenHash());
        assertNull(copy.getWebhookConfig());
    }

    @Test
    void 문자_권한이_없으면_복사본의_문자발송은_꺼진다() {
        Form src = source();
        src.setSettingsConfig(Map.of("smsMarketerEnabled", true, "sheetUrl", "https://x"));
        Form copy = duplicate(src);

        assertFalse((Boolean) copy.getSettingsConfig().get("smsMarketerEnabled"));
        assertEquals("https://x", copy.getSettingsConfig().get("sheetUrl"));
    }

    @Test
    void 남의_리드폼은_복사할_수_없다() {
        when(formRepository.findByIdAndOwnerId(any(), any())).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.duplicate(7L, 1L));
    }
}
