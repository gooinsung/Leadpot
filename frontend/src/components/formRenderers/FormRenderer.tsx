import type { FormInput } from "../../api/client";
import { BasicFormRenderer } from "./BasicFormRenderer";

/**
 * 유형별 폼 렌더러 분기(M7 확장 구조).
 * 새 유형 추가 시 여기에 case 와 렌더러 컴포넌트만 붙이면 된다.
 */
export function FormRenderer({ form }: { form: FormInput }) {
  switch (form.formType) {
    case "BASIC":
      return <BasicFormRenderer form={form} />;
    case "STEP":
      return (
        <div className="fr-placeholder">
          선택형(스텝) 미리보기는 Phase 2B 에서 제공됩니다.
        </div>
      );
    default:
      return null;
  }
}
