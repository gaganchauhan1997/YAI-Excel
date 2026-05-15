"use client";

import { Menu } from "lucide-react";
import LanguageToggle from "@/components/neo/LanguageToggle";
import NeoPill from "@/components/neo/NeoPill";
import { useI18n } from "@/lib/i18n";

export default function Topbar({
  onMenu,
  theme,
  model,
}: {
  onMenu: () => void;
  theme: string;
  model: string;
}) {
  const { t } = useI18n();
  return (
    <header className="chat-topbar bg-paper border-b-[3px] border-ink h-[60px] flex items-center px-3 sm:px-5 gap-3">
      <button
        onClick={onMenu}
        className="md:hidden p-2 border-[3px] border-ink bg-snow shadow-neo-sm"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <NeoPill variant="primary" className="hidden sm:inline-flex">{t.studio.themeLabel} · {theme}</NeoPill>
        <NeoPill variant="snow" className="hidden md:inline-flex font-mono">{t.studio.modelLabel} · {model}</NeoPill>
      </div>
      <LanguageToggle />
    </header>
  );
}
