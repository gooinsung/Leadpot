package com.leadpot.form;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.leadpot.form.dto.FormResponse;

/** 공개 폼 렌더 데이터 (비로그인). 방문자가 여는 공개 폼 /f/{id} 가 사용. */
@RestController
@RequestMapping("/api/public/forms")
public class PublicFormController {

    private final FormService formService;

    public PublicFormController(FormService formService) {
        this.formService = formService;
    }

    @GetMapping("/{id}")
    public FormResponse get(@PathVariable Long id) {
        return formService.getPublic(id);
    }
}
