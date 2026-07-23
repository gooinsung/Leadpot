package com.leadpot.form.dto;

import java.util.Map;

import com.leadpot.form.BlockType;
import com.leadpot.form.FormBlock;

import jakarta.validation.constraints.NotNull;

/** 폼 본문 블록 요청/응답 공용 DTO. */
public record FormBlockDto(
        Long id,
        Integer stepNo,
        Integer sortOrder,
        @NotNull BlockType blockType,
        String fieldType,
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
                b.getLabel(),
                b.isRequired(),
                b.isUniqueCheck(),
                b.getPlaceholder(),
                b.getOptions(),
                b.getContent());
    }

    /** 요청 DTO → 새 엔티티(폼 연결은 Form.replaceBlocks 에서 수행). 누락된 boolean/int 는 기본값 처리. */
    public FormBlock toEntity() {
        FormBlock b = new FormBlock();
        b.setStepNo(stepNo);
        b.setSortOrder(sortOrder == null ? 0 : sortOrder);
        b.setBlockType(blockType);
        b.setFieldType(fieldType);
        b.setLabel(label);
        b.setRequired(Boolean.TRUE.equals(required));
        b.setUniqueCheck(Boolean.TRUE.equals(uniqueCheck));
        b.setPlaceholder(placeholder);
        b.setOptions(options);
        b.setContent(content);
        return b;
    }
}
