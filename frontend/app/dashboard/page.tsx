"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import UniversalDropzone from "@/components/upload/UniversalDropzone";
import PromptInput from "@/components/upload/PromptInput";
import DashboardPreview from "@/components/preview/DashboardPreview";
import AuditReport from "@/components/preview/AuditReport";
import FormulaList from "@/components/preview/FormulaList";
import ThemeSelector from "@/components/editor/ThemeSelector";
import EnhanceOptions, { Options } from "@/components/editor/EnhanceOptions";
import { upload, generate, fetchThemes, GenerateResult } from "@/lib/api";

const PROGRESS_STEPS = [
  "Detecting input",
  "Enhancing image / extracting frames",
  "Running vision audit",
  "Merging detected elements",
  "Designing dashboard schema",
  "Creating sheets",
  "Writing raw data",
  "Building named ranges",
  "Building interactive controls",
  "Building pivots",
  "Building charts",
  "Building KPI cards",
  "Building data tables",
  "Applying conditional formats",
  "Wiring data validation",
  "Applying theme",
  "Running quality gates",
  "Saving workbook",
];

export default function DashboardPage() {
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState("midnight");
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [opts, setOpts] = useState<Options>({
    addMissingKPIs: true,
    addMissingCharts: true,
    addInteractivity: true,
    addConditionalFormat: true,
  });

  useEffect(() => {
    fetchThemes().then(setThemes).catch(() => {});
  }, []);

  async function runPipeline(formBuilder: () => Promise<FormData>, kind: string) {
    setBusy(true);
    setResult(null);
    setStepIdx(0);
    setStatus(`Uploading ${kind}…`);
    try {
      const form = await formBuilder();
      const tick = setInterval(() => setStepIdx((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1)), 700);
      const up = await upload(form);
      setStatus(up.summary);
      const out = await generate(up.token, theme, "enhance");
      clearInterval(tick);
      setStepIdx(PROGRESS_STEPS.length - 1);
      setResult(out);
      setStatus(`Done — ${out.filename}`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  const onFile = (file: File) =>
    runPipeline(async () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    }, file.name);

  const onPrompt = (text: string) =>
    runPipeline(async () => {
      const fd = new FormData();
      fd.append("text", text);
      return fd;
    }, "prompt");

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="border-b border-white/5 backdrop-blur-xl">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold">
            <span className="gradient-text">YAI</span>-Excel
          </Link>
          <span className="text-sm text-muted">Dashboard studio</span>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_360px] gap-6">
        {/* Left — Inputs */}
        <section className="space-y-5">
          <UniversalDropzone onFile={onFile} busy={busy} />
          <PromptInput onSubmit={onPrompt} busy={busy} />
          {busy && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="animate-spin text-primary" size={18} />
                <span className="font-mono text-sm">{PROGRESS_STEPS[stepIdx]}</span>
              </div>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto text-xs font-mono">
                {PROGRESS_STEPS.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 ${
                      i < stepIdx ? "text-accent" : i === stepIdx ? "text-text" : "text-muted/50"
                    }`}
                  >
                    <span>{i < stepIdx ? "✓" : i === stepIdx ? "→" : "·"}</span>
                    <span>
                      {String(i + 1).padStart(2, "0")} {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {status && !busy && (
            <div className="card p-4 text-sm">
              <Sparkles className="inline text-accent mr-2" size={14} />
              {status}
            </div>
          )}
        </section>

        {/* Center — Preview */}
        <section>
          <DashboardPreview
            filename={result?.filename}
            downloadUrl={result?.download_url}
            theme={result?.theme}
          />
        </section>

        {/* Right — Editor */}
        <aside className="space-y-5">
          <ThemeSelector value={theme} onChange={setTheme} themes={themes} />
          <EnhanceOptions value={opts} onChange={setOpts} />
          <AuditReport
            domain={result?.audit?.domain}
            confidence={result?.audit?.confidence}
            counts={result?.audit?.counts}
          />
          <FormulaList suggestions={result?.audit?.enhancement_suggestions} />
        </aside>
      </div>
    </main>
  );
}
