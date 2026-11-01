package com.leadpot.report;

import java.time.Instant;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 리드 리포트 문자 설정(V47). 마케터 계정당 1행(owner_id 가 PK).
 *
 * <p>아침 리포트(00~09시)와 하루 리포트(어제 00~24시)를 <b>따로</b> 켜고 끈다. 기본은 둘 다 꺼짐 —
 * 문자는 리드팟 비용이라 마케터가 직접 켜야 나간다.
 */
@Entity
@Table(name = "lead_report_settings")
public class LeadReportSettings {

    @Id
    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "morning_enabled", nullable = false)
    private boolean morningEnabled;

    @Column(name = "daily_enabled", nullable = false)
    private boolean dailyEnabled;

    /** 받을 번호. 비우면 계정 연락처로 보낸다. */
    @Column(name = "phone", length = 20)
    private String phone;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected LeadReportSettings() {
    }

    public LeadReportSettings(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public boolean isMorningEnabled() {
        return morningEnabled;
    }

    public void setMorningEnabled(boolean morningEnabled) {
        this.morningEnabled = morningEnabled;
    }

    public boolean isDailyEnabled() {
        return dailyEnabled;
    }

    public void setDailyEnabled(boolean dailyEnabled) {
        this.dailyEnabled = dailyEnabled;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    /** 이 종류의 리포트가 켜져 있는가. */
    public boolean isEnabled(LeadReportKind kind) {
        return kind == LeadReportKind.MORNING ? morningEnabled : dailyEnabled;
    }
}
