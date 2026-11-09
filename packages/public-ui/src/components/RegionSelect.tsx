"use client";
import { allowedSido, joinRegion, sigunguOf, splitRegion } from "../lib/regions";

/**
 * '지역 선택' 입력 — [시/도 선택 ▾] [구/시 선택 ▾] 두 칸(사용자 지시 2026-11-09).
 * 값은 `"서울 강남구"` 한 문자열로 올려보낸다. 시/도를 바꾸면 구/시는 비운다.
 * 세종처럼 아래 단계가 없는 곳을 고르면 두 번째 칸은 잠긴다.
 * 모바일: select 는 OS 기본 선택기가 뜨고, 글자는 .input(16px)을 따른다.
 */
export function RegionSelect({
  id,
  value,
  onChange,
  regions,
  required,
  readOnly,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** 보여줄 시/도(`options.regions`). 비면 전국. */
  regions?: unknown;
  required?: boolean;
  readOnly?: boolean;
}) {
  const [sido, sigungu] = splitRegion(value);
  const sidoList = allowedSido(regions);
  const subs = sido ? sigunguOf(sido) : [];
  const noSub = Boolean(sido) && subs.length === 0;
  return (
    <div className="region-row">
      <select
        id={id}
        className="input"
        aria-label="시/도 선택"
        required={required}
        disabled={readOnly}
        value={sido}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">시/도 선택</option>
        {sidoList.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        className="input"
        aria-label="구/시 선택"
        required={required && !noSub}
        disabled={readOnly || !sido || noSub}
        value={sigungu}
        onChange={(e) => onChange(joinRegion(sido, e.target.value))}
      >
        <option value="">{noSub ? "-" : "구/시 선택"}</option>
        {subs.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
