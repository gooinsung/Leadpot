import { useEffect, useState } from "react";
import { Loading } from "../components/Loading";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createForm,
  getAdvertiserNotifyStatus,
  getForm,
  getSmsStatus,
  listConsentDocs,
  listForms,
  testFormSheets,
  updateForm,
  uploadSmsAttachment,
  type AdvertiserNotifyStatus,
  type BlockType,
  type ConsentDocumentSummary,
  type ConsentItem,
  type FormBlock,
  type FormInput,
  type FormType,
  type SmsStatus,
} from "../api/client";
import { TopBar } from "../components/TopBar";
import { HtmlComponentPicker } from "../components/HtmlComponentPicker";
import { HtmlImageUploadButton } from "../components/HtmlImageUploadButton";
import { FormRenderer } from "../components/formRenderers/FormRenderer";
import { CompletionView } from "../components/formRenderers/CompletionView";
import { AdvertiserBillingCard } from "../components/AdvertiserBillingCard";
import { ImageUploadField } from "../components/ImageUploadField";
import { PixelFields } from "../components/PixelFields";
import { useAuth } from "../lib/authContext";
import { toast } from "../lib/toast";
import { CALCULATORS, findCalculator } from "../lib/calculators/registry";
import { CalcFollowUp, CalcResultView } from "../components/formRenderers/CalcResultView";
import type { CalculatorDef } from "../lib/calculators/types";

/**
 * 광고주 접수 알림 수신 상태 안내(V28).
 *
 * 마케터가 광고주 번호를 대신 넣던 칸을 없앤 자리다. 남의 번호로 보내면 수신 동의 근거가 없고,
 * 발신 채널이 리드팟 명의 하나라 신고 한 번에 전 고객 알림이 막힌다(docs/MESSAGING-PLAN.md §9).
 * 광고주가 포털에서 직접 등록해야 발송되므로, 여기서는 "지금 보낼 수 있는 상태인지"만 알려준다.
 */
function AdvertiserNotifyNotice({ status }: { status: AdvertiserNotifyStatus | null }) {
  if (!status) return null;

  if (!status.linked) {
    return (
      <p className="dash-sub" style={{ marginTop: 10 }}>
        ⚠️ 이 리드폼에 <b>연결된 광고주가 없어 발송되지 않습니다.</b> 켜 둔 상태는 유지되니,
        <Link to="/advertisers"> 광고주 관리</Link>에서 초대해 이 리드폼 권한을 주면 그때부터 동작합니다.
      </p>
    );
  }
  // 광고주가 '이 폼만 끔' 과 '번호 미등록' 은 마케터가 할 수 있는 조치가 다르다 — 구분해서 안내한다.
  if (status.disabledByAdvertiser) {
    return (
      <p className="dash-sub" style={{ marginTop: 10 }}>
        🔇 <b>{status.advertiserName}</b> 님이 <b>이 리드폼만 알림을 끈 상태</b>라 발송되지 않습니다.
        다른 리드폼은 정상 발송될 수 있습니다. 다시 받으려면 광고주가 직접 켜야 합니다.
      </p>
    );
  }
  if (!status.registered) {
    return (
      <p className="dash-sub" style={{ marginTop: 10 }}>
        ⚠️ <b>{status.advertiserName}</b> 님이 아직 받을 번호를 등록하지 않아 <b>발송되지 않습니다.</b>{" "}
        광고주가 광고주 페이지 &gt; 알림 설정에서 <b>기본 수신번호</b>를 한 번 넣으면
        이 리드폼을 포함해 배정된 모든 리드폼의 알림이 시작됩니다.
      </p>
    );
  }
  return (
    <p className="dash-sub" style={{ marginTop: 10 }}>
      ✅ <b>{status.advertiserName}</b> 님의{" "}
      {status.source === "FORM" ? "이 리드폼 전용 번호" : "기본 수신번호"}(
      <code>{status.phoneMasked}</code>)로 발송됩니다.
      {status.source === "ACCOUNT" && " 광고주가 배정된 모든 리드폼에 쓰는 번호입니다."}
      {" "}번호 변경·해제는 광고주 본인만 할 수 있습니다.
    </p>
  );
}

function defaultConsentItems(): ConsentItem[] {
  return [
    { title: "개인정보 수집 및 이용 동의", required: true, defaultChecked: true, linkType: "none" },
    { title: "개인정보 제3자 제공 동의", required: true, defaultChecked: true, linkType: "none" },
    { title: "광고성 정보 수신동의", required: false, defaultChecked: false, linkType: "none" },
  ];
}

