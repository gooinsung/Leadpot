package com.leadpot.consent;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsentDocumentRepository extends JpaRepository<ConsentDocument, Long> {

    List<ConsentDocument> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<ConsentDocument> findByIdAndOwnerId(Long id, Long ownerId);
}
