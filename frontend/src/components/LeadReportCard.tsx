import { useEffect, useState } from "react";

import {
  getLeadReport,
  previewLeadReport,
  updateLeadReport,
  type LeadReportKind,
  type LeadReportPreview,
  type LeadReportSettings,
} from "../api/client";
import { toast } from "../lib/toast";

/**
 * 리드 리포트 문자 설정 카드(V47, 문자 발송 화면).
 *
 * - 아침 9시: 오늘 00~09시(자는 동안) 접수 건수 / 밤 12시: 어제 하루(00~24시) 접수 건수 — 각각 켜고 끈다.
 * - 받는 사람은 마케터 본인(받을 번호를 비우면 계정 연락처). 건수만 담고 0건이면 보내지 않는다.
 * - 문자 권한(LMS)이 없으면 켤 수 없게 잠그고 사유를 보여준다(서버도 막는다).
 * 체크는 누르는 즉시 저장, 받을 번호는 [저장] 으로 저장한다.
 */
export function LeadReportCard() {
  const [settings, setSettings] = useState<LeadReportSettings | null>(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ kind: LeadReportKind; result: LeadReportPreview } | null>(null);

  useEffect(() => {
    getLeadReport()
      .then((s) => {
        setSettings(s);
        setPhone(s.phone);
      })
      .catch(() => toast.error("리포트 설정을 불러오지 못했습니다."));
  }, []);

  if (!settings) return null;
  const locked = settings.denyReason != null;

  async function save(next: { morningEnabled: boolean; dailyEnabled: boolean; phone: string }, okMessage: string) {
    setSaving(true);
    try {
      const s = await updateLeadReport(next);
      setSettings(s);
      setPhone(s.phone);
      toast.success(okMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(kind: LeadReportKind, on: boolean) {
    if (!settings) return;
    const next = {
      morningEnabled: kind === "MORNING" ? on : settings.morningEnabled,
      dailyEnabled: kind === "DAILY" ? on : settings.dailyEnabled,
      phone: settings.phone,
    };
    const label = kind === "MORNING" ? "아침 9시 리포트" : "밤 12시 리포트";
    save(next, `${label}를 ${on ? "켰습니다" : "껐습니다"}.`);
  }

  async function onPreview(kind: LeadReportKind) {
    try {
      setPreview({ kind, result: await previewLeadReport(kind) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "미리보기를 불러오지 못했습니다.");
    }
  }

  const rows: { kind: LeadReportKind; title: string; desc: string; on: boolean }[] = [
    { kind: "MORNING", title: "아침 9시 리포트", desc: "오늘 00:00~09:00 (자는 동안 들어온 리드)", on: settings.morningEnabled },
    { kind: "DAILY", title: "밤 12시 리포트", desc: "어제 00:00~24:00 (하루 전체)", on: settings.dailyEnabled },
  ];

  return (
    <div className="card card-pad" style={{ marginTop: 20 }}>
      <div className="card-h">리드 리포트 문자</div>
      <p className="dash-sub" style={{ marginBottom: 12 }}>
        정해진 시각에 <b>리드폼별 접수 건수</b>를 문자(LMS)로 받습니다. 이름·연락처 같은 개인정보는 넣지 않고,
        <b> 접수가 0건이면 보내지 않습니다.</b> 건당 비용이 발생하며 이번 달 사용량에 포함됩니다.
      </p>
      {locked && (
        <p className="auth-error" style={{ marginBottom: 12 }}>
          지금은 켤 수 없습니다. {settings.denyReason}
        </p>
      )}

      {rows.map((r) => (
        <div key={r.kind} className="dedup-row" style={{ marginTop: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <label className="fr-check" style={{ alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={r.on}
              // 잠겨 있어도 이미 켜진 건 끌 수 있어야 한다(권한이 나중에 회수된 경우).
              disabled={saving || (locked && !r.on)}
              onChange={(e) => toggle(r.kind, e.target.checked)}
              style={{ marginTop: 3 }}
            />{" "}
            <span>
              <b>{r.title}</b>
              <span className="dash-sub" style={{ display: "block", fontSize: 13 }}>{r.desc}</span>
            </span>
          </label>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onPreview(r.kind)}>
            미리보기
          </button>
        </div>
      ))}

      {preview && (
        <div style={{ marginTop: 12 }}>
          <div className="mini-label">
            {preview.kind === "MORNING" ? "아침 9시" : "밤 12시"} 리포트 — 가장 최근 구간 기준 (발송하지 않음)
          </div>
          {preview.result.text ? (
            <>
              <pre className="lead-report-preview">{preview.result.text}</pre>
              <p className="dash-sub" style={{ fontSize: 12 }}>
                {preview.result.channel} · {preview.result.bytes}byte
              </p>
            </>
          ) : (
            <p className="dash-sub">이 구간에는 접수된 리드가 없어 문자가 나가지 않습니다.</p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
        <label className="field" style={{ maxWidth: 240, marginBottom: 0 }}>
          <span className="field-label">받을 번호</span>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={settings.accountPhone ? `비우면 계정 연락처(${settings.accountPhone})` : "비우면 계정 연락처"}
          />
        </label>
        <button
          className="btn"
          type="button"
          disabled={saving || phone.trim() === settings.phone}
          onClick={() =>
            save({ morningEnabled: settings.morningEnabled, dailyEnabled: settings.dailyEnabled, phone }, "받을 번호를 저장했습니다.")
          }
        >
          저장
        </button>
      </div>
    </div>
  );
}
