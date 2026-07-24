package com.leadpot.auth.dto;

import java.time.Instant;

import com.leadpot.auth.Plan;
import com.leadpot.auth.Role;
import com.leadpot.auth.User;

/** 계정 정보 응답 (password_hash 등 민감 정보 제외). */
public record UserResponse(
        Long id,
        String email,
        String name,
        String phone,
        String subdomain,
        Role role,
        Plan plan,
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getSubdomain(),
                user.getRole(),
                user.getPlan(),
                user.getCreatedAt());
    }
}
