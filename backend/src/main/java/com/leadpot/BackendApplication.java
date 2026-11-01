package com.leadpot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ⚠️ {@link EnableScheduling} — 주기 실행({@code @Scheduled})을 켠다. 현재 쓰는 곳:
 * {@link com.leadpot.lead.LeadAutoApproveRunner}(자동 승인 기간),
 * {@link com.leadpot.report.LeadReportRunner}(리드 리포트 문자 09시·00시).
 * <p>컨테이너가 한 대라는 전제 위에 있다 — 다중화하면 같은 작업이 중복 실행된다(그 클래스 주석 참고).
 * <p>테스트는 {@code app.lead.auto-approve.enabled=false}·{@code app.lead.report.enabled=false} 로 실행을 막는다.
 */
@EnableScheduling
@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
