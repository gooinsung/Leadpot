package com.leadpot.form;

import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * 리드폼 본문의 한 블록. 입력 항목(FIELD)이거나 콘텐츠(IMAGE/HTML/TEXT/DIVIDER/SPACER).
 * sort_order 로 정렬되며, STEP 유형에서는 step_no 로 단계에 그룹핑된다(2B).
 */
@Entity
@Table(name = "form_blocks")
public class FormBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_id", nullable = false)
    private Form form;

    @Column(name = "step_no")
    private Integer stepNo;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "block_type", nullable = false, length = 20)
    private BlockType blockType;

    @Column(name = "field_type", length = 30)
    private String fieldType;

    @Column
    private String label;

    @Column(nullable = false)
    private boolean required;

    @Column(name = "unique_check", nullable = false)
    private boolean uniqueCheck;

    @Column
    private String placeholder;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> options;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private Map<String, Object> content;

    public FormBlock() {
    }

    public Long getId() {
        return id;
    }

    public Form getForm() {
        return form;
    }

    public void setForm(Form form) {
        this.form = form;
    }

    public Integer getStepNo() {
        return stepNo;
    }

    public void setStepNo(Integer stepNo) {
        this.stepNo = stepNo;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public BlockType getBlockType() {
        return blockType;
    }

    public void setBlockType(BlockType blockType) {
        this.blockType = blockType;
    }

    public String getFieldType() {
        return fieldType;
    }

    public void setFieldType(String fieldType) {
        this.fieldType = fieldType;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public boolean isUniqueCheck() {
        return uniqueCheck;
    }

    public void setUniqueCheck(boolean uniqueCheck) {
        this.uniqueCheck = uniqueCheck;
    }

    public String getPlaceholder() {
        return placeholder;
    }

    public void setPlaceholder(String placeholder) {
        this.placeholder = placeholder;
    }

    public Map<String, Object> getOptions() {
        return options;
    }

    public void setOptions(Map<String, Object> options) {
        this.options = options;
    }

    public Map<String, Object> getContent() {
        return content;
    }

    public void setContent(Map<String, Object> content) {
        this.content = content;
    }
}
