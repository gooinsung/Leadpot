package com.leadpot.tag;

import java.util.List;

/** 리드폼·랜딩 태그 교체 요청 — 받은 목록으로 통째로 바꾼다. */
public record TagsRequest(List<String> tags) {
}
