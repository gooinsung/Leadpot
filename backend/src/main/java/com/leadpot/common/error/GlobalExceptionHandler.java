package com.leadpot.common.error;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 전역 예외 → 공통 에러 응답(ApiError) 매핑. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 요청 본문 검증 실패 (@Valid). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        ApiError body = ApiError.of(HttpStatus.BAD_REQUEST.value(), "VALIDATION_ERROR",
                "입력값을 확인해주세요.", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(EmailAlreadyUsedException.class)
    public ResponseEntity<ApiError> handleEmailUsed(EmailAlreadyUsedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(HttpStatus.CONFLICT.value(), "EMAIL_ALREADY_USED", e.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of(HttpStatus.UNAUTHORIZED.value(), "INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ApiError> handleBadRefresh(InvalidRefreshTokenException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of(HttpStatus.UNAUTHORIZED.value(), "INVALID_REFRESH_TOKEN", e.getMessage()));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of(HttpStatus.NOT_FOUND.value(), "NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvalidSubmissionException.class)
    public ResponseEntity<ApiError> handleInvalidSubmission(InvalidSubmissionException e) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST.value(), "INVALID_SUBMISSION", e.getMessage()));
    }

    @ExceptionHandler(InvalidSubdomainException.class)
    public ResponseEntity<ApiError> handleInvalidSubdomain(InvalidSubdomainException e) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST.value(), "INVALID_SUBDOMAIN", e.getMessage()));
    }

    @ExceptionHandler(SubdomainTakenException.class)
    public ResponseEntity<ApiError> handleSubdomainTaken(SubdomainTakenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(HttpStatus.CONFLICT.value(), "SUBDOMAIN_TAKEN", e.getMessage()));
    }

    /** 요금제 한도 초과(광고주 계정 수 등). 결제 유도가 필요한 상태라 409 로 구분한다. */
    @ExceptionHandler(PlanLimitExceededException.class)
    public ResponseEntity<ApiError> handlePlanLimit(PlanLimitExceededException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(HttpStatus.CONFLICT.value(), "PLAN_LIMIT_EXCEEDED", e.getMessage()));
    }

    /** 상태 충돌(이미 부여된 리드폼, 중복 초대 등). */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiError> handleConflict(ConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.of(HttpStatus.CONFLICT.value(), "CONFLICT", e.getMessage()));
    }
}
