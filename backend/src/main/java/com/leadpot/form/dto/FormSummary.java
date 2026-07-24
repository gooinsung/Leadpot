package com.leadpot.form.dto;

import java.time.Instant;

import com.leadpot.form.Form;
import com.leadpot.form.FormType;

/** 리드폼 목록용 요약 응답. */
public record FormSummary(
        Long id,
        String name,
        FormType formType,
        int blockCount,
        Instant updatedAt) {

    public static FormSummary from(Form form) {
        return new FormSummary(
                form.getId(),
                form.getName(),
                form.getFormType(),
                form.getBlocks().size(),
                form.getUpdatedAt());
    }
}
