package com.leadpot.folder.dto;

import com.leadpot.folder.FolderKind;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 폴더 생성 요청. parentId 를 지정하면 그 폴더의 하위 폴더로 만든다(depth). */
public record FolderCreateRequest(
        @NotNull FolderKind kind,
        Long parentId,
        @NotBlank @Size(max = 100) String name) {
}
