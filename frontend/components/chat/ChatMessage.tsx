"use client";

import { Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import NeoPill from "@/components/neo/NeoPill";
import NeoButton from "@/components/neo/NeoButton";

export type Message =
  | { id: string; kind: "user"; text: string; file?: string }
  | { id: string; kind: "system"; text: string }
  | { id: string; kind: "thinking"; stageIdx: number }
  | { id: string; kind: "error"; text: string }
  | {
      id: string;
      kind: "result";
      filename: string;
      downloadUrl: string;
      theme: string;
      spec?: {
        title?: string;
        domain?: string;
        kpi_count?: number;
        chart_count?: number;
      };
      audit?: {
        domain?: string;
        confidence?: number;
        counts?: Record<string, number>;
        enhancement_suggestions?: { description: string; priority: string }[];
      };
    };

export default function ChatMessage({ msg }: { msg: Message }) {
  const { t } = useI18n();

  if (msg.kind === "user") {
    return (
      <div className="msg-user font-medium">
        {msg.file && (
          <div className="text-xs font-mono text-ink/70 mb-1">📎 {msg.file}</div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
    );
  }

  if (msg.kind === "system") {
    return <div className="msg-system">{msg.text}</div>;
  }

  if (msg.kind === "thinking") {
    return (
      <div className="msg-assistant font-mono text-sm space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-bold">{t.studio.thinking}</span>
        </div>
        {t.studio.stages.map((s, i) => (
          <div
            key={i}
            className={
              i < msg.stageIdx ? "text-ink" : i === msg.stageIdx ? "text-accent font-bold" : "text-muted/60"
            }
          >
            {i < msg.stageIdx ? "✓" : i === msg.stageIdx ? "→" : "·"} {String(i + 1).padStart(2, "0")} {s}
          </div>
        ))}
      </div>
    );
  }

  if (msg.kind === "error") {
    return (
      <div className="msg-assistant border-danger" style={{ boxShadow: "5px 5px 0 0 #FF5470" }}>
        <div className="flex items-start gap-2">
          <AlertCircle className="shrink-0 text-danger" size={20} />
          <div>
            <div className="font-bold">Error</div>
            <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
          </div>
        </div>
      </div>
    );
  }

  // result — XLSX only (Worker v3.0 removed HTML output)
  const displayTitle = msg.spec?.title || msg.filename || "Dashboard";
  const domain = msg.spec?.domain || msg.audit?.domain;
  const confidence = msg.audit?.confidence;
  const kpiCount = msg.spec?.kpi_count;
  const chartCount = msg.spec?.chart_count;

  return (
    <div className="msg-result">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary border-[3px] border-ink shadow-neo-sm flex items-center justify-center">
            <FileSpreadsheet size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">{displayTitle}</div>
            <div className="text-xs font-mono text-muted mt-0.5">theme · {msg.theme}</div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {msg.downloadUrl && (
            <a href={msg.downloadUrl} download>
              <NeoButton size="sm" variant="primary">
                <Download size={14} /> Excel Dashboard (.xlsx)
              </NeoButton>
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {domain && <NeoPill variant="primary">📊 {domain}</NeoPill>}
        {typeof confidence === "number" && (
          <NeoPill variant="snow">
            <CheckCircle2 size={12} /> {Math.round(confidence * 100)}% confidence
          </NeoPill>
        )}
        {typeof kpiCount === "number" && kpiCount > 0 && (
          <NeoPill variant="dark">{kpiCount} KPIs</NeoPill>
        )}
        {typeof chartCount === "number" && chartCount > 0 && (
          <NeoPill variant="dark">{chartCount} charts</NeoPill>
        )}
        <NeoPill variant="snow">+ Excel Tutor sheet 🎓</NeoPill>
      </div>

      <div className="text-sm text-muted mt-3 border-t-[3px] border-ink pt-3">
        <div className="font-mono text-[11px] uppercase tracking-widest mb-2">What is inside this workbook</div>
        <ul className="space-y-1.5 list-disc list-inside">
          <li><b>Dashboard</b> — title banner, 5 tabs, {kpiCount || 5} KPI cards, {chartCount || 4} charts, 3 left + 3 right filter panels, timeline trend, footer</li>
          <li><b>Data</b> — every raw row so you can verify, re-pivot, or build your own slices</li>
          <li><b>Excel Tutor</b> — 8 lessons (SUM, SUMIFS, XLOOKUP, INDEX/MATCH, UNIQUE, SORT, FILTER, formatting, shortcuts) using <i>your</i> columns so you can rebuild the dashboard yourself</li>
        </ul>
      </div>

      {msg.audit?.enhancement_suggestions?.length ? (
        <div className="mt-3 border-t-[3px] border-ink pt-3">
          <div className="text-[11px] font-mono uppercase text-muted mb-2 tracking-widest">Suggestions</div>
          <ul className="space-y-1.5 text-sm">
            {msg.audit.enhancement_suggestions.slice(0, 3).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-muted">·</span>
                <span>{s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
