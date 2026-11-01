package com.leadpot.report;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadReportSettingsRepository extends JpaRepository<LeadReportSettings, Long> {

    List<LeadReportSettings> findByMorningEnabledTrue();

    List<LeadReportSettings> findByDailyEnabledTrue();
}
