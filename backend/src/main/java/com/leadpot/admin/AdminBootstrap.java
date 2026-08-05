package com.leadpot.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.leadpot.auth.Role;
import com.leadpot.auth.User;
import com.leadpot.auth.UserRepository;

/**
 * 최초 운영자 계정 승격.
 *
 * <p><b>문제</b>: 회원가입은 항상 {@code ROLE_USER} 로 만들어지고 어드민 화면은 {@code ROLE_ADMIN}
 * 만 들어갈 수 있다 → <b>첫 운영자를 만들 방법이 없다</b>(닫힌 문 안에 열쇠가 있는 상황).
 *
 * <p><b>해법</b>: 기동 시 {@code APP_ADMIN_BOOTSTRAP_EMAIL} 환경변수에 적힌 계정을 운영자로 올린다.
 * 마이그레이션 SQL 에 이메일을 박지 않는 이유는 <b>개인정보가 git 에 영구 기록</b>되기 때문이다.
 * 값이 비어 있으면(기본) 아무것도 하지 않는다.
 *
 * <p>⚠️ <b>강등은 하지 않는다.</b> 환경변수를 지웠다고 운영자를 내리면, 배포 설정을 실수로 비웠을 때
 * 아무도 어드민에 못 들어가는 상황이 된다. 내릴 때는 DB 를 직접 고친다.
 *
 * <p>⚠️ 이미 운영자면 아무 일도 하지 않는다(기동마다 이력이 쌓이지 않게).
 */
@Component
public class AdminBootstrap implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final AdminAuditLogRepository auditRepository;
    private final String bootstrapEmail;

    public AdminBootstrap(UserRepository userRepository, AdminAuditLogRepository auditRepository,
            @Value("${app.admin.bootstrap-email:}") String bootstrapEmail) {
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
        this.bootstrapEmail = bootstrapEmail == null ? "" : bootstrapEmail.trim().toLowerCase();
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (bootstrapEmail.isEmpty()) {
            return;
        }
        try {
            promote();
        } catch (RuntimeException e) {
            // 승격 실패가 기동을 막으면 안 된다 — 서비스는 정상 동작해야 한다.
            log.warn("[admin] 운영자 승격 실패 — {}", e.toString());
        }
    }

    @Transactional
    void promote() {
        User user = userRepository.findByEmail(bootstrapEmail).orElse(null);
        if (user == null) {
            // 아직 가입하지 않았을 수 있다. 가입 후 재기동하면 승격된다.
            log.warn("[admin] APP_ADMIN_BOOTSTRAP_EMAIL 계정을 찾을 수 없습니다. 가입 후 재기동하면 승격됩니다.");
            return;
        }
        if (user.getRole() == Role.ADMIN) {
            log.info("[admin] 운영자 계정 확인됨(id={}).", user.getId());
            return;
        }
        if (user.getRole() == Role.ADVERTISER) {
            // 광고주 하위계정을 운영자로 올리면 소유 관계가 깨진다.
            log.warn("[admin] 광고주 하위계정은 운영자로 승격하지 않습니다(id={}).", user.getId());
            return;
        }
        Role before = user.getRole();
        user.setRole(Role.ADMIN);
        auditRepository.save(new AdminAuditLog(user.getId(), user.getId(),
                AdminAuditLog.ACTION_ADMIN_BOOTSTRAP,
                "환경변수 승격: " + before + " → " + Role.ADMIN));
        log.info("[admin] 운영자로 승격했습니다(id={}).", user.getId());
    }
}
