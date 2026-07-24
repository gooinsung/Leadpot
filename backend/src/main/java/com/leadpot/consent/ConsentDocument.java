package com.leadpot.consent;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 동의/약관 문서. 리드폼의 동의 항목 '보기' 링크로 연결한다. 소유자(owner)만 관리(K5), 내용 조회는 공개.
 */
@Entity
@Table(name = "consent_documents")
public class ConsentDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** 관리용 이름(내부 식별, 공개 노출 안 함). 예: "A상품 이용 동의" */
    @Column(nullable = false)
    private String name = "";

    /** 공개 노출용 제목. 예: "개인정보 수집 및 이용 동의" */
    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content = "";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ConsentDocument() {
    }

    public ConsentDocument(Long ownerId, String name, String title, String content) {
        this.ownerId = ownerId;
        this.name = name == null ? "" : name;
        this.title = title;
        this.content = content == null ? "" : content;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name == null ? "" : name;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content == null ? "" : content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
