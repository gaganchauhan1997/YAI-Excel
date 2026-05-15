"use client";

import { Download } from "lucide-react";

export default function DashboardPreview({
  filename,
  downloadUrl,
  theme,
}: {
  filename?: string;
  downloadUrl?: string;
  theme?: string;
}) {
  if (!downloadUrl) {
    return (
      <div className="card h-full flex flex-col items-center justify-center p-10 text-center min-h-[400px]">
        <div className="text-6xl mb-4 opacity-30">📊</div>
        <h3 className="font-display text-xl">Your dashboard will appear here</h3>
        <p className="text-muted text-sm mt-2">Drop a file or describe what you want.</p>
      </div>
    );
  }

  return (
    <div className="card p-6 min-h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl">
          Generated · <span className="text-accent">{theme}</span>
        </h3>
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm hover:bg-primary/80"
        >
          <Download size={14} /> Download .xlsx
        </a>
      </div>
      <div className="rounded-xl bg-bg/60 border border-white/10 p-8 text-center">
        <p className="font-mono text-accent">{filename}</p>
        <p className="text-muted text-sm mt-2">Ready to download — open in Excel or LibreOffice.</p>
      </div>
    </div>
  );
}
