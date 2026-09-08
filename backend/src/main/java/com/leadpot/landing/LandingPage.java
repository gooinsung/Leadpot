package com.leadpot.landing;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 랜딩페이지. 이미지/텍스트/HTML + '리드폼' 블록을 순서대로 배치한 공개 페이지(블록 방식).
 * 리드폼은 content 안의 FORM 블록이 formId + trigger(inline|overlay)로 참조(리드폼 재사용 M1).
 */
@Entity
@Table(name = "landing_pages")
public class LandingPage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 120, unique = true)
    private String slug;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Map<String, Object>> content;

    @Column(nullable = false, length = 20)
    private String status = "published";

    /** 광고 픽셀 ID들: {google, meta, tiktok, kakao, daangn}. 공개 랜딩에서 스크립트 삽입(I1). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> tracking;

    /** 켜면 공개 렌더 시 HTML 블록의 스크립트·iframe 을 제거한다(V41, 구글 광고용). */
    @Column(name = "google_ads_safe", nullable = false)
    private boolean googleAdsSafe = false;

    /** 정리용 폴더(V42). null 이면 미분류. {@link com.leadpot.folder.FolderKind#LANDING} 트리를 참조. */
    @Column(name = "folder_id")
    private Long folderId;

    /** 랜딩페이지 전체 배경 컬러(V43, hex). null/빈 값 = 화이트(기본). */
    @Column(name = "bg_color", length = 9)
    private String bgColor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected LandingPage() {
    }

    public LandingPage(Long ownerId, String title, String slug) {
        this.ownerId = ownerId;
        this.title = title;
        this.slug = slug;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public List<Map<String, Object>> getContent() {
        return content;
    }

    public void setContent(List<Map<String, Object>> content) {
        this.content = content;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Object> getTracking() {
        return tracking;
    }

    public void setTracking(Map<String, Object> tracking) {
        this.tracking = tracking;
    }

    public boolean isGoogleAdsSafe() {
        return googleAdsSafe;
    }

    public void setGoogleAdsSafe(boolean googleAdsSafe) {
        this.googleAdsSafe = googleAdsSafe;
    }

    public Long getFolderId() {
        return folderId;
    }

    public void setFolderId(Long folderId) {
        this.folderId = folderId;
    }

    public String getBgColor() {
        return bgColor;
    }

    /** 빈 문자열은 null 로 — "화이트(기본)"과 "설정 안 함"을 같은 값으로 취급. */
    public void setBgColor(String bgColor) {
        this.bgColor = bgColor == null || bgColor.isBlank() ? null : bgColor.trim();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
