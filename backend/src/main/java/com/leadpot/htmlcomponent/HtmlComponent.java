package com.leadpot.htmlcomponent;

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
 * 재사용 HTML 요소(M8). 랜딩/폼의 HTML 블록에 복사 삽입(스냅샷)해서 재사용한다.
 * 소유자(owner)만 관리(K5). 삽입은 클라이언트에서 html 을 블록에 복사하는 방식이라 공개 조회는 없다.
 */
@Entity
@Table(name = "html_components")
public class HtmlComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** 관리용 이름. 예: "메인 상단 헤더" */
    @Column(nullable = false)
    private String name = "";

    /** 분류: HEADER | FOOTER | CTA | CONTENT | ETC */
    @Column(nullable = false, length = 40)
    private String category = "ETC";

    @Column(nullable = false, columnDefinition = "text")
    private String html = "";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HtmlComponent() {
    }

    public HtmlComponent(Long ownerId, String name, String category, String html) {
        this.ownerId = ownerId;
        this.name = name == null ? "" : name;
        this.category = category == null || category.isBlank() ? "ETC" : category;
        this.html = html == null ? "" : html;
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

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category == null || category.isBlank() ? "ETC" : category;
    }

    public String getHtml() {
        return html;
    }

    public void setHtml(String html) {
        this.html = html == null ? "" : html;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
