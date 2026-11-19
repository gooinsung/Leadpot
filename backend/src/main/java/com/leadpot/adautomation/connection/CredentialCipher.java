package com.leadpot.adautomation.connection;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.leadpot.common.error.InvalidSubmissionException;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * 매체 자격증명 암호화(AES-256-GCM). 고객 광고계정 키는 리드팟이 보관하는 정보 중 가장 민감하다.
 *
 * <p>키: 환경변수 {@code APP_AD_CREDENTIALS_KEY} = 32바이트를 base64 로(예: {@code openssl rand -base64 32}).
 * Railway Variables 에만 둔다(코드·git 금지). <b>키를 잃거나 바꾸면 저장된 연결을 모두 다시 등록해야 한다.</b>
 *
 * <p>키가 없어도 서버는 정상 기동한다 — 연결 저장·사용만 "서버 설정 필요"로 거절한다.
 * 저장 형식: {@code v1:} + base64(IV 12바이트 + 암호문·태그).
 */
@Component
public class CredentialCipher {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CredentialCipher.class);

    private static final String PREFIX = "v1:";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();
    private final JsonMapper json = JsonMapper.builder().build();

    public CredentialCipher(@Value("${app.ad-automation.credentials-key:}") String base64Key) {
        this.key = parseKey(base64Key);
    }

    public boolean isConfigured() {
        return key != null;
    }

    public String encrypt(Map<String, String> credentials) {
        SecretKey k = requireKey();
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] plain = json.writeValueAsString(credentials).getBytes(StandardCharsets.UTF_8);
            byte[] enc = c.doFinal(plain);
            return PREFIX + Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(iv.length + enc.length).put(iv).put(enc).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("자격증명 암호화 실패", e);
        }
    }

    public Map<String, String> decrypt(String stored) {
        SecretKey k = requireKey();
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new IllegalStateException("알 수 없는 자격증명 형식");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, all, 0, IV_LEN));
            byte[] plain = c.doFinal(all, IV_LEN, all.length - IV_LEN);
            return json.readValue(new String(plain, StandardCharsets.UTF_8), new TypeReference<Map<String, String>>() {
            });
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // 키가 바뀌었거나 값이 손상됨 — 원문·키는 메시지에 넣지 않는다.
            throw new IllegalStateException("자격증명을 복호화하지 못했습니다(암호화 키 변경 가능성).", e);
        }
    }

    private SecretKey requireKey() {
        if (key == null) {
            throw new InvalidSubmissionException(
                    "서버에 광고 연동 암호화 키가 설정되지 않아 매체를 연결할 수 없습니다. 운영자에게 문의해주세요.");
        }
        return key;
    }

    private static SecretKey parseKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return null;
        }
        // 잘못된 키여도 서버 기동은 막지 않는다(본 서비스 무관 원칙) — 로그만 남기고 '미설정'으로 취급한다.
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            log.error("[ad-automation] APP_AD_CREDENTIALS_KEY 가 base64 가 아닙니다 — 광고 연동을 쓸 수 없습니다.");
            return null;
        }
        if (raw.length != 32) {
            log.error("[ad-automation] APP_AD_CREDENTIALS_KEY 는 32바이트여야 합니다(openssl rand -base64 32) — 광고 연동을 쓸 수 없습니다.");
            return null;
        }
        return new SecretKeySpec(raw, "AES");
    }
}
