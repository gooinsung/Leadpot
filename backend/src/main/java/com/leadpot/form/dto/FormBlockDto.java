package com.leadpot.form.dto;

import java.util.Map;

import com.leadpot.form.BlockType;
import com.leadpot.form.FormBlock;

import jakarta.validation.constraints.NotNull;

/** 리드폼 본문 블록 요청/응답 공용 DTO. */
public record FormBlockDto(
        Long id,
        Integer stepNo,
        Integer sortOrder,
        @NotNull BlockType blockType,
        String fieldType,
        /** 불변 변수키. 응답으로 내려준 값을 그대로 돌려보내면 유지되고, 비우면 새로 발급된다. */
        String varKey,
        String label,
        Boolean required,
        Boolean uniqueCheck,
        String placeholder,
        Map<String, Object> options,
        Map<String, Object> content) {

    public static FormBlockDto from(FormBlock b) {
        return new FormBlockDto(
                b.getId(),
                b.getStepNo(),
                b.getSortOrder(),
                b.getBlockType(),
                b.getFieldType(),
                b.getVarKey(),
                b.getLabel(),
                b.isRequired(),
                b.isUniqueCheck(),
                b.getPlaceholder(),
                b.getOptions(),
                b.getContent());
    }

    /** 요청 DTO → 새 엔티티(리드폼 연결은 Form.replaceBlocks 에서 수행). 누락된 boolean/int 는 기본값 처리. */
    public FormBlock toEntity() {
        FormBlock b = new FormBlock();
        b.setStepNo(stepNo);
        b.setSortOrder(sortOrder == null ? 0 : sortOrder);
        b.setBlockType(blockType);
        b.setFieldType(fieldType);
        b.setVarKey(varKey); // 유지/발급 판단은 Form.replaceBlocks 가 한다
        b.setLabel(label);
        b.setRequired(Boolean.TRUE.equals(required));
        b.setUniqueCheck(Boolean.TRUE.equals(uniqueCheck));
        b.setPlaceholder(placeholder);
        b.setOptions(options);
        b.setContent(content);
        return b;
    }
}
