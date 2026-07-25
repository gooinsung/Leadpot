package com.leadpot.htmlcomponent;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HtmlComponentRepository extends JpaRepository<HtmlComponent, Long> {

    List<HtmlComponent> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<HtmlComponent> findByIdAndOwnerId(Long id, Long ownerId);
}
