"use client";

import { useEffect, useRef } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import NeoCard from "@/components/neo/NeoCard";
import { Sparkles, Image as ImageIcon, FileText, FileSpreadsheet, MessageSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ChatStream({
  messages,
  onPick,
}: {
  messages: Message[];
  onPick: (sample: string) => void;
}) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 bg-primary border-[3px] border-ink shadow-neo flex items-center justify-center mb-4">
          <Sparkles size={28} strokeWidth={2.5} />
        </div>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">
          GIVE US <span className="bg-primary px-2 border-[3px] border-ink">ANYTHING</span>.
        </h2>
        <p className="text-muted mt-3 max-w-md">{t.studio.tip}</p>

        <div className="grid sm:grid-cols-2 gap-3 mt-8 max-w-3xl w-full">
          {SAMPLES.map((s) => (
            <button key={s.label} onClick={() => onPick(s.text)} className="text-left">
              <NeoCard hover className="!p-4" shadow={s.shadow as any}>
                <div className="flex items-start gap-3">
                  <s.icon size={22} strokeWidth={2.5} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-display">{s.label}</div>
                    <div className="text-xs text-muted mt-1">{s.text}</div>
                  </div>
                </div>
              </NeoCard>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        {messages.map((m) => <ChatMessage key={m.id} msg={m} />)}
        <div ref={endRef} />
      </div>
    </div>
  );
}

const SAMPLES = [
  {
    label: "Sales prompt",
    text: "Build a quarterly sales dashboard for a logistics company with 8 regions, showing revenue, costs, delivery rate, and staff performance.",
    icon: MessageSquare,
    shadow: "primary",
  },
  {
    label: "Finance prompt",
    text: "Quick P&L: revenue 50 lakhs, cost 32 lakhs, 5 months, show margin and MoM growth in INR.",
    icon: FileText,
    shadow: "pink",
  },
  {
    label: "Marketing prompt",
    text: "Build a marketing performance dashboard with CTR, CPC, ROAS for 6 campaigns across 4 channels.",
    icon: ImageIcon,
    shadow: "blue",
  },
  {
    label: "Real estate prompt",
    text: "Generate a 12-property real-estate portfolio dashboard: occupancy, rent, yield, maintenance cost. INR formatting.",
    icon: FileSpreadsheet,
    shadow: "primary",
  },
];
