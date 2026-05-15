"use client";

import { useI18n } from "@/lib/i18n";
import { Plus, FileSpreadsheet, Github, X, Settings } from "lucide-react";
import NeoButton from "@/components/neo/NeoButton";
import NeoPill from "@/components/neo/NeoPill";
import Link from "next/link";
import clsx from "clsx";

export type DashboardItem = {
  id: string;
  title: string;
  filename?: string;
  downloadUrl?: string;
  theme: string;
  ts: number;
};

export default function Sidebar({
  items,
  activeId,
  onPick,
  onNew,
  open,
  onClose,
}: {
  items: DashboardItem[];
  activeId?: string;
  onPick: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <aside className={clsx("chat-sidebar bg-snow border-r-[3px] border-ink flex flex-col h-full", open && "open")}>
      <div className="px-4 py-3 flex items-center justify-between border-b-[3px] border-ink">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 bg-primary border-[3px] border-ink shadow-neo-sm flex items-center justify-center font-display">Y</span>
          <span className="font-display text-lg">YAI-EXCEL</span>
        </Link>
        <button onClick={onClose} className="md:hidden p-1" aria-label="Close sidebar"><X size={20} /></button>
      </div>

      <div className="p-3 border-b-[3px] border-ink">
        <NeoButton variant="dark" className="w-full justify-center" onClick={onNew}>
          <Plus size={16} /> {t.studio.newDashboard}
        </NeoButton>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        <div className="text-[11px] font-mono uppercase text-muted mb-2 tracking-widest">
          {t.studio.yourDashboards}
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted py-6 text-center">{t.studio.empty}</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => onPick(it.id)}
                  className={clsx(
                    "w-full text-left border-[3px] border-ink p-2.5 flex items-start gap-2 shadow-neo-sm transition",
                    activeId === it.id ? "bg-primary" : "bg-snow hover:bg-paper",
                  )}
                >
                  <FileSpreadsheet size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{it.title || it.filename || "Untitled"}</div>
                    <div className="text-[10px] font-mono text-ink/70 mt-0.5">{it.theme}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-3 border-t-[3px] border-ink space-y-2">
        <NeoPill variant="dark" className="w-full justify-center">100% free tier</NeoPill>
        <a href="https://github.com/gaganchauhan1997/YAI-Excel" target="_blank" rel="noopener noreferrer">
          <NeoButton variant="ghost" size="sm" className="w-full justify-center !shadow-none">
            <Github size={14} /> GitHub
          </NeoButton>
        </a>
      </div>
    </aside>
  );
}
