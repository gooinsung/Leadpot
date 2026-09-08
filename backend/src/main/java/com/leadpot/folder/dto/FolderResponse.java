package com.leadpot.folder.dto;

import java.time.Instant;

import com.leadpot.folder.Folder;
import com.leadpot.folder.FolderKind;

public record FolderResponse(
        Long id,
        FolderKind kind,
        Long parentId,
        String name,
        Instant createdAt,
        Instant updatedAt) {

    public static FolderResponse from(Folder f) {
        return new FolderResponse(f.getId(), f.getKind(), f.getParentId(), f.getName(), f.getCreatedAt(), f.getUpdatedAt());
    }
}
