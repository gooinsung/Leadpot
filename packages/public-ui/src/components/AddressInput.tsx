"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 주소 입력 — 카카오(다음) 우편번호 서비스로 검색해 채운다(무료, API 키 불필요).
 *
 * <ul>
 *   <li><b>팝업 창이 아니라 폼 위 레이어</b>로 띄운다 — 공개 폼은 대부분 모바일이라 새 창은 탭 전환·팝업 차단으로
 *       이탈이 난다(CLAUDE.md 모바일 퍼스트). 모바일은 전체 화면, 넓은 화면은 가운데 창.</li>
 *   <li>상위로는 <code>(우편번호) 주소</code> 한 문자열로 올려보낸다(사용자 확정 2026-09-28 — 우편번호·주소 둘 다 저장).
 *       도로명/지번은 방문자가 검색 결과에서 고른 쪽을 쓴다.</li>
 *   <li>상세주소(동·호수)는 이 항목에 넣지 않는다 — 필요하면 리드폼에 일반 '한 줄 텍스트' 항목을 따로 둔다(사용자 결정).</li>
 *   <li>스크립트는 처음 검색을 누를 때만 불러온다 — 주소 항목이 없는 폼·검색 안 하는 방문자는 로드 비용이 없다.</li>
 * </ul>
 */

/** 카카오 공식 경로. 예전 경로(daumcdn)는 먼저 것이 실패할 때만 쓴다. */
const SCRIPT_URLS = [
  "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
];

/** 우편번호 서비스가 넘겨주는 값 중 쓰는 것만. */
type PostcodeData = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
  bname: string;
  buildingName: string;
  apartment: "Y" | "N";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostcodeCtor = new (opts: any) => { embed: (el: HTMLElement, opts?: any) => void };

function postcodeCtor(): PostcodeCtor | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.kakao?.Postcode ?? w.daum?.Postcode ?? null) as PostcodeCtor | null;
}

let loading: Promise<PostcodeCtor> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      reject(new Error("load failed"));
    };
    document.head.appendChild(s);
  });
}

function loadPostcode(): Promise<PostcodeCtor> {
  const ready = postcodeCtor();
  if (ready) return Promise.resolve(ready);
  if (!loading) {
    loading = (async () => {
      for (const src of SCRIPT_URLS) {
        try {
          await loadScript(src);
          const ctor = postcodeCtor();
          if (ctor) return ctor;
        } catch {
          /* 다음 경로 시도 */
        }
      }
      throw new Error("postcode unavailable");
    })();
    // 실패하면 다음 클릭에서 다시 시도할 수 있게 비운다.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/**
 * 고른 결과 → 저장 문자열. 도로명이면 카카오 공식 예제처럼 법정동·아파트명을 괄호로 덧붙인다
 * (예: "(06234) 서울 강남구 테헤란로 123 (역삼동, 래미안)") — 상담원이 위치를 바로 알아보게.
 */
export function formatAddress(d: PostcodeData): string {
  let addr = d.userSelectedType === "J" ? d.jibunAddress || d.address : d.roadAddress || d.address;
  if (d.userSelectedType !== "J") {
    const extra: string[] = [];
    if (d.bname && /[동로가]$/.test(d.bname)) extra.push(d.bname);
    if (d.buildingName && d.apartment === "Y") extra.push(d.buildingName);
    if (extra.length) addr += ` (${extra.join(", ")})`;
  }
  return d.zonecode ? `(${d.zonecode}) ${addr}` : addr;
}

export function AddressInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  readOnly,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  /** 편집기 미리보기 — 눌러도 검색창을 열지 않는다. */
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    loadPostcode()
      .then((Postcode) => {
        if (cancelled || !layerRef.current) return;
        new Postcode({
          oncomplete: (data: PostcodeData) => {
            onChange(formatAddress(data));
            setOpen(false);
          },
          width: "100%",
          height: "100%",
        }).embed(layerRef.current);
      })
      .catch(() => {
        if (!cancelled) setError("주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
    // 레이어가 떠 있는 동안 뒤 페이지가 스크롤되지 않게 한다.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // onChange 는 매 렌더 새로 만들어져도 열릴 때 한 번만 embed 하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openSearch = () => {
    if (!readOnly) setOpen(true);
  };

  return (
    <>
      <div className="addr-row">
        {/* 긴 주소가 잘리지 않게 input 대신 줄바꿈되는 버튼으로 보여준다(모바일에서 한 줄에 안 들어간다). */}
        <button
          id={id}
          type="button"
          className={`input addr-value${value ? "" : " empty"}`}
          aria-required={required}
          onClick={openSearch}
        >
          {value || placeholder || "주소를 검색해주세요"}
        </button>
        <button type="button" className="addr-btn" onClick={openSearch}>
          {value ? "다시 검색" : "주소 검색"}
        </button>
      </div>
      {open && (
        <div className="addr-overlay" role="dialog" aria-modal="true" aria-label="주소 검색" onClick={() => setOpen(false)}>
          <div className="addr-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="addr-sheet-head">
              <strong>주소 검색</strong>
              <button type="button" className="addr-close" aria-label="닫기" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="addr-sheet-body" ref={layerRef}>
              {error && <p className="addr-error">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
