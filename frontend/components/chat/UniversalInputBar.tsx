"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Paperclip, Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import NeoButton from "@/components/neo/NeoButton";
import NeoPill from "@/components/neo/NeoPill";

export default function UniversalInputBar({
  onSubmit,
  busy,
  theme,
  onTheme,
  themes,
  indianFormat,
  onIndianFormat,
}: {
  onSubmit: (text: string, file: File | null) => void;
  busy: boolean;
  theme: string;
  onTheme: (t: string) => void;
  themes: string[];
  indianFormat: boolean;
  onIndianFormat: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    disabled: busy,
  });

  const submit = () => {
    if (busy) return;
    if (!text.trim() && !file) return;
    onSubmit(text.trim(), file);
    setText("");
    setFile(null);
  };

  return (
    <div
      {...getRootProps()}
      className={`bg-snow border-t-[3px] border-ink p-3 sm:p-4 ${isDragActive ? "bg-primary/30" : ""}`}
    >
      <input {...getInputProps()} />

      {/* meta row */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono uppercase text-muted mr-1">{t.studio.themeLabel}:</span>
          <select
            value={theme}
            onChange={(e) => onTheme(e.target.value)}
            className="bg-paper border-[3px] border-ink text-xs font-mono px-2 py-1 shadow-neo-sm"
          >
            {themes.map((th) => (
              <option key={th} value={th}>{th}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={indianFormat}
            onChange={(e) => onIndianFormat(e.target.checked)}
            className="w-4 h-4 accent-ink"
          />
          ₹ {t.studio.indianFormat}
        </label>
        {file && (
          <NeoPill variant="pink" className="cursor-pointer" onClick={() => setFile(null)}>
            📎 {file.name.length > 30 ? file.name.slice(0, 27) + "…" : file.name}
            <X size={12} className="ml-1" />
          </NeoPill>
        )}
      </div>

      {/* composer */}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInput.current?.click()}
          className="shrink-0 p-3 bg-paper border-[3px] border-ink shadow-neo-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition"
          aria-label="Attach file"
          disabled={busy}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t.studio.placeholder}
          rows={1}
          className="neo-input flex-1 resize-none max-h-48"
          style={{ height: "auto" }}
          disabled={busy}
        />
        <NeoButton onClick={submit} disabled={busy || (!text.trim() && !file)} className="shrink-0">
          <Send size={16} /> <span className="hidden sm:inline">{t.studio.send}</span>
        </NeoButton>
      </div>

      <div className="text-[10px] font-mono text-muted mt-2 text-center">{t.studio.tip}</div>
    </div>
  );
}
