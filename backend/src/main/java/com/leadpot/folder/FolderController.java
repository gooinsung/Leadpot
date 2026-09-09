package com.leadpot.folder;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.folder.dto.FolderCreateRequest;
import com.leadpot.folder.dto.FolderResponse;
import com.leadpot.folder.dto.FolderUpdateRequest;

import jakarta.validation.Valid;

/** 리드폼·랜딩페이지 폴더 관리 API(로그인 필요, 본인 소유만 K5). */
@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    public List<FolderResponse> list(@AuthenticationPrincipal Jwt jwt, @RequestParam FolderKind kind) {
        return folderService.list(userId(jwt), kind);
    }

    @PostMapping
    public ResponseEntity<FolderResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody FolderCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(folderService.create(userId(jwt), request));
    }

    @PutMapping("/{id}")
    public FolderResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody FolderUpdateRequest request) {
        return folderService.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        folderService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
