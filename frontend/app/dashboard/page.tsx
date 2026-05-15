"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar, { DashboardItem } from "@/components/chat/Sidebar";
import Topbar from "@/components/chat/Topbar";
import ChatStream from "@/components/chat/ChatStream";
import UniversalInputBar from "@/components/chat/UniversalInputBar";
import ApiKeyPanel from "@/components/chat/ApiKeyPanel";
import { Message } from "@/components/chat/ChatMessage";
import { upload, generate, fetchThemes, ApiKeys } from "@/lib/api";

const LS_GROQ = "yai_groq_key";
const LS_GEMINI = "yai_gemini_key";

function loadKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  return {
    groq: localStorage.getItem(LS_GROQ) || "",
    gemini: localStorage.getItem(LS_GEMINI) || "",
  };
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [themes, setThemes] = useState<string[]>([
    "midnight", "emerald", "crimson", "slate", "amber",
    "ocean", "violet", "rose", "carbon", "arctic",
  ]);
  const [theme, setTheme] = useState("midnight");
  const [indianFormat, setIndianFormat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});

  useEffect(() => {
    fetchThemes().then(setThemes).catch(() => {});
    setApiKeys(loadKeys());
    // Show key panel on first visit if no keys saved
    const hasKeys = !!localStorage.getItem(LS_GROQ) || !!localStorage.getItem(LS_GEMINI);
    if (!hasKeys) setShowKeys(true);
  }, []);

  const saveKeys = useCallback((keys: ApiKeys) => {
    if (keys.groq !== undefined) localStorage.setItem(LS_GROQ, keys.groq);
    if (keys.gemini !== undefined) localStorage.setItem(LS_GEMINI, keys.gemini);
    setApiKeys(keys);
    setShowKeys(false);
  }, []);

  const onSubmit = async (text: string, file: File | null) => {
    if (busy) return;
    const currentKeys = loadKeys();

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      kind: "user",
      text: text || (file ? `Build dashboard from ${file.name}` : ""),
      file: file?.name,
    };
    const thinkingId = `t-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: thinkingId, kind: "thinking", stageIdx: 0 }]);
    setBusy(true);
    setStageIdx(0);

    const tick = setInterval(() => {
      setStageIdx((s) => {
        const next = Math.min(s + 1, 17);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === thinkingId && msg.kind === "thinking" ? { ...msg, stageIdx: next } : msg,
          ),
        );
        return next;
      });
    }, 650);

    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (text) fd.append("text", text);

      // Upload with user API keys
      const up = await upload(fd, currentKeys);

      setMessages((m) =>
        m.flatMap((msg) =>
          msg.id === thinkingId
            ? [{ id: `s-${Date.now()}`, kind: "system" as const, text: up.summary }, msg]
            : [msg],
        ),
      );

      const promptHint = indianFormat
        ? (text ? `${text}\n\n(Format all monetary values in Indian Rupees with lakhs/crores grouping.)` : "Indian Rupee formatting with lakhs/crores grouping.")
        : text;

      // Generate with keys + output both
      const result = await generate(up.token, theme, "enhance", promptHint, currentKeys, "both");
      clearInterval(tick);

      // Determine HTML and Excel URLs
      const htmlUrl = result.html?.download_url || (result.filename?.endsWith(".html") ? result.download_url : "");
      const excelUrl = result.excel?.download_url || (result.filename?.endsWith(".xls") ? result.download_url : "");

      const resultMsg: Message = {
        id: `r-${Date.now()}`,
        kind: "result",
        filename: result.spec?.title || result.filename || "Dashboard",
        downloadUrl: result.download_url,
        htmlUrl,
        excelUrl,
        theme: result.theme,
        spec: result.spec,
        audit: result.audit,
      };
      setMessages((m) => m.map((msg) => (msg.id === thinkingId ? resultMsg : msg)));

      const it: DashboardItem = {
        id: up.token,
        title: text ? text.slice(0, 60) : file?.name || "Untitled",
        filename: result.filename,
        downloadUrl: result.download_url,
        theme: result.theme,
        ts: Date.now(),
      };
      setItems((arr) => [it, ...arr]);
      setActiveId(it.id);
    } catch (e: unknown) {
      clearInterval(tick);
      const errorText = e instanceof Error ? e.message : String(e);
      // If no API key error, prompt user to add keys
      const needsKey = errorText.toLowerCase().includes("api key") || errorText.toLowerCase().includes("401") || errorText.toLowerCase().includes("quota");
      setMessages((m) =>
        m.map((msg) =>
          msg.id === thinkingId
            ? {
                id: msg.id,
                kind: "error" as const,
                text: needsKey
                  ? `API key needed: ${errorText} — Click the 🔑 key button in the toolbar to add your free Groq or Gemini key.`
                  : errorText,
              }
            : msg,
        ),
      );
      if (needsKey) setShowKeys(true);
    } finally {
      setBusy(false);
    }
  };

  const onNew = () => {
    setMessages([]);
    setActiveId(undefined);
    setSidebarOpen(false);
  };

  const onPick = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setActiveId(id);
    setMessages([
      {
        id: `r-${id}`,
        kind: "result",
        filename: it.filename || "",
        downloadUrl: it.downloadUrl || "",
        htmlUrl: it.downloadUrl?.endsWith(".html") ? it.downloadUrl : "",
        excelUrl: it.downloadUrl?.endsWith(".xls") ? it.downloadUrl : "",
        theme: it.theme,
        audit: undefined,
      },
    ]);
    setSidebarOpen(false);
  };

  return (
    <div className="chat-shell">
      <Sidebar
        items={items}
        activeId={activeId}
        onPick={onPick}
        onNew={onNew}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Topbar
        onMenu={() => setSidebarOpen(true)}
        theme={theme}
        model={apiKeys.groq ? "Groq · Gemini" : apiKeys.gemini ? "Gemini" : "No key — add one 🔑"}
        onKeySettings={() => setShowKeys(true)}
        hasKeys={!!(apiKeys.groq || apiKeys.gemini)}
      />

      {showKeys && (
        <ApiKeyPanel
          initialGroq={apiKeys.groq || ""}
          initialGemini={apiKeys.gemini || ""}
          onSave={saveKeys}
          onClose={() => setShowKeys(false)}
        />
      )}

      <main className="chat-main flex flex-col h-full overflow-hidden">
        <ChatStream messages={messages} onPick={(text) => onSubmit(text, null)} />
        <UniversalInputBar
          onSubmit={onSubmit}
          busy={busy}
          theme={theme}
          onTheme={setTheme}
          themes={themes}
          indianFormat={indianFormat}
          onIndianFormat={setIndianFormat}
        />
      </main>
    </div>
  );
}
