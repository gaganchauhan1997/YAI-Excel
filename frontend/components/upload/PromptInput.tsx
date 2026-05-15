"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

export default function PromptInput({
  onSubmit,
  busy,
}: {
  onSubmit: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3 text-muted text-sm">
        <MessageSquare size={16} /> Or describe the dashboard you want
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='"Build a quarterly sales dashboard for 8 regions showing revenue, costs, delivery rate, and staff performance."'
        className="w-full min-h-[110px] bg-bg/60 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-primary/50 resize-none"
      />
      <button
        disabled={busy || !text.trim()}
        onClick={() => onSubmit(text.trim())}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm hover:bg-primary/80 disabled:opacity-50"
      >
        Build from prompt <Send size={14} />
      </button>
    </div>
  );
}
