package com.leadpot.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;

/**
 * 운영자 부트스트랩 승격이 <b>실제로 저장되는지</b> 검증.
 *
 * <p>⚠️ 일부러 {@code @Transactional} 을 붙이지 않는다 — 실제 기동 때 {@code promote()} 는
 * 트랜잭션 <b>밖</b>에서 돈다(이벤트 리스너 자기호출은 프록시를 안 탄다). 테스트를 트랜잭션으로
 * 감싸면 엔티티가 관리 상태가 돼 dirty checking 이 동작해버려서, "승격 로그만 남고 role 은
 * USER 로 남는" 실제 버그(2026-08-19 발견·수정)를 재현하지 못한다.
 */
@SpringBootTest
class AdminBootstrapTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AdminAuditLogRepository auditRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("부트스트랩 승격이 트랜잭션 밖에서도 DB 에 저장된다")
    void promotePersistsOutsideTransaction() {
        User user = userRepository.save(new User("boot-admin@test.local",
                passwordEncoder.encode("pw12345678"), "부트", null));
        try {
            // 실제 기동과 같은 조건: 프록시 없이 직접 호출(트랜잭션 없음).
            new AdminBootstrap(userRepository, auditRepository, "boot-admin@test.local").promote();

            assertThat(userRepository.findById(user.getId()).orElseThrow().getRole())
                    .isEqualTo(Role.ADMIN);
            assertThat(auditRepository.findByTargetIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, 10)))
                    .anySatisfy(l -> assertThat(l.getAction()).isEqualTo(AdminAuditLog.ACTION_ADMIN_BOOTSTRAP));
        } finally {
            // 트랜잭션 롤백이 없으므로 직접 청소한다(같은 JVM 의 다른 테스트에 새지 않게).
            auditRepository.deleteAll(
                    auditRepository.findByTargetIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, 100)));
            userRepository.delete(user);
        }
    }
}