const FIELD_TYPES = [
  { value: "text", label: "한 줄 텍스트" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "textarea", label: "여러 줄" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
  { value: "select", label: "선택박스" },
];

// 스텝형 단계의 답변 방식 (기본형 필드 유형과 동일 계열 + 카드 선택)
const ANSWER_TYPES = [
  { value: "single", label: "단일 선택(카드)" },
  { value: "multi", label: "다중 선택(카드)" },
  { value: "select", label: "선택박스" },
  { value: "text", label: "텍스트" },
  { value: "textarea", label: "장문" },
  { value: "tel", label: "연락처" },
  { value: "email", label: "이메일" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
];
const OPTION_ANSWER_TYPES = ["single", "multi", "select"]; // 선택지 목록이 필요한 유형

/** 접은 카드 기억용(브라우저에만 저장). 매번 다시 접지 않아도 되게 한다. */
const COLLAPSE_KEY = "leadpot-form-edit-collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * 구글시트 주소에서 시트 ID 만 뽑는다. 사용자는 보통 주소창을 통째로 붙여넣는다:
 * `https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0` → `<ID>`
 * ID 를 그대로 넣었으면 그대로 둔다. 알아볼 수 없으면 입력값을 그대로 돌려줘 서버가 판단하게 한다.
 * (백엔드 `GoogleSheetsClient.extractSpreadsheetId` 와 같은 규칙)
 */
function extractSpreadsheetId(input: string): string {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : s;
}

/**
 * 카드 제목 겸 접기 버튼.
 * 내용 숨김은 CSS 가 한다 — 카드에 `data-collapsed="true"` 면 제목 외 자식을 감춘다.
 * (JSX 구조를 건드리지 않으려는 의도적 선택 — styles/features/form-builder.css 참고)
 */
function SectionHead({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="card-h card-h-btn" onClick={onToggle} aria-expanded={open}>
      <span>{title}</span>
      <span className={`card-h-caret${open ? " on" : ""}`} aria-hidden="true">▾</span>
    </button>
  );
}

interface StepData {
  question: string;
  description: string;
  answerType: string;
  placeholder: string;
  required: boolean;
  options: { label: string; desc: string; value?: string }[];
  /**
   * 이 단계의 답이 계산기의 어느 입력인지(`totalDebt` 등). 계산기를 고르면 자동으로 붙는다.
   * 값이 계산에 들어가므로 **마케터가 답변 방식·선택지 값을 함부로 바꾸면 결과가 틀린다** →
   * 편집 화면에서 배지로 표시하고 답변 방식은 잠근다.
   */
  calcInput?: string | null;
  /** 기본 선택 — options 의 인덱스. null 이면 미리 선택하지 않는다. */
  defaultIndex?: number | null;
  /**
   * 서버가 발급한 불변 변수키. 스텝형은 저장할 때 CHOICE 블록을 이 상태에서 새로 조립하므로,
   * 여기에 들고 있지 않으면 저장마다 키가 새로 발급되어 메시지 템플릿이 깨진다.
   */
  varKey?: string | null;
}

function newBlock(blockType: BlockType): FormBlock {
  const base: FormBlock = { sortOrder: 0, blockType };
  if (blockType === "FIELD") return { ...base, fieldType: "text", label: "새 항목", required: false };
  if (blockType === "IMAGE") return { ...base, content: { url: "", alt: "" } };
  if (blockType === "HTML") return { ...base, content: { html: "<p>안내 문구</p>" } };
  if (blockType === "TEXT") return { ...base, content: { text: "텍스트" } };
  return base;
}

/** 변수 목록·선택박스에 보여줄 항목 이름. CHOICE 는 질문 문구가 항목명 역할을 한다. */
function blockLabel(b: FormBlock): string {
  if (b.blockType === "CHOICE") {
    return ((b.content?.question as string) || "").trim() || "(질문 없음)";
  }
  return (b.label || "").trim() || "(이름 없음)";
}

/**
 * 새 스텝형 리드폼의 씨앗 질문. **자리채우기 예시**이므로 마케터의 작업물로 보지 않는다
 * ({@link isPristineSteps} 참고) — 계산기로 바꿀 때 굳이 "지워도 되나요?"를 묻지 않는다.
 */
function defaultSteps(): StepData[] {
  return [
    {
      question: "현재 가장 어려운 점은 무엇인가요?",
      description: "",
      answerType: "single",
      placeholder: "",
      required: true,
      options: [
        { label: "선택지 1", desc: "" },
        { label: "선택지 2", desc: "" },
      ],
    },
  ];
}

/** 손대지 않은 씨앗 질문 그대로인가. 계산기로 바꿀 때 확인창을 띄울지 판단한다. */
function isPristineSteps(steps: StepData[]): boolean {
  const seed = defaultSteps();
  if (steps.length !== seed.length) return false;
  return steps.every((s, i) => {
    const d = seed[i];
    return (
      s.question === d.question &&
      s.description === d.description &&
      s.answerType === d.answerType &&
      s.options.length === d.options.length &&
      s.options.every((o, oi) => o.label === d.options[oi].label)
    );
  });
}

/**
 * 계산기 정의 → 질문 단계 자동 생성 (사용자 결정 2026-08-13: 수동 매핑이 아니라 자동 생성).
 * 오매핑으로 결과가 조용히 틀리는 것을 원천 차단한다 — 틀린 결과의 책임은 리드팟으로 온다.
 */
function stepsFromCalculator(def: CalculatorDef): StepData[] {
  return def.inputs.map((it) => ({
    question: it.question,
    description: it.description ?? "",
    answerType: it.answerType,
    placeholder: it.placeholder ?? "",
    required: it.required,
    options: (it.options ?? []).map((o) => ({ label: o.label, desc: o.desc ?? "", value: o.value })),
    defaultIndex: null,
    calcInput: it.key,
  }));
}

function defaultContactFields(): FormBlock[] {
  return [
    { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "이름", required: true, placeholder: "홍길동" },
    { sortOrder: 1, blockType: "FIELD", fieldType: "tel", label: "연락처", required: true, placeholder: "010-0000-0000" },
  ];
}

export function FormEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  // 마케터 수신번호의 기본값으로 쓴다(가입 때 입력한 내 연락처).
  const { user } = useAuth();

  const [name, setName] = useState("새 리드폼");
  // 분야(업종 구분: 개인회생·장기렌트 등, V34) — 인박스에서 분야로 거른다. '태그'(리드 손태그)와 별개.
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]); // 내 폼들의 기존 분야(datalist)
  const [formType, setFormType] = useState<FormType>("BASIC");

  // BASIC: 평면 블록 배열. 맨 위 설명 문구는 스텝형(각 단계 description)과 맞춘 기본 제공(2026-08-20).
  const [blocks, setBlocks] = useState<FormBlock[]>([
    { sortOrder: 0, blockType: "TEXT", content: { text: "여기에 리드폼 소개나 안내 문구를 입력해주세요." } },
    { sortOrder: 1, blockType: "FIELD", fieldType: "text", label: "이름", required: true, placeholder: "홍길동" },
    { sortOrder: 2, blockType: "FIELD", fieldType: "tel", label: "연락처", required: true, placeholder: "010-0000-0000" },
  ]);

  // STEP: 질문 단계 + 마지막 연락처 단계
  const [steps, setSteps] = useState<StepData[]>(defaultSteps());
  const [contactFields, setContactFields] = useState<FormBlock[]>(defaultContactFields());
  const [contactMessage, setContactMessage] = useState("");
  /**
   * 붙어 있는 계산기(`null` = 없음). 마케터에게는 "리드폼 종류"로 보이지만
   * 내부적으로는 STEP + CALC 블록이다 — formType 을 늘리면 BASIC/STEP 분기를 전부 3-way 로
   * 고쳐야 하고 계산기가 늘 때마다 enum 이 늘어난다.
   */
  const [calcKey, setCalcKey] = useState<string | null>(null);
  const calculator = findCalculator(calcKey);

  const [consentItems, setConsentItems] = useState<ConsentItem[]>(defaultConsentItems());
  const [consentDocs, setConsentDocs] = useState<ConsentDocumentSummary[]>([]);
  const [submitLabel, setSubmitLabel] = useState("무료 상담 신청");
  const [buttonColor, setButtonColor] = useState("#12b886");
  const [accentColor, setAccentColor] = useState("#3a43c0");
  const [successMode, setSuccessMode] = useState<"message" | "redirect">("message");
  const [successTitle, setSuccessTitle] = useState("신청이 완료되었습니다");
  const [successMessage, setSuccessMessage] = useState("빠른 시일 내에 연락드리겠습니다.");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [requirePhone, setRequirePhone] = useState(false);
  const [allowSameIp, setAllowSameIp] = useState(true);
  const [ipDedupDays, setIpDedupDays] = useState(0);
  // 자동 승인 기간 — 켜면 접수 후 N일이 지난 신규·상담중 리드를 서버가 '완료'로 넘긴다.
  // 기준 시각(autoApproveSince)은 서버가 찍으므로 여기서 보내지 않는다(소급 적용 방지).
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveDays, setAutoApproveDays] = useState(7);
  // 목표(2026-08-09) — 일간/월간 목표 + 기간. 보고서는 /goals 에서 본다. 과금 목표(grant)와 별개.
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalDaily, setGoalDaily] = useState(0);
  const [goalMonthly, setGoalMonthly] = useState(0);
  const [goalStart, setGoalStart] = useState("");
  const [goalEnd, setGoalEnd] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [sheetsEnabled, setSheetsEnabled] = useState(false);
  // 계정의 문자 발송 권한(V25). 권한이 없으면 이 화면의 문자 설정을 비활성화하고 이유를 안내한다.
  // ⚠️ null = 아직 조회 전. 이때는 잠그지 않는다 — 권한 있는 계정에 "권한 없음"이 깜빡이면 안 된다.
  //    어차피 최종 관문은 서버다(FormService.sanitizeSmsSettings + SmsService.send).
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
  // 문자 발송 — 건당 비용이 들기 때문에 셋 다 기본 off 다.
  const [smsMarketerEnabled, setSmsMarketerEnabled] = useState(false);
  const [smsAdvertiserEnabled, setSmsAdvertiserEnabled] = useState(false);
  const [smsLeadEnabled, setSmsLeadEnabled] = useState(false);
  const [smsLeadBody, setSmsLeadBody] = useState("");
  const [smsLeadPhoneVarKey, setSmsLeadPhoneVarKey] = useState("");
  // 마케터 수신번호는 리드폼별로 지정한다(계정 연락처 하나로 묶지 않는다).
  // 체크를 켜면 내 계정 연락처가 자동으로 채워지고(아래 toggleSmsMarketer), 원하면 이 리드폼만 다른
  // 번호로 바꿀 수 있다. 그래도 비워서 저장하는 것은 허용한다 — 서버가 계정 연락처로 폴백한다.
  // ⚠️ 광고주 번호는 여기에 없다 — 광고주가 포털에서 본인이 등록한다(V28, MESSAGING-PLAN §9).
  //    남의 번호를 마케터가 대신 넣으면 수신 동의 근거가 없다. 상태만 아래 notifyStatus 로 보여준다.
  const [smsMarketerPhone, setSmsMarketerPhone] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<AdvertiserNotifyStatus | null>(null);
  // 첨부: 대행사에 올려둔 파일 id 만 저장한다(우리 서버에 원본을 두지 않는다).
  // 미리보기는 방금 올린 파일에 한해 로컬 URL 로 보여준다 — id 로는 이미지를 되불러올 수 없다.
  const [smsLeadImageId, setSmsLeadImageId] = useState("");
  const [smsAttachPreview, setSmsAttachPreview] = useState("");
  const [smsAttachBusy, setSmsAttachBusy] = useState(false);
  // 구글시트: 시트 ID(주소를 붙여넣으면 ID 만 뽑아 저장) + 탭 이름(비우면 맨 앞 탭).
  const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState("");
  const [sheetsTabName, setSheetsTabName] = useState("");
  const [sheetTest, setSheetTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheetTesting, setSheetTesting] = useState(false);
  const [tracking, setTracking] = useState<Record<string, unknown> | null>(null); // 광고 픽셀
  // 카드 접기 상태(브라우저에 기억). sec(key) 로 카드에 붙이고 SectionHead 로 제목을 그린다.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  }
  /** 카드에 접힘 표시를 붙인다(내용 숨김은 CSS). */
  const sec = (key: string) => ({ "data-collapsed": collapsed[key] ? "true" : undefined });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 문자 권한 조회 — 새 리드폼에서도 필요하므로 폼 로딩과 분리한다.
  // 실패해도 화면을 막지 않는다(권한 안내가 안 뜰 뿐, 저장·발송은 서버가 판정한다).
  useEffect(() => {
    getSmsStatus().then(setSmsStatus).catch(() => {});
  }, []);

  // 분야 자동완성 — 내 폼들의 기존 분야를 datalist 로. 손으로 치면 '개인회생'/'개인 회생'으로
  // 갈려 필터가 쪼개지므로, 같은 이름을 다시 고르기 쉽게 한다. 실패해도 입력 자체는 된다.
  useEffect(() => {
    listForms()
      .then((fs) => setCategoryOptions([...new Set(fs.map((f) => f.category).filter((c): c is string => !!c))]))
      .catch(() => {});
  }, []);

  // 광고주 접수 알림 수신 상태(V28). 새 리드폼은 아직 광고주를 붙일 수 없으므로 건너뛴다.
  // 실패해도 화면을 막지 않는다 — 안내가 안 뜰 뿐이다.
  useEffect(() => {
    if (isNew) return;
    getAdvertiserNotifyStatus(Number(id)).then(setNotifyStatus).catch(() => {});
  }, [id, isNew]);

  /**
   * 마케터 접수 문자 on/off. 켤 때 수신번호가 비어 있으면 내 계정 연락처를 채워 넣는다.
   *
   * 예전에는 빈 칸 + "비우면 내 계정 연락처" 안내였는데, 어디로 오는지 눈으로 확인할 수 없었다.
   * 값을 실제로 보여주면 곧바로 다른 번호로 고칠 수 있다(담당자별 운영).
   * 끌 때는 지우지 않는다 — 다시 켜면 아까 고쳐 둔 번호가 그대로 남아 있어야 한다.
   */
  function toggleSmsMarketer(on: boolean) {
    setSmsMarketerEnabled(on);
    if (on && !smsMarketerPhone.trim() && user?.phone) {
      setSmsMarketerPhone(user.phone);
    }
  }

  useEffect(() => {
    if (isNew) return;
    getForm(Number(id))
      .then((f) => {
        setName(f.name);
        setCategory(f.category ?? "");
        setFormType(f.formType);
        const items = f.consentConfig?.items as ConsentItem[] | undefined;
        setConsentItems(items && items.length ? items : defaultConsentItems());
        setSubmitLabel((f.submitButtonConfig?.label as string) || "무료 상담 신청");
        setButtonColor((f.styleConfig?.buttonColor as string) || "#12b886");
        setAccentColor((f.styleConfig?.accentColor as string) || "#3a43c0");
        const sc = f.successConfig;
        setSuccessMode((sc?.mode as "message" | "redirect") || "message");
        setSuccessTitle((sc?.title as string) || "신청이 완료되었습니다");
        setSuccessMessage((sc?.message as string) ?? "빠른 시일 내에 연락드리겠습니다.");
        setRedirectUrl((sc?.redirectUrl as string) || "");
        setRequirePhone(Boolean(f.requirePhoneVerification));
        setAllowSameIp(f.settingsConfig?.allowSameIp !== false);
        setIpDedupDays(Number(f.settingsConfig?.ipDedupDays) || 0);
        setAutoApproveEnabled(f.settingsConfig?.autoApproveEnabled === true);
        setAutoApproveDays(Number(f.settingsConfig?.autoApproveDays) || 7);
        setGoalEnabled(f.settingsConfig?.goalEnabled === true);
        setGoalDaily(Number(f.settingsConfig?.goalDaily) || 0);
        setGoalMonthly(Number(f.settingsConfig?.goalMonthly) || 0);
        setGoalStart((f.settingsConfig?.goalStart as string) || "");
        setGoalEnd((f.settingsConfig?.goalEnd as string) || "");
        setNotifyEnabled(f.settingsConfig?.notifyEnabled !== false);
        setSheetsEnabled(f.settingsConfig?.sheetsEnabled === true);
        setSmsMarketerEnabled(f.settingsConfig?.smsMarketerEnabled === true);
        setSmsAdvertiserEnabled(f.settingsConfig?.smsAdvertiserEnabled === true);
        setSmsLeadEnabled(f.settingsConfig?.smsLeadEnabled === true);
        setSmsLeadBody((f.settingsConfig?.smsLeadBody as string) || "");
        setSmsLeadPhoneVarKey((f.settingsConfig?.smsLeadPhoneVarKey as string) || "");
        // 예전에 켜 두고 번호는 비워 둔 리드폼도, 열었을 때 실제로 어디로 가는지 보이게 채워준다
        // (서버 폴백과 같은 값이라 동작은 그대로다).
        const savedMarketerPhone = (f.settingsConfig?.smsMarketerPhone as string) || "";
        setSmsMarketerPhone(
          !savedMarketerPhone && f.settingsConfig?.smsMarketerEnabled === true && user?.phone
            ? user.phone
            : savedMarketerPhone,
        );
        setSmsLeadImageId((f.settingsConfig?.smsLeadImageId as string) || "");
        setSheetsSpreadsheetId((f.settingsConfig?.sheetsSpreadsheetId as string) || "");
        setSheetsTabName((f.settingsConfig?.sheetsTabName as string) || "");
        setTracking(f.trackingConfig ?? null);
        const sorted = [...f.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
        if (f.formType === "STEP") {
          const choiceBlocks = sorted.filter((b) => b.blockType === "CHOICE");
          setSteps(
            choiceBlocks.map((b) => ({
              varKey: b.varKey ?? null,
              question: (b.content?.question as string) || "",
              description: (b.content?.description as string) || "",
              answerType: (b.content?.answerType as string) || (b.content?.selectType as string) || "single",
              placeholder: (b.content?.placeholder as string) || "",
              required: b.content?.required === true,
              options: ((b.content?.options as { label: string; desc: string; value?: string }[]) || []).map((o) => ({
                label: o.label ?? "",
                desc: o.desc ?? "",
                value: o.value,
              })),
              defaultIndex: typeof b.content?.defaultIndex === "number" ? (b.content.defaultIndex as number) : null,
              calcInput: (b.content?.calcInput as string) || null,
            })),
          );
          // 계산기 복원 — 정의가 사라진 키(계산기를 내린 경우)는 null 로 두어 일반 스텝형으로 열린다.
          const savedCalcKey = sorted.find((b) => b.blockType === "CALC")?.content?.calcKey as string | undefined;
          setCalcKey(findCalculator(savedCalcKey) ? savedCalcKey! : null);
          setContactFields(sorted.filter((b) => b.blockType === "FIELD"));
          setContactMessage((f.typeConfig?.contactMessage as string) || "");
        } else {
          setBlocks(sorted);
        }
      })
      .catch(() => setError("리드폼을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // 동의 항목의 '보기' 링크로 연결할 내 동의 문서 목록
  useEffect(() => {
    listConsentDocs().then(setConsentDocs).catch(() => {});
  }, []);

  // ---- 동의 항목 편집 ----
  function patchConsent(i: number, patch: Partial<ConsentItem>) {
    setConsentItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addConsent() {
    setConsentItems((prev) => [...prev, { title: "새 동의 항목", required: false, linkType: "none" }]);
  }
  function removeConsent(i: number) {
    setConsentItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- BASIC 블록 편집 ----
  function patchBlock(i: number, patch: Partial<FormBlock>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function patchBlockContent(i: number, patch: Record<string, unknown>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, content: { ...(b.content ?? {}), ...patch } } : b)));
  }
  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }
  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((prev) => swap(prev, i, i + dir));
  }

  // ---- STEP 편집 ----
  /**
   * 리드폼 종류 고르기. `kind` 는 "BASIC" | "STEP" | 계산기 key.
   *
   * 계산기를 고르면 질문 단계를 **덮어쓴다** — 이미 만들어둔 질문이 있으면 먼저 확인받는다.
   * 계산기에서 빠져나갈 때는 질문을 지우지 않고 계산기 표시(calcInput)만 뗀다(작업물 보존).
   */
  function pickKind(kind: string) {
    if (kind === "BASIC") {
      setFormType("BASIC");
      setCalcKey(null);
      return;
    }
    if (kind === "STEP") {
      setFormType("STEP");
      if (calcKey) setSteps((prev) => prev.map((s) => ({ ...s, calcInput: null })));
      setCalcKey(null);
      return;
    }
    const def = findCalculator(kind);
    if (!def) return;
    if (calcKey === kind) return;
    // 마케터가 직접 만든 질문이 남아 있으면 덮어쓰기 전에 묻는다.
    // 손대지 않은 씨앗 질문은 작업물이 아니므로 조용히 갈아치운다(새 폼에서 확인창이 뜨면 성가시다).
    const hasOwnSteps = !isPristineSteps(steps) && steps.some((s) => !s.calcInput && s.question.trim());
    if (hasOwnSteps && !window.confirm(`'${def.name}'에 필요한 질문으로 바꿉니다. 지금 만들어둔 질문은 사라집니다. 계속할까요?`)) {
      return;
    }
    setFormType("STEP");
    setCalcKey(kind);
    setSteps(stepsFromCalculator(def));
    if (!contactMessage.trim()) {
      setContactMessage("진단 결과를 전문 상담사가 자세히 설명해드립니다. 연락처를 남겨주세요.");
    }
  }

  function patchStep(i: number, patch: Partial<StepData>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { question: "새 질문", description: "", answerType: "single", placeholder: "", required: true, options: [{ label: "선택지 1", desc: "" }] },
    ]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((prev) => swap(prev, i, i + dir));
  }
  function patchOption(si: number, oi: number, patch: Partial<{ label: string; desc: string; value: string }>) {
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === si ? { ...s, options: s.options.map((o, oidx) => (oidx === oi ? { ...o, ...patch } : o)) } : s,
      ),
    );
  }
  function addOption(si: number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, options: [...s.options, { label: "", desc: "" }] } : s)),
    );
  }
  function removeOption(si: number, oi: number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === si ? { ...s, options: s.options.filter((_, oidx) => oidx !== oi) } : s)),
    );
  }

  // ---- 연락처 필드(STEP 마지막 단계) ----
  function patchContact(i: number, patch: Partial<FormBlock>) {
    setContactFields((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function addContact() {
    setContactFields((prev) => [...prev, { sortOrder: 0, blockType: "FIELD", fieldType: "text", label: "새 항목", required: false }]);
  }
  function removeContact(i: number) {
    setContactFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- 저장 데이터 조립 ----
  const builtBlocks: FormBlock[] =
    formType === "BASIC"
      ? blocks.map((b, i) => ({ ...b, sortOrder: i, stepNo: null }))
      : [
          ...steps.map((s, i) => ({
            sortOrder: i,
            stepNo: i,
            blockType: "CHOICE" as BlockType,
            varKey: s.varKey ?? null, // 기존 단계의 변수키 유지 — 새 단계는 서버가 발급한다
            content: {
              question: s.question,
              description: s.description,
              answerType: s.answerType,
              selectType: s.answerType === "multi" ? "multi" : "single", // 하위호환
              placeholder: s.placeholder,
              required: s.required,
              options: OPTION_ANSWER_TYPES.includes(s.answerType) ? s.options : [],
              // 기본 선택 — 선택지가 있는 유형에서만 의미가 있다. 선택지 밖의 인덱스는 저장하지 않는다.
              defaultIndex:
                OPTION_ANSWER_TYPES.includes(s.answerType)
                  && typeof s.defaultIndex === "number"
                  && s.options[s.defaultIndex] != null
                  ? s.defaultIndex
                  : null,
              // 계산기 입력 표시 — 공개 폼이 이 키로 답을 모아 계산한다(단계 순서를 바꿔도 안 깨진다).
              calcInput: s.calcInput ?? null,
            },
          })),
          // 계산기 블록은 질문 뒤·연락처 앞에 온다(결과를 보여준 다음 연락처를 받는다).
          // outputLabels 를 함께 저장하는 이유: 서버는 계산기 정의(프론트 TS)를 모르는데,
          // CSV·엑셀 내보내기 열 목록은 서버가 블록에서 만든다 → 이게 없으면 계산 결과 열이 빠진다.
          ...(calcKey
            ? [
                {
                  sortOrder: steps.length,
                  stepNo: steps.length,
                  blockType: "CALC" as BlockType,
                  content: { calcKey, outputLabels: calculator?.outputLabels ?? [] },
                },
              ]
            : []),
          ...contactFields.map((f, j) => ({
            ...f,
            stepNo: steps.length + (calcKey ? 1 : 0),
            sortOrder: steps.length + (calcKey ? 1 : 0) + j,
          })),
        ];

  // 문자 템플릿에 넣을 수 있는 변수 목록 — 서버가 변수키를 발급한(= 한 번 저장된) 답변 항목만 나온다.
  const answerBlocks = builtBlocks.filter(
    (b) => (b.blockType === "FIELD" || b.blockType === "CHOICE") && !!b.varKey,
  );
  // 국내 문자 과금 기준(EUC-KR): 한글 2byte. 90byte 를 넘으면 LMS 로 전환되어 단가가 오른다.
  const smsBytes = [...smsLeadBody].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x80 ? 1 : 2), 0);
  /**
   * 문자 설정을 잠글지. 권한 조회 전(null)에는 잠그지 않는다 — 권한 있는 계정에 "권한 없음"이
   * 깜빡이는 편이 더 나쁘다. 조회가 실패해도 잠기지 않는다(서버가 최종 관문이라 안전하다).
   */
  const smsBlocked = smsStatus !== null && !smsStatus.smsEnabled;

  /** 첨부 업로드 — 규격(JPG·200KB) 변환은 서버가 하므로 원본을 그대로 올린다. */
  async function onAttach(file: File) {
    setSmsAttachBusy(true);
    try {
      const r = await uploadSmsAttachment(file);
      setSmsLeadImageId(r.imageId);
      setSmsAttachPreview(URL.createObjectURL(file));
      toast.success(`첨부했습니다. (${Math.round(r.bytes / 1024)}KB 로 변환) 저장해야 적용됩니다.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "첨부에 실패했습니다.");
    } finally {
      setSmsAttachBusy(false);
    }
  }

  const formData: FormInput = {
    name,
    category: category.trim() || null,
    formType,
    requirePhoneVerification: requirePhone,
    consentConfig: { items: consentItems },
    submitButtonConfig: { label: submitLabel },
    successConfig: { mode: successMode, title: successTitle, message: successMessage, redirectUrl },
    styleConfig: { buttonColor, accentColor },
    typeConfig: { contactMessage },
    settingsConfig: {
      allowSameIp,
      ipDedupDays,
      autoApproveEnabled,
      autoApproveDays,
      goalEnabled,
      goalDaily,
      goalMonthly,
      goalStart,
      goalEnd,
      notifyEnabled,
      sheetsEnabled,
      smsMarketerEnabled,
      smsAdvertiserEnabled,
      smsLeadEnabled,
      smsLeadBody: smsLeadBody.trim(),
      smsLeadPhoneVarKey,
      smsMarketerPhone: smsMarketerPhone.replace(/[^0-9]/g, ""),
      // smsAdvertiserPhone 은 더 이상 보내지 않는다 — 광고주가 포털에서 직접 등록한다(V28).
      // 기존에 저장된 값은 서버가 읽지 않으므로 발송에 쓰이지 않는다.
      smsLeadImageId,
      sheetsSpreadsheetId: extractSpreadsheetId(sheetsSpreadsheetId),
      sheetsTabName: sheetsTabName.trim(),
    },
    trackingConfig: tracking ?? undefined,
    blocks: builtBlocks,
  };

  async function onSave() {
    setError("");
    setSaving(true);
    try {
      if (isNew) await createForm(formData);
      else await updateForm(Number(id), formData);
      toast.success(isNew ? "리드폼을 만들었습니다." : "리드폼을 저장했습니다.");
      navigate("/forms");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function onTestSheets() {
    if (isNew) return;
    setSheetTest(null);
    setSheetTesting(true);
    try {
      const r = await testFormSheets(Number(id));
      if (r.results.length === 0) {
        setSheetTest({ ok: false, text: "구글시트가 켜져 있고 웹앱 URL 이 저장돼 있어야 테스트됩니다. 저장 후 다시 시도하세요." });
      } else {
        const s = r.results[0];
        setSheetTest({ ok: s.ok, text: s.ok ? "전송 성공 — 시트에 테스트 행이 추가됐는지 확인하세요." : s.message });
      }
    } catch (err) {
      setSheetTest({ ok: false, text: err instanceof ApiError ? err.message : "테스트에 실패했습니다." });
    } finally {
      setSheetTesting(false);
    }
  }

  if (loading) return <Loading full />;

  return (
    <div className="app-shell">
      <TopBar />
      <main className="wrap form-edit">
        <div className="dash-head">
          <div>
            <p className="eyebrow">{isNew ? "새 리드폼" : "리드폼 편집"}</p>
            <input className="input form-name" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span className="dash-sub" style={{ fontSize: 12.5, flex: "none" }}>분야</span>
              <input
                className="input"
                style={{ width: 180, fontSize: 13.5, padding: "6px 10px" }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: 개인회생"
                maxLength={50}
                list="form-category-options"
                title="업종 구분(개인회생·장기렌트 등). 지정한 이후 접수되는 리드부터 새겨지며, 인박스에서 이 분야로 걸러 볼 수 있습니다. 기존 리드는 인박스에서 체크해 일괄 지정하세요"
              />
              <datalist id="form-category-options">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={() => navigate("/forms")}>취소</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}>
              {saving ? "저장 중…" : "리드폼 저장"}
            </button>
          </div>
        </div>

        {/* 리드폼 종류 — 계산기도 하나의 종류로 보인다(내부적으로는 STEP + CALC 블록) */}
        <div className="calc-kind-grid" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`calc-kind ${formType === "BASIC" ? "sel" : ""}`}
            onClick={() => pickKind("BASIC")}
          >
            <span className="calc-kind-name">기본형</span>
            <span className="calc-kind-desc">한 화면에 항목을 쭉 나열합니다. 가장 단순합니다.</span>
          </button>
          <button
            type="button"
            className={`calc-kind ${formType === "STEP" && !calcKey ? "sel" : ""}`}
            onClick={() => pickKind("STEP")}
          >
            <span className="calc-kind-name">스텝형</span>
            <span className="calc-kind-desc">질문을 한 번에 하나씩 물어보고 마지막에 연락처를 받습니다.</span>
          </button>
          {CALCULATORS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`calc-kind ${calcKey === c.key ? "sel" : ""}`}
              onClick={() => pickKind(c.key)}
            >
              <span className="calc-kind-name">🧮 {c.name}</span>
              <span className="calc-kind-desc">{c.description}</span>
            </button>
          ))}
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="edit-grid">
          <div className="edit-panel">
            {formType === "BASIC" ? (
              <div className="card card-pad" {...sec("blocks")}>
                <SectionHead title="본문 블록" open={!collapsed.blocks} onToggle={() => toggleSection("blocks")} />
                {blocks.map((b, i) => (
                  <div className="block-editor" key={i}>
                    <div className="block-editor-head">
                      <span className="pill">{blockTypeLabel(b.blockType)}</span>
                      <div className="block-editor-ctrl">
                        <button className="btn btn-ghost btn-sm" onClick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => removeBlock(i)}>삭제</button>
                      </div>
                    </div>
                    <BlockFields block={b} onPatch={(p) => patchBlock(i, p)} onContent={(p) => patchBlockContent(i, p)} />
                  </div>
                ))}
                <div className="add-block-row">
                  <button className="btn btn-ghost btn-sm" onClick={() => addBlock("FIELD")}>+ 입력 항목</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => addBlock("IMAGE")}>+ 이미지</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => addBlock("HTML")}>+ HTML</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => addBlock("TEXT")}>+ 텍스트</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => addBlock("DIVIDER")}>+ 구분선</button>
                </div>
              </div>
            ) : (
              <>
                <div className="card card-pad" {...sec("steps")}>
                  <SectionHead title="질문 단계" open={!collapsed.steps} onToggle={() => toggleSection("steps")} />
                  {calculator && !collapsed.steps && (
                    <div className="calc-info" style={{ marginBottom: 12 }}>
                      <strong>{calculator.name}</strong>에 필요한 질문이 자동으로 만들어졌습니다.
                      질문 문구·설명은 자유롭게 고쳐도 되지만, <strong>보라색 배지가 붙은 단계는 계산에 쓰이므로
                      지우거나 답변 방식을 바꾸면 결과가 틀어집니다.</strong>
                      <br />
                      질문 뒤에 <strong>계산 결과 단계</strong>가 자동으로 붙고, 그 다음이 연락처 단계입니다.
                      <br />
                      계산 결과는 리드에 함께 저장되어 <strong>구글시트 열·문자/알림톡 변수</strong>(
                      <code>{"{{예상 탕감액}}"}</code>)로 바로 쓸 수 있고, <strong>픽셀</strong>도 그대로 동작합니다.
                    </div>
                  )}
                  {steps.map((s, i) => (
                    <div className="block-editor" key={i}>
                      <div className="block-editor-head">
                        <span className="pill i">단계 {i + 1}</span>
                        {s.calcInput && <span className="calc-input-badge">계산 입력</span>}
                        <div className="block-editor-ctrl">
                          <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</button>
                          <button className="btn btn-ghost btn-sm danger" onClick={() => removeStep(i)} disabled={steps.length === 1}>삭제</button>
                        </div>
                      </div>
                      <div className="field">
                        <label>질문</label>
                        <input className="input" value={s.question} onChange={(e) => patchStep(i, { question: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>설명(선택)</label>
                        <input className="input" value={s.description} onChange={(e) => patchStep(i, { description: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>답변 방식</label>
                        {/* 계산 입력은 답변 방식을 잠근다 — 숫자 입력을 장문으로 바꾸면 계산이 조용히 깨진다. */}
                        <select
                          className="input"
                          value={s.answerType}
                          disabled={!!s.calcInput}
                          onChange={(e) => patchStep(i, { answerType: e.target.value })}
                        >
                          {ANSWER_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        {s.calcInput && <span className="calc-lock-hint">계산에 쓰이는 단계라 답변 방식은 고정입니다.</span>}
                      </div>
                      <label className="fr-check" style={{ marginBottom: 10 }}>
                        <input type="checkbox" checked={s.required} onChange={(e) => patchStep(i, { required: e.target.checked })} /> 필수 (답해야 다음 단계로 진행)
                      </label>
                      {OPTION_ANSWER_TYPES.includes(s.answerType) ? (
                        <>
                          <label className="mini-label">선택지</label>
                          {s.options.map((o, oi) => (
                            <div className="opt-row" key={oi}>
                              <input className="input" placeholder="선택지 제목" value={o.label} onChange={(e) => patchOption(i, oi, { label: e.target.value })} />
                              {s.answerType !== "select" && (
                                <input className="input" placeholder="설명(선택)" value={o.desc} onChange={(e) => patchOption(i, oi, { desc: e.target.value })} />
                              )}
                              {/* 계산 입력의 선택지는 계산에 들어가는 숫자를 따로 갖는다 — 비면 계산이 0으로 처리된다. */}
                              {s.calcInput && (
                                <input
                                  className="input"
                                  style={{ maxWidth: 110 }}
                                  placeholder="계산값"
                                  value={o.value ?? ""}
                                  onChange={(e) => patchOption(i, oi, { value: e.target.value })}
                                />
                              )}
                              <button className="btn btn-ghost btn-sm danger" onClick={() => removeOption(i, oi)}>×</button>
                            </div>
                          ))}
                          <button className="btn btn-ghost btn-sm" onClick={() => addOption(i)}>+ 선택지</button>
                          <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                            <label>기본 선택</label>
                            <select
                              className="input"
                              value={s.defaultIndex ?? ""}
                              onChange={(e) => patchStep(i, { defaultIndex: e.target.value === "" ? null : Number(e.target.value) })}
                            >
                              <option value="">없음 (미리 선택하지 않음)</option>
                              {s.options.map((o, oi) => (
                                <option key={oi} value={oi}>{o.label || `선택지 ${oi + 1}`}</option>
                              ))}
                            </select>
                            <span className="field-optional" style={{ marginTop: 4 }}>
                              방문자에게 미리 선택된 상태로 보입니다. 그대로 두면 그 값으로 접수됩니다.
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="field">
                          <label>플레이스홀더(선택)</label>
                          <input className="input" value={s.placeholder} onChange={(e) => patchStep(i, { placeholder: e.target.value })} />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="add-block-row">
                    <button className="btn btn-ghost btn-sm" onClick={addStep}>+ 단계 추가</button>
                  </div>
                </div>

                <div className="card card-pad" style={{ marginTop: 16 }} {...sec("contact")}>
                  <SectionHead title="마지막 단계 · 연락처" open={!collapsed.contact} onToggle={() => toggleSection("contact")} />
                  <div className="field">
                    <label>상단 안내 문구(선택)</label>
                    <input className="input" placeholder="예: 마지막 정보를 입력하면 분석 내용을 바로 보내드립니다!" value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} />
                  </div>
                  {contactFields.map((b, i) => (
                    <div className="block-editor" key={i}>
                      <div className="block-editor-head">
                        <span className="pill">입력 항목</span>
                        <button className="btn btn-ghost btn-sm danger" onClick={() => removeContact(i)}>삭제</button>
                      </div>
                      <BlockFields block={b} onPatch={(p) => patchContact(i, p)} onContent={() => {}} />
                    </div>
                  ))}
                  <div className="add-block-row">
                    <button className="btn btn-ghost btn-sm" onClick={addContact}>+ 입력 항목</button>
                  </div>
                </div>
              </>
            )}

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("consent")}>
              <SectionHead title="동의 항목" open={!collapsed.consent} onToggle={() => toggleSection("consent")} />
              {consentItems.map((it, i) => (
                <div className="block-editor" key={i}>
                  <div className="block-editor-head">
                    <input
                      className="input"
                      style={{ flex: 1, marginRight: 8 }}
                      value={it.title}
                      onChange={(e) => patchConsent(i, { title: e.target.value })}
                    />
                    <button className="btn btn-ghost btn-sm danger" onClick={() => removeConsent(i)}>삭제</button>
                  </div>
                  <div className="block-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label className="fr-check">
                      <input type="checkbox" checked={it.required} onChange={(e) => patchConsent(i, { required: e.target.checked })} /> 필수
                    </label>
                    <label className="fr-check">
                      <input type="checkbox" checked={Boolean(it.defaultChecked)} onChange={(e) => patchConsent(i, { defaultChecked: e.target.checked })} /> 기본 체크
                    </label>
                    <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 140 }}>
                      <label>보기 링크</label>
                      <select
                        className="input"
                        value={it.linkType}
                        onChange={(e) => patchConsent(i, { linkType: e.target.value as ConsentItem["linkType"] })}
                      >
                        <option value="none">없음</option>
                        <option value="external">외부 URL</option>
                        <option value="document">동의 문서</option>
                      </select>
                    </div>
                  </div>
                  {it.linkType === "external" && (
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>URL</label>
                      <input className="input" placeholder="https://…" value={it.url ?? ""} onChange={(e) => patchConsent(i, { url: e.target.value })} />
                    </div>
                  )}
                  {it.linkType === "document" && (
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>연결할 동의 문서</label>
                      <select
                        className="input"
                        value={it.documentId ?? ""}
                        onChange={(e) => patchConsent(i, { documentId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">문서 선택…</option>
                        {consentDocs.map((d) => (
                          <option key={d.id} value={d.id}>{d.title}</option>
                        ))}
                      </select>
                      <span className="field-optional" style={{ marginTop: 4 }}>
                        <Link to="/consent-docs/new" target="_blank">+ 새 동의 문서 만들기</Link>
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <div className="add-block-row">
                <button className="btn btn-ghost btn-sm" onClick={addConsent}>+ 동의 항목</button>
              </div>
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("submit")}>
              <SectionHead title="제출" open={!collapsed.submit} onToggle={() => toggleSection("submit")} />
              <div className="field">
                <label>제출 버튼 문구</label>
                <input className="input" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
              </div>
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("design")}>
              <SectionHead title="디자인 · 색상" open={!collapsed.design} onToggle={() => toggleSection("design")} />
              <ColorField label="제출 버튼 색" value={buttonColor} onChange={setButtonColor} />
              <ColorField label="리드폼 포인트 색 (진행바·선택·강조)" value={accentColor} onChange={setAccentColor} />
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("success")}>
              <SectionHead title="제출 완료 후" open={!collapsed.success} onToggle={() => toggleSection("success")} />
              <div className="field">
                <label>완료 처리</label>
                <select className="input" value={successMode} onChange={(e) => setSuccessMode(e.target.value as "message" | "redirect")}>
                  <option value="message">감사 메시지 표시</option>
                  <option value="redirect">다른 링크로 이동</option>
                </select>
              </div>
              {successMode === "message" ? (
                <>
                  <div className="field">
                    <label>완료 제목</label>
                    <input className="input" value={successTitle} onChange={(e) => setSuccessTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>안내 문구</label>
                    <textarea className="input" rows={2} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="field">
                  <label>이동할 URL</label>
                  <input className="input" placeholder="https://…" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
                </div>
              )}
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("options")}>
              <SectionHead title="옵션" open={!collapsed.options} onToggle={() => toggleSection("options")} />
              <label className="fr-check">
                <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} /> 휴대폰 본인인증 사용
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                켜면 제출 시 본인인증을 요구합니다. (외부 인증 연동은 추후 제공 — 지금은 옵션 자리)
              </p>
              <div className="dedup-row" style={{ marginTop: 14 }}>
                <label className="fr-check">
                  <input type="checkbox" checked={allowSameIp} onChange={(e) => setAllowSameIp(e.target.checked)} /> 동일 IP 접수 허용
                </label>
                {!allowSameIp && (
                  <div className="dedup-days">
                    <span className="dedup-days-label">차단</span>
                    <input className="input dedup-days-input" type="number" min={0} value={ipDedupDays} onChange={(e) => setIpDedupDays(Number(e.target.value) || 0)} />
                    <span className="dedup-days-label">일 (0=전체)</span>
                  </div>
                )}
              </div>
              <div className="dedup-row" style={{ marginTop: 14 }}>
                <label className="fr-check">
                  <input
                    type="checkbox"
                    checked={autoApproveEnabled}
                    onChange={(e) => setAutoApproveEnabled(e.target.checked)}
                  />{" "}
                  자동 승인 기간 사용
                </label>
                {autoApproveEnabled && (
                  <div className="dedup-days">
                    <span className="dedup-days-label">접수 후</span>
                    <input
                      className="input dedup-days-input"
                      type="number"
                      min={1}
                      max={3650}
                      value={autoApproveDays}
                      onChange={(e) => setAutoApproveDays(Number(e.target.value) || 1)}
                    />
                    <span className="dedup-days-label">일</span>
                  </div>
                )}
              </div>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                {autoApproveEnabled ? (
                  <>
                    접수 후 <b>{autoApproveDays}일</b>이 지나도 <b>신규·상담중</b>인 리드를 자동으로 <b>완료</b>로 넘깁니다.
                    리드 이력에 자동 메모가 남고, <b>불량·이미 완료·휴지통</b> 리드는 건드리지 않습니다.
                    <br />
                    <b>지금 쌓여 있는 리드에는 적용되지 않습니다</b> — 저장 이후 접수된 리드부터 대상입니다.
                    (껐다 다시 켜면 그 시점부터 새로 시작합니다)
                  </>
                ) : (
                  <>켜면 오래 방치된 리드를 지정한 일수 뒤에 자동으로 완료 처리합니다. 끄면 자동 처리를 하지 않습니다.</>
                )}
              </p>
              <label className="fr-check" style={{ marginTop: 14 }}>
                <input type="checkbox" checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} /> 텔레그램 알림 받기
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                이 리드폼에 접수되면 <b>연동</b> 메뉴에 설정한 <b>계정 텔레그램</b>으로 알림을 보냅니다. (계정 텔레그램이 켜져 있어야 발송)
              </p>

              {/* 목표(2026-08-09) — 일간/월간 목표 + 기간. 달성 현황은 '목표' 메뉴 보고서에서. */}
              <label className="fr-check" style={{ marginTop: 14 }}>
                <input type="checkbox" checked={goalEnabled} onChange={(e) => setGoalEnabled(e.target.checked)} /> 수집 목표 설정
              </label>
              {goalEnabled && (
                <div style={{ display: "grid", gap: 10, maxWidth: 620, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <label className="field" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                      <span className="field-label">일간 목표 (건)</span>
                      <input className="input" type="number" min={0} value={goalDaily}
                        onChange={(e) => setGoalDaily(Math.max(0, Number(e.target.value) || 0))} placeholder="0 = 없음" />
                    </label>
                    <label className="field" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                      <span className="field-label">월간 목표 (건)</span>
                      <input className="input" type="number" min={0} value={goalMonthly}
                        onChange={(e) => setGoalMonthly(Math.max(0, Number(e.target.value) || 0))} placeholder="0 = 없음" />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <label className="field" style={{ flex: "1 1 150px", marginBottom: 0 }}>
                      <span className="field-label">시작일</span>
                      <input className="input" type="date" value={goalStart} max={goalEnd || undefined}
                        onChange={(e) => setGoalStart(e.target.value)} />
                    </label>
                    <label className="field" style={{ flex: "1 1 150px", marginBottom: 0 }}>
                      <span className="field-label">종료일</span>
                      <input className="input" type="date" value={goalEnd} min={goalStart || undefined}
                        onChange={(e) => setGoalEnd(e.target.value)} />
                    </label>
                  </div>
                  <p className="dash-sub" style={{ margin: 0, fontSize: 12 }}>
                    기간·목표를 채우면 <b>목표</b> 메뉴에서 일별/월별 달성 보고서를 볼 수 있습니다.
                    (일간·월간 중 하나만 채워도 됩니다. 광고주 정산의 일 목표 문자 알림과는 별개입니다)
                  </p>
                </div>
              )}
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("sms")}>
              <SectionHead title="접수 알림 발송 (이 리드폼)" open={!collapsed.sms} onToggle={() => toggleSection("sms")} />
              {/* 권한이 없으면 켜봐야 서버가 저장 시점에 다시 꺼버린다(FormService.sanitizeSmsSettings).
                  그러면 "켰는데 안 나간다"가 되므로, 아예 잠그고 이유를 먼저 보여준다. */}
              {smsBlocked ? (
                <p className="auth-error" style={{ marginBottom: 12 }}>
                  이 계정은 <b>문자 발송 권한이 없습니다.</b> 아래 설정은 <b>운영자가 권한을 열어줘야</b> 사용할 수 있습니다.
                  필요하시면 운영자에게 문의해주세요.
                </p>
              ) : (
                <p className="dash-sub" style={{ marginBottom: 12 }}>
                  건당 비용이 발생하므로 기본은 모두 꺼져 있습니다. 발신번호·잔액·이번 달 사용량은{" "}
                  <Link to="/sms">문자 발송</Link> 메뉴에서 확인하세요.
                </p>
              )}

              <label className="fr-check">
                <input type="checkbox" disabled={smsBlocked} checked={smsMarketerEnabled} onChange={(e) => toggleSmsMarketer(e.target.checked)} /> 나(마케터)에게 접수 <b>알림톡</b> 받기
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                개인정보는 넣지 않고 <b>접수 사실·리드폼 이름·미확인 건수만</b> 카카오톡으로 보냅니다.
                본문은 카카오 심사본으로 고정이라 편집할 수 없습니다.
              </p>
              {smsMarketerEnabled && (
                <label className="field" style={{ maxWidth: 320, marginTop: 10 }}>
                  <span className="field-label">받을 번호</span>
                  <input
                    className="input"
                    disabled={smsBlocked}
                    value={smsMarketerPhone}
                    onChange={(e) => setSmsMarketerPhone(e.target.value)}
                    placeholder="비우면 내 계정 연락처"
                  />
                  <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                    내 계정 연락처가 기본으로 채워집니다. <b>이 리드폼만 다른 번호</b>로 받으려면 고쳐주세요(담당자별 운영).
                  </span>
                </label>
              )}

              <label className="fr-check" style={{ marginTop: 14 }}>
                <input type="checkbox" disabled={smsBlocked} checked={smsAdvertiserEnabled} onChange={(e) => setSmsAdvertiserEnabled(e.target.checked)} /> 광고주에게 접수 <b>알림톡</b> 보내기
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                <b>여기서 켜기만 하고, 받을 번호는 광고주가 직접 등록합니다.</b> 남의 번호를 대신 넣으면
                수신 동의 근거가 없어 신고 시 발송 채널 전체가 막힙니다.
              </p>
              {smsAdvertiserEnabled && <AdvertiserNotifyNotice status={notifyStatus} />}

              <label className="fr-check" style={{ marginTop: 14 }}>
                <input type="checkbox" disabled={smsBlocked} checked={smsLeadEnabled} onChange={(e) => setSmsLeadEnabled(e.target.checked)} /> 고객(접수자)에게 문자 보내기
              </label>
              {smsLeadEnabled && (
                <div style={{ display: "grid", gap: 12, maxWidth: 620, marginTop: 10 }}>
                  <label className="field">
                    <span className="field-label">수신 번호로 쓸 항목</span>
                    <select className="input" disabled={smsBlocked} value={smsLeadPhoneVarKey} onChange={(e) => setSmsLeadPhoneVarKey(e.target.value)}>
                      <option value="">자동 (첫 연락처 항목)</option>
                      {answerBlocks.map((b) => (
                        <option key={b.varKey as string} value={b.varKey as string}>
                          {blockLabel(b)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">문자 내용</span>
                    <textarea
                      className="input"
                      rows={5}
                      disabled={smsBlocked}
                      value={smsLeadBody}
                      onChange={(e) => setSmsLeadBody(e.target.value)}
                      placeholder={"{{f1}} 님, 접수해주셔서 감사합니다.\n빠르게 확인하여 연락드리겠습니다."}
                    />
                    <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                      {smsLeadImageId
                        ? `${smsBytes} byte · 첨부가 있어 MMS 로 전환 (건당 110원)`
                        : smsBytes <= 90
                          ? `${smsBytes}/90 byte · SMS (건당 18원)`
                          : `${smsBytes} byte · LMS 로 전환 (건당 45원)`}
                      {" — 한글은 2byte 로 계산됩니다."}
                    </span>
                  </label>

                  <div className="field">
                    <span className="field-label">첨부 이미지 (선택)</span>
                    {smsLeadImageId ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {smsAttachPreview ? (
                          <img
                            src={smsAttachPreview}
                            alt="첨부 미리보기"
                            style={{ width: 96, borderRadius: 8, border: "1px solid var(--border)" }}
                          />
                        ) : (
                          <span className="dash-sub">첨부된 이미지가 있습니다.</span>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={smsBlocked}
                          onClick={() => {
                            setSmsLeadImageId("");
                            setSmsAttachPreview("");
                          }}
                        >
                          첨부 제거
                        </button>
                      </div>
                    ) : (
                      <input
                        className="input"
                        type="file"
                        accept="image/*"
                        disabled={smsAttachBusy || smsBlocked}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onAttach(f);
                          e.target.value = "";
                        }}
                      />
                    )}
                    <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                      명함 사진을 그대로 올리면 됩니다 — <b>JPG·200KB 규격은 서버가 맞춥니다.</b>{" "}
                      첨부하면 <b>MMS(건당 110원)</b> 로 나갑니다. PDF 는 문자에 붙일 수 없습니다.
                    </span>
                  </div>
                  {answerBlocks.length > 0 && (
                    <div>
                      <span className="field-label" style={{ display: "block", marginBottom: 6 }}>
                        변수 넣기 (클릭하면 커서 위치 대신 끝에 추가됩니다)
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {answerBlocks.map((b) => (
                          <button
                            key={b.varKey as string}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={smsBlocked}
                            onClick={() => setSmsLeadBody((prev) => `${prev}{{${b.varKey}}}`)}
                          >
                            {blockLabel(b)}
                          </button>
                        ))}
                        {/* 계산 결과 변수 — 변수키가 아니라 항목명으로 치환된다(TemplateRenderer 가 label 로도 색인한다). */}
                        {calculator?.outputLabels.map((label) => (
                          <button
                            key={label}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={smsBlocked}
                            onClick={() => setSmsLeadBody((prev) => `${prev}{{${label}}}`)}
                          >
                            🧮 {label}
                          </button>
                        ))}
                        <button type="button" className="btn btn-ghost btn-sm" disabled={smsBlocked} onClick={() => setSmsLeadBody((prev) => `${prev}{{form.name}}`)}>
                          리드폼 이름
                        </button>
                      </div>
                      <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                        항목명을 나중에 바꿔도 문자는 그대로 동작합니다. 단 <b>항목을 삭제하면</b> 그 변수는 빈칸으로 나갑니다.
                        {calculator && <> 🧮 표시는 계산 결과입니다.</>}
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* 광고주 정산(V31) — 단가·충전·목표. 새 리드폼은 아직 광고주를 붙일 수 없어 저장 후 보인다. */}
            {!isNew && <AdvertiserBillingCard formId={Number(id)} />}

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("sheets")}>
              <SectionHead title="구글시트 연동 (이 리드폼)" open={!collapsed.sheets} onToggle={() => toggleSection("sheets")} />
              <label className="fr-check">
                <input type="checkbox" checked={sheetsEnabled} onChange={(e) => setSheetsEnabled(e.target.checked)} /> 이 리드폼의 리드를 구글시트로 자동 기록
              </label>
              <p className="dash-sub" style={{ marginTop: 6 }}>
                리드폼마다 다른 시트로 보낼 수 있습니다. 시트 준비 방법(서비스 계정을 편집자로 추가)은 <Link to="/integrations">연동</Link> 메뉴 참고.
              </p>
              {sheetsEnabled && (
                <div className="form-grid" style={{ display: "grid", gap: 12, maxWidth: 620, marginTop: 8 }}>
                  <label className="field">
                    <span className="field-label">구글시트 주소</span>
                    <input
                      className="input"
                      value={sheetsSpreadsheetId}
                      onChange={(e) => setSheetsSpreadsheetId(e.target.value)}
                      onBlur={(e) => setSheetsSpreadsheetId(extractSpreadsheetId(e.target.value))}
                      placeholder="https://docs.google.com/spreadsheets/d/... (주소 그대로 붙여넣기)"
                    />
                    <span className="dash-sub" style={{ fontSize: 12, marginTop: 4 }}>
                      주소를 붙여넣으면 시트 ID 만 저장됩니다. 그 시트의 <b>공유</b>에 <Link to="/integrations">연동</Link> 메뉴의 서비스 계정 이메일이 <b>편집자</b>로 추가돼 있어야 합니다.
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">탭 이름 (선택)</span>
                    <input
                      className="input"
                      value={sheetsTabName}
                      onChange={(e) => setSheetsTabName(e.target.value)}
                      placeholder="비우면 맨 앞 탭에 기록"
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/*
                      시트로 이동 — 저장된 ID 가 아니라 지금 입력칸의 값으로 연다.
                      저장 전에도 "이 시트가 맞나"를 바로 확인할 수 있어야 한다(오타·다른 시트 붙여넣기 방지).
                    */}
                    {extractSpreadsheetId(sheetsSpreadsheetId) && (
                      <a
                        className="btn btn-ghost btn-sm"
                        href={`https://docs.google.com/spreadsheets/d/${extractSpreadsheetId(sheetsSpreadsheetId)}/edit`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        시트로 이동 ↗
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={onTestSheets}
                      disabled={isNew || sheetTesting}
                      title={isNew ? "먼저 저장하세요" : ""}
                    >
                      {sheetTesting ? "테스트 중…" : "시트 테스트 발송"}
                    </button>
                    {isNew && <span className="dash-sub" style={{ fontSize: 12 }}>저장 후 테스트할 수 있어요.</span>}
                    {sheetTest && (
                      <span className={`badge ${sheetTest.ok ? "b-normal" : "b-bad"}`} style={{ maxWidth: 420 }}>
                        {sheetTest.text}
                      </span>
                    )}
                  </div>
                  <span className="dash-sub" style={{ fontSize: 12 }}>
                    ※ 방금 바꾼 주소/탭으로 테스트하려면 <b>먼저 저장</b>하세요(테스트는 저장된 값 기준).
                  </span>
                </div>
              )}
            </div>

            <div className="card card-pad" style={{ marginTop: 16 }} {...sec("pixels")}>
              <SectionHead title="광고 픽셀 (선택)" open={!collapsed.pixels} onToggle={() => toggleSection("pixels")} />
              <PixelFields value={tracking} onChange={setTracking} />
            </div>
          </div>

          <div className="preview-panel">
            <div className="card-h">미리보기</div>
            <div className="preview-frame">
              {requirePhone && <div className="phone-verify-note">🔒 제출 시 휴대폰 본인인증 필요</div>}
              <FormRenderer form={formData} />
            </div>
            {/* 계산기 폼은 접수 후 '완료 안내' 대신 계산 결과가 나온다 — 미리보기도 그걸 보여준다. */}
            <div className="card-h" style={{ marginTop: 18 }}>{calculator ? "접수 후 결과 화면" : "완료 화면"}</div>
            <div className="preview-frame">
              {calculator ? (
                <div className="calc-result-screen">
                  <CalcResultView
                    view={calculator.run(calculator.sampleInput)}
                    disclaimer={calculator.disclaimer}
                    accentColor={accentColor}
                  />
                  <CalcFollowUp text={calculator.followUp} />
                </div>
              ) : (
                <CompletionView config={formData.successConfig} accent={accentColor} />
              )}
            </div>
            {calculator && (
              <p className="dash-sub" style={{ fontSize: 12, marginTop: 6 }}>
                * 예시 값으로 그린 화면입니다. 실제 숫자는 방문자가 입력한 답변으로 계산됩니다.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function blockTypeLabel(t: BlockType): string {
  return { FIELD: "입력 항목", IMAGE: "이미지", HTML: "HTML", TEXT: "텍스트", DIVIDER: "구분선", SPACER: "여백", CHOICE: "선택지", CALC: "계산기" }[t];
}

const COLOR_PRESETS = ["#12b886", "#3a43c0", "#f04452", "#f5a524", "#0ea5e9", "#14172a"];

/** 색상 선택 — 프리셋 스와치 + 커스텀 hex. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <label className="mini-label">{label}</label>
      <div className="color-row">
        <div className="swatches">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch-btn ${value.toLowerCase() === c ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              aria-label={c}
            />
          ))}
        </div>
        <input type="color" className="color-input" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input hex-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/** 항목별 중복 방지 설정: 중복 허용 여부 + 유효 기간(일). block.options 에 저장. */
function DedupField({ block, onPatch }: { block: FormBlock; onPatch: (p: Partial<FormBlock>) => void }) {
  const allow = block.options?.allowDuplicate !== false; // 기본 허용
  const dedupDays = Number(block.options?.dedupDays) || 0;
  function patchOpt(patch: Record<string, unknown>) {
    onPatch({ options: { ...(block.options ?? {}), ...patch } });
  }
  return (
    <div className="select-choices">
      <div className="dedup-row">
        <label className="fr-check">
          <input type="checkbox" checked={allow} onChange={(e) => patchOpt({ allowDuplicate: e.target.checked })} /> 중복 허용
        </label>
        {!allow && (
          <div className="dedup-days">
            <span className="dedup-days-label">중복 방지</span>
            <input className="input dedup-days-input" type="number" min={0} value={dedupDays}
              onChange={(e) => patchOpt({ dedupDays: Number(e.target.value) || 0 })} />
            <span className="dedup-days-label">일 (0=전체)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 선택박스(select) 필드의 선택지 목록 편집. block.options.choices(string[]) 에 저장. */
function SelectChoicesEditor({ block, onPatch }: { block: FormBlock; onPatch: (p: Partial<FormBlock>) => void }) {
  const choices = ((block.options?.choices as string[]) ?? []);
  const defaultIndex = typeof block.options?.defaultIndex === "number" ? (block.options.defaultIndex as number) : null;
  function setChoices(next: string[]) {
    onPatch({ options: { ...(block.options ?? {}), choices: next } });
  }
  function setDefaultIndex(next: number | null) {
    onPatch({ options: { ...(block.options ?? {}), defaultIndex: next } });
  }
  return (
    <div className="select-choices">
      <label className="mini-label">선택지 목록</label>
      {choices.map((c, i) => (
        <div className="opt-row" key={i}>
          <input
            className="input"
            placeholder={`선택지 ${i + 1}`}
            value={c}
            onChange={(e) => setChoices(choices.map((x, idx) => (idx === i ? e.target.value : x)))}
          />
          <button className="btn btn-ghost btn-sm danger" type="button" onClick={() => setChoices(choices.filter((_, idx) => idx !== i))}>×</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setChoices([...choices, ""])}>+ 선택지</button>
      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
        <label>기본 선택</label>
        <select
          className="input"
          value={defaultIndex ?? ""}
          onChange={(e) => setDefaultIndex(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">없음 (미리 선택하지 않음)</option>
          {choices.map((c, i) => (
            <option key={i} value={i}>{c || `선택지 ${i + 1}`}</option>
          ))}
        </select>
        <span className="field-optional" style={{ marginTop: 4 }}>
          방문자에게 미리 선택된 상태로 보입니다. 그대로 두면 그 값으로 접수됩니다.
        </span>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onPatch,
  onContent,
}: {
  block: FormBlock;
  onPatch: (p: Partial<FormBlock>) => void;
  onContent: (p: Record<string, unknown>) => void;
}) {
  switch (block.blockType) {
    case "FIELD":
      return (
        <div className="block-fields">
          <div className="field">
            <label>항목 이름</label>
            <input className="input" value={block.label ?? ""} onChange={(e) => onPatch({ label: e.target.value })} />
          </div>
          <div className="block-row">
            <div className="field" style={{ flex: 1 }}>
              <label>유형</label>
              <select className="input" value={block.fieldType ?? "text"} onChange={(e) => onPatch({ fieldType: e.target.value })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <label className="fr-check" style={{ alignSelf: "flex-end", paddingBottom: 10 }}>
              <input type="checkbox" checked={Boolean(block.required)} onChange={(e) => onPatch({ required: e.target.checked })} /> 필수
            </label>
          </div>
          <div className="field">
            <label>플레이스홀더</label>
            <input className="input" value={block.placeholder ?? ""} onChange={(e) => onPatch({ placeholder: e.target.value })} />
          </div>
          {block.fieldType === "select" && <SelectChoicesEditor block={block} onPatch={onPatch} />}
          <DedupField block={block} onPatch={onPatch} />
        </div>
      );
    case "IMAGE":
      return (
        <ImageUploadField
          url={(block.content?.url as string) ?? ""}
          alt={(block.content?.alt as string) ?? ""}
          onChange={onContent}
        />
      );
    case "HTML": {
      const curHtml = (block.content?.html as string) ?? "";
      return (
        <div className="field">
          <label>HTML</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <HtmlComponentPicker onInsert={(h) => onContent({ html: curHtml.trim() ? `${curHtml}\n${h}` : h })} />
            <HtmlImageUploadButton type="form" onInsert={(h) => onContent({ html: curHtml.trim() ? `${curHtml}\n${h}` : h })} />
          </div>
          <textarea className="input" rows={3} value={curHtml} onChange={(e) => onContent({ html: e.target.value })} />
        </div>
      );
    }
    case "TEXT":
      return (
        <div className="field">
          <label>텍스트</label>
          <textarea className="input" rows={2} value={(block.content?.text as string) ?? ""} onChange={(e) => onContent({ text: e.target.value })} />
        </div>
      );
    default:
      return <p className="dash-sub" style={{ margin: 0 }}>추가 설정 없음</p>;
  }
}
