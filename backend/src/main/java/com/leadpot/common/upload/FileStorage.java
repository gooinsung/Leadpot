package com.leadpot.common.upload;

import java.io.IOException;

/**
 * 파일 저장 추상화. 구현: 로컬 디스크(기본) / Cloudflare R2(S3 호환).
 * app.storage.type 로 어떤 구현이 활성화될지 결정된다.
 */
public interface FileStorage {

    /** 파일을 저장하고 공개 접근 가능한 절대 URL 을 반환한다. */
    String store(String filename, byte[] content, String contentType) throws IOException;
}
