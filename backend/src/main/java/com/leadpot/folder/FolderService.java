package com.leadpot.folder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.common.error.InvalidSubmissionException;
import com.leadpot.common.error.NotFoundException;
import com.leadpot.folder.dto.FolderCreateRequest;
import com.leadpot.folder.dto.FolderResponse;
import com.leadpot.folder.dto.FolderUpdateRequest;

/** 리드폼·랜딩페이지 폴더 CRUD(본인 소유만, K5). */
@Service
public class FolderService {

    private final FolderRepository folderRepository;

    public FolderService(FolderRepository folderRepository) {
        this.folderRepository = folderRepository;
    }

    @Transactional(readOnly = true)
    public List<FolderResponse> list(Long ownerId, FolderKind kind) {
        return folderRepository.findByOwnerIdAndKindOrderByNameAsc(ownerId, kind)
                .stream().map(FolderResponse::from).toList();
    }

    @Transactional
    public FolderResponse create(Long ownerId, FolderCreateRequest req) {
        Long parentId = req.parentId();
        if (parentId != null) {
            Folder parent = load(ownerId, parentId);
            if (parent.getKind() != req.kind()) {
                throw new InvalidSubmissionException("상위 폴더의 종류가 다릅니다.");
            }
        }
        Folder folder = new Folder(ownerId, req.kind(), parentId, req.name().trim());
        folderRepository.save(folder);
        return FolderResponse.from(folder);
    }

    @Transactional
    public FolderResponse update(Long ownerId, Long id, FolderUpdateRequest req) {
        Folder folder = load(ownerId, id);
        Long newParentId = req.parentId();
        if (newParentId != null) {
            if (newParentId.equals(id)) {
                throw new InvalidSubmissionException("폴더를 자기 자신의 하위로 옮길 수 없습니다.");
            }
            Folder newParent = load(ownerId, newParentId);
            if (newParent.getKind() != folder.getKind()) {
                throw new InvalidSubmissionException("다른 종류의 폴더로는 옮길 수 없습니다.");
            }
            if (isDescendant(ownerId, newParentId, id)) {
                throw new InvalidSubmissionException("폴더를 자신의 하위 폴더로 옮길 수 없습니다.");
            }
        }
        folder.setName(req.name().trim());
        folder.setParentId(newParentId);
        return FolderResponse.from(folder);
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        Folder folder = load(ownerId, id);
        folderRepository.delete(folder);
    }

    /** candidateId 가 rootId 의 하위(자손) 폴더인지 — 순환 참조(자기 자신을 자손으로 옮기기) 방지용. */
    private boolean isDescendant(Long ownerId, Long candidateId, Long rootId) {
        Map<Long, Long> parentOf = new HashMap<>();
        for (Folder f : folderRepository.findByOwnerIdAndKindOrderByNameAsc(ownerId, load(ownerId, rootId).getKind())) {
            parentOf.put(f.getId(), f.getParentId());
        }
        Long cur = candidateId;
        int guard = 0; // 순환 데이터가 있어도 무한루프 방지
        while (cur != null && guard++ < 1000) {
            if (cur.equals(rootId)) {
                return true;
            }
            cur = parentOf.get(cur);
        }
        return false;
    }

    private Folder load(Long ownerId, Long id) {
        return folderRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("폴더를 찾을 수 없습니다."));
    }
}
