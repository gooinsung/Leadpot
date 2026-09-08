package com.leadpot.folder;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FolderRepository extends JpaRepository<Folder, Long> {

    List<Folder> findByOwnerIdAndKindOrderByNameAsc(Long ownerId, FolderKind kind);

    Optional<Folder> findByIdAndOwnerId(Long id, Long ownerId);
}
