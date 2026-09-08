package com.leadpot.folder.dto;

/** 랜딩/리드폼을 폴더로 옮기는 요청(드래그앤드롭). folderId 가 null 이면 미분류로 되돌린다. */
public record FolderAssignRequest(Long folderId) {
}
