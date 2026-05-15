"use client";

import { useState } from "react";
import { X, Key, ExternalLink } from "lucide-react";
import NeoButton from "@/components/neo/NeoButton";
import { ApiKeys } from "@/lib/api";

interface Props {
  initialGroq?: string;
  initialGemini?: string;
  onSave: (keys: ApiKeys) => void;
  onClose: () => void;
}

export default function ApiKeyPanel({ initialGroq = "", initialGemini = "", onSave, onClose }: Props) {
  const [groq, setGroq] = useState(initialGroq);
  const [gemini, setGemini] = useState(initialGemini);

  const handleSave = () => {
    onSave({ groq: groq.trim(), gemini: gemini.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-paper border-[3px] border-ink shadow-neo p-6"
        style={{ boxShadow: "6px 6px 0 0 #000" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Key size={20} className="text-accent" />
          <h2 className="font-display text-xl">Your Free API Keys</h2>
        </div>

        <p className="text-sm text-muted mb-5">
          Keys are saved in your browser only — never sent to our servers except to call the AI APIs directly. Use any one or both.
        </p>

        {/* Groq */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1.5">
            Groq API Key
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-accent hover:underline"
            >
              Get free key <ExternalLink size={10} />
            </a>
          </label>
          <input
            type="password"
            value={groq}
            onChange={(e) => setGroq(e.target.value)}
            placeholder="gsk_..."
            className="w-full border-[2px] border-ink bg-snow text-ink font-mono text-sm px-3 py-2 focus:outline-none focus:border-accent placeholder:text-muted/50"
            autoComplete="off"
          />
          <p className="text-xs text-muted mt-1">Fast · 14,400 free req/day · llama-3.3-70b</p>
        </div>

        {/* Gemini */}
        <div className="mb-6">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-1.5">
            Gemini API Key
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-accent hover:underline"
            >
              Get free key <ExternalLink size={10} />
            </a>
          </label>
          <input
            type="password"
            value={gemini}
            onChange={(e) => setGemini(e.target.value)}
            placeholder="AIza..."
            className="w-full border-[2px] border-ink bg-snow text-ink font-mono text-sm px-3 py-2 focus:outline-none focus:border-accent placeholder:text-muted/50"
            autoComplete="off"
          />
          <p className="text-xs text-muted mt-1">Gemini 2.5 Flash Lite · free tier · fallback</p>
        </div>

        <div className="flex gap-3">
          <NeoButton onClick={handleSave} className="flex-1">
            <Key size={14} /> Save Keys
          </NeoButton>
          <NeoButton variant="ghost" onClick={onClose}>
            Cancel
          </NeoButton>
        </div>

        <p className="text-xs text-muted/60 mt-4 text-center">
          Groq is recommended — faster and larger free quota. Keys stored in localStorage only.
        </p>
      </div>
    </div>
  );
}
