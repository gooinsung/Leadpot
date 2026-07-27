package com.leadpot.lead;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadNoteRepository extends JpaRepository<LeadNote, Long> {

    List<LeadNote> findByLeadIdOrderByCreatedAtAsc(Long leadId);
}
