package com.leadpot.folder.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 폴더 이름 변경/이동(부모 폴더 변경) 요청. parentId 가 null 이면 최상위로 옮긴다. */
public record FolderUpdateRequest(
        @NotBlank @Size(max = 100) String name,
        Long parentId) {
}
