"use client";

import { useEffect, useState } from "react";
import Sidebar, { DashboardItem } from "@/components/chat/Sidebar";
import Topbar from "@/components/chat/Topbar";
import ChatStream from "@/components/chat/ChatStream";
import UniversalInputBar from "@/components/chat/UniversalInputBar";
import { Message } from "@/components/chat/ChatMessage";
import { upload, generate, fetchThemes } from "@/lib/api";

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

  useEffect(() => { fetchThemes().then(setThemes).catch(() => {}); }, []);

  const onSubmit = async (text: string, file: File | null) => {
    if (busy) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      kind: "user",
      text: text || (file ? `Build a dashboard from ${file.name}` : ""),
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
          m.map((msg) => (msg.id === thinkingId && msg.kind === "thinking" ? { ...msg, stageIdx: next } : msg)),
        );
        return next;
      });
    }, 650);

    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (text) fd.append("text", text);

      const up = await upload(fd);
      setMessages((m) =>
        m.flatMap((msg) =>
          msg.id === thinkingId
            ? [{ id: `s-${Date.now()}`, kind: "system", text: up.summary }, msg]
            : [msg],
        ),
      );

      const promptHint = indianFormat
        ? (text ? `${text}\n\n(Format all monetary values in Indian Rupees with lakhs/crores grouping.)` : "Indian Rupee formatting with lakhs/crores grouping.")
        : text;

      const result = await generate(up.token, theme, "enhance", promptHint);
      clearInterval(tick);

      const resultMsg: Message = {
        id: `r-${Date.now()}`,
        kind: "result",
        filename: result.filename,
        downloadUrl: result.download_url,
        theme: result.theme,
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
    } catch (e: any) {
      clearInterval(tick);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === thinkingId
            ? { id: msg.id, kind: "error", text: e?.message || String(e) } as Message
            : msg,
        ),
      );
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
      { id: `r-${id}`, kind: "result", filename: it.filename || "", downloadUrl: it.downloadUrl || "", theme: it.theme, audit: undefined },
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
      <Topbar onMenu={() => setSidebarOpen(true)} theme={theme} model="Gemini · Groq · GPT-4o · Claude" />
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
