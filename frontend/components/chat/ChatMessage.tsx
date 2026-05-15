"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Globe, CheckCircle2, AlertCircle, Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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
      htmlUrl?: string;
      excelUrl?: string;
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

function DashboardPreview({ htmlUrl }: { htmlUrl: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!htmlUrl) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-mono text-accent hover:underline"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? "Hide preview" : "Preview dashboard"}
      </button>
      {expanded && (
        <div className="mt-3 border-[3px] border-ink" style={{ boxShadow: "4px 4px 0 0 #000" }}>
          <div className="bg-ink text-snow text-xs font-mono px-3 py-1.5 flex items-center justify-between">
            <span>📊 {htmlUrl.split("/").pop()}</span>
            <a href={htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent">
              Open full <ExternalLink size={10} />
            </a>
          </div>
          <iframe
            src={htmlUrl}
            className="w-full"
            style={{ height: "520px", border: "none", display: "block" }}
            title="Dashboard Preview"
          />
        </div>
      )}
    </div>
  );
}

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

  // result
  const displayTitle = msg.spec?.title || msg.filename || "Dashboard";
  const domain = msg.spec?.domain || msg.audit?.domain;
  const confidence = msg.audit?.confidence;
  const kpiCount = msg.spec?.kpi_count;
  const chartCount = msg.spec?.chart_count;

  return (
    <div className="msg-result">
      {/* Header row */}
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

        {/* Download buttons */}
        <div className="flex gap-2 flex-wrap">
          {msg.htmlUrl && (
            <a href={msg.htmlUrl} target="_blank" rel="noopener noreferrer">
              <NeoButton size="sm" variant="primary">
                <Globe size={14} /> HTML Dashboard
              </NeoButton>
            </a>
          )}
          {msg.excelUrl && (
            <a href={msg.excelUrl} download>
              <NeoButton size="sm">
                <Download size={14} /> Excel
              </NeoButton>
            </a>
          )}
          {!msg.htmlUrl && !msg.excelUrl && msg.downloadUrl && (
            <a href={msg.downloadUrl} download>
              <NeoButton size="sm">
                <Download size={14} /> {t.studio.open}
              </NeoButton>
            </a>
          )}
        </div>
      </div>

      {/* Stats pills */}
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
      </div>

      {/* Inline HTML Dashboard Preview */}
      {msg.htmlUrl && <DashboardPreview htmlUrl={msg.htmlUrl} />}

      {/* Audit counts (legacy) */}
      {msg.audit?.counts && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 border-t-[3px] border-ink pt-4">
          {Object.entries(msg.audit.counts).map(([k, v]) => (
            <div key={k} className="border-[3px] border-ink p-2 shadow-neo-sm bg-paper">
              <div className="text-[9px] font-mono uppercase text-muted tracking-wider">{k.replace(/_/g, " ")}</div>
              <div className="font-display text-lg leading-none mt-1">{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Enhancement suggestions */}
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
