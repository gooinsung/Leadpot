package com.leadpot.form;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.common.ClientIp;
import com.leadpot.form.dto.FormResponse;

import jakarta.servlet.http.HttpServletRequest;

/** 공개 리드폼 렌더 데이터 (비로그인). 방문자가 여는 공개 리드폼 /f/{id} 가 사용. */
@RestController
@RequestMapping("/api/public/forms")
public class PublicFormController {

    private final FormService formService;

    public PublicFormController(FormService formService) {
        this.formService = formService;
    }

    @GetMapping("/{id}")
    public FormResponse get(@PathVariable Long id, HttpServletRequest http) {
        // 소유자의 전역 접속 차단 적용(차단 IP 면 404).
        return formService.getPublic(id, ClientIp.of(http));
    }
}
