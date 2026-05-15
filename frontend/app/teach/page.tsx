"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, Sparkles, BookOpen, Keyboard, Lightbulb, GraduationCap,
  Loader2, RefreshCw, AlertCircle, Trophy, Target, FileSpreadsheet, Download,
  CheckCircle2, XCircle, Award, Globe2, Zap, ChevronRight,
} from "lucide-react";
import NeoButton from "@/components/neo/NeoButton";
import NeoPill from "@/components/neo/NeoPill";
import ApiKeyPanel from "@/components/chat/ApiKeyPanel";
import { ApiKeys } from "@/lib/api";

const LS_GROQ = "yai_groq_key";
const LS_GEMINI = "yai_gemini_key";
const LS_SESSION = "yai_teach_session";
const LS_LANG = "yai_teach_lang";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const apiUrl = (p: string) => (BASE ? `${BASE}${p}` : p);

type ChatTurn = { role: "user" | "assistant"; content: string; meta?: TeacherMeta };
type TeacherMeta = {
  lang?: string;
  level?: string;
  concepts_covered?: string[];
  follow_up_questions?: string[];
  suggested_shortcut?: string | null;
  homework?: string | null;
  ai_used?: boolean;
};

type Concept = { id: string; name: string; name_hi: string; tier: number; status?: string };
type Tier = { tier: number; total: number; mastered: number; seen: number; percent: number; concepts: Concept[] };
type Progress = {
  session_id: string;
  level: string;
  xp: number;
  seen: string[];
  mastered: string[];
  quizzes_taken: number;
  quizzes_passed: number;
  badges: string[];
  tiers: Tier[];
};

type QuizQ = { index: number; concept_id: string; q: string; options: string[] };
type QuizSession = { quiz_id: string; questions: QuizQ[]; total: number };
type QuizResult = {
  score: number; total: number; percent: number; passed: boolean;
  new_level: string; new_xp: number; new_badges: string[];
  results: { concept_id: string; q: string; options: string[]; your_answer: number; correct_answer: number; is_correct: boolean; explain: string }[];
};

const QUICK_PROMPTS_EN = [
  { icon: "🔍", text: "How do I use XLOOKUP?", short: "XLOOKUP" },
  { icon: "➕", text: "Show me a SUMIFS example", short: "SUMIFS" },
  { icon: "📊", text: "What is a PivotTable?", short: "Pivot" },
  { icon: "📈", text: "Which chart should I use for monthly revenue?", short: "Charts" },
  { icon: "⌨️", text: "Top 10 Excel keyboard shortcuts", short: "Shortcuts" },
  { icon: "🎯", text: "How do I design a great dashboard?", short: "Dashboard" },
];

const QUICK_PROMPTS_HI = [
  { icon: "🔍", text: "XLOOKUP kaise use karein?", short: "XLOOKUP" },
  { icon: "➕", text: "SUMIFS ka example dikhaiye", short: "SUMIFS" },
  { icon: "📊", text: "Pivot table kaise banayein?", short: "Pivot" },
  { icon: "📈", text: "Monthly revenue ke liye konsa chart use karein?", short: "Charts" },
  { icon: "⌨️", text: "Top 10 Excel keyboard shortcuts", short: "Shortcuts" },
  { icon: "🎯", text: "Achha dashboard kaise design karein?", short: "Dashboard" },
];

const BADGE_MAP: Record<string, { label: string; emoji: string }> = {
  "first-quiz": { label: "First Quiz", emoji: "🎯" },
  "quiz-streak-5": { label: "5 Quizzes Passed", emoji: "🔥" },
  "5-concepts": { label: "5 Concepts Mastered", emoji: "🌱" },
  "10-concepts": { label: "10 Concepts Mastered", emoji: "🌳" },
  "tier-1-cleared": { label: "Foundations Cleared", emoji: "🏗️" },
  "tier-2-cleared": { label: "Intermediate Cleared", emoji: "⚡" },
  "tier-3-cleared": { label: "Advanced Cleared", emoji: "🚀" },
  "tier-4-cleared": { label: "Pro Cleared", emoji: "👑" },
};

function loadKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  return {
    groq: localStorage.getItem(LS_GROQ) || "",
    gemini: localStorage.getItem(LS_GEMINI) || "",
  };
}

// Markdown renderer — bold, code, links, lists
function renderMarkdown(md: string): string {
  if (!md) return "";
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="my-3 p-3 bg-ink text-snow font-mono text-[12px] overflow-x-auto border-[3px] border-ink shadow-neo-sm"><code>${code.trim()}</code></pre>`,
  );
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-display text-lg mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-display text-xl mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-display text-2xl mt-4 mb-2">$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  html = html.replace(/`([^`]+)`/g, '<code class="font-mono text-[12px] bg-paper border border-ink/30 px-1 py-[1px] rounded">$1</code>');
  html = html.replace(/(^|\n)((?:- [^\n]+\n?)+)/g, (_, prefix, block) => {
    const items = block.trim().split("\n").map((l: string) => `<li class="ml-5 list-disc mb-1">${l.replace(/^- /, "")}</li>`).join("");
    return `${prefix}<ul class="my-2">${items}</ul>`;
  });
  html = html.replace(/(^|\n)((?:\d+\. [^\n]+\n?)+)/g, (_, prefix, block) => {
    const items = block.trim().split("\n").map((l: string) => `<li class="ml-5 list-decimal mb-1">${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `${prefix}<ol class="my-2">${items}</ol>`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-accent underline">$1</a>');
  html = html.split(/\n\n+/).map(p => {
    if (/^<(h\d|pre|ul|ol)/.test(p.trim())) return p;
    if (!p.trim()) return "";
    return `<p class="leading-relaxed mb-3">${p.replace(/\n/g, "<br/>")}</p>`;
  }).join("");
  return html;
}

export default function TeachPage() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [showKeys, setShowKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [quiz, setQuiz] = useState<QuizSession | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [dailyTip, setDailyTip] = useState<{ en: string; hi: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshProgress = useCallback(async (sid?: string) => {
    const id = sid || sessionId;
    if (!id) return;
    try {
      const r = await fetch(apiUrl(`/api/teach/progress?session_id=${id}`));
      if (r.ok) setProgress(await r.json());
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    setApiKeys(loadKeys());
    const savedLang = (localStorage.getItem(LS_LANG) as "en" | "hi") || "en";
    setLanguage(savedLang);
    const sid = localStorage.getItem(LS_SESSION);
    if (sid) {
      setSessionId(sid);
      fetch(apiUrl(`/api/teach/history/${sid}`))
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.history) && d.history.length) {
            setMessages(d.history.map((t: { role: "user" | "assistant"; content: string }) => ({ role: t.role, content: t.content })));
          }
        })
        .catch(() => {});
      refreshProgress(sid);
    }
    fetch(apiUrl(`/api/teach/tip?lang=${savedLang}`))
      .then(r => r.json())
      .then(d => setDailyTip({ en: d.en, hi: d.hi }))
      .catch(() => {});
  }, [refreshProgress]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, quiz, quizResult]);

  const send = async (text: string) => {
    if (busy || !text.trim()) return;
    const keys = loadKeys();
    setError(null);
    setBusy(true);

    setMessages(m => [...m, { role: "user", content: text }]);
    setInput("");

    try {
      const r = await fetch(apiUrl("/api/teach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          session_id: sessionId,
          groq_api_key: keys.groq || "",
          gemini_api_key: keys.gemini || "",
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(err.error || `${r.status}`);
      }
      const data = await r.json();
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem(LS_SESSION, data.session_id);
      }
      setMessages(m => [...m, { role: "assistant", content: data.reply || "(empty)", meta: data }]);
      refreshProgress(data.session_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages(m => [...m, { role: "assistant", content: `⚠ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  const startQuiz = async () => {
    setError(null);
    setQuizResult(null);
    try {
      const keys = loadKeys();
      const r = await fetch(apiUrl("/api/teach/quiz"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          language,
          groq_api_key: keys.groq || "",
          gemini_api_key: keys.gemini || "",
        }),
      });
      const data = await r.json();
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem(LS_SESSION, data.session_id);
      }
      setQuiz(data);
      setQuizAnswers(new Array(data.questions.length).fill(-1));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    try {
      const r = await fetch(apiUrl("/api/teach/quiz/submit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quiz.quiz_id, answers: quizAnswers }),
      });
      const data = await r.json();
      setQuizResult(data);
      setQuiz(null);
      refreshProgress();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startFresh = () => {
    setMessages([]);
    setQuiz(null);
    setQuizResult(null);
    setSessionId(undefined);
    localStorage.removeItem(LS_SESSION);
    setProgress(null);
    setError(null);
  };

  const saveKeys = (keys: ApiKeys) => {
    if (keys.groq !== undefined) localStorage.setItem(LS_GROQ, keys.groq);
    if (keys.gemini !== undefined) localStorage.setItem(LS_GEMINI, keys.gemini);
    setApiKeys(keys);
    setShowKeys(false);
  };

  const setLang = (l: "en" | "hi") => {
    setLanguage(l);
    localStorage.setItem(LS_LANG, l);
    fetch(apiUrl(`/api/teach/tip?lang=${l}`))
      .then(r => r.json())
      .then(d => setDailyTip({ en: d.en, hi: d.hi }))
      .catch(() => {});
  };

  const prompts = language === "hi" ? QUICK_PROMPTS_HI : QUICK_PROMPTS_EN;
  const lastMeta = messages.length > 0 ? messages[messages.length - 1].meta : undefined;
  const followUps = lastMeta?.follow_up_questions || [];

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top bar */}
      <header className="border-b-[3px] border-ink bg-paper sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-mono hover:underline">
            <ArrowLeft size={16} /> Home
          </Link>
          <div className="font-display text-lg ml-2">
            याहवी <span className="text-muted text-sm font-mono">· Excel Teacher</span>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Language toggle */}
            <div className="flex border-[2px] border-ink overflow-hidden">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 text-xs font-mono ${language === "en" ? "bg-ink text-snow" : "bg-snow text-ink hover:bg-paper"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("hi")}
                className={`px-3 py-1.5 text-xs font-mono ${language === "hi" ? "bg-ink text-snow" : "bg-snow text-ink hover:bg-paper"}`}
              >
                हिं
              </button>
            </div>

            {/* Progress badge */}
            {progress && (
              <button
                onClick={() => setShowProgress(!showProgress)}
                className="flex items-center gap-1.5 px-3 py-1.5 border-[2px] border-ink bg-snow hover:bg-primary transition-colors text-xs font-mono"
                title="Your progress"
              >
                <Trophy size={12} className="text-accent" />
                {progress.xp} XP · {progress.level}
              </button>
            )}

            <button
              onClick={() => setShowKeys(true)}
              className={`text-xs font-mono px-3 py-1.5 border-[2px] transition-colors ${
                apiKeys.groq || apiKeys.gemini
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-ink bg-snow text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {apiKeys.groq || apiKeys.gemini ? "Keys ✓" : "🔑 Keys"}
            </button>
            <button onClick={startFresh} title="New chat" className="text-xs font-mono px-3 py-1.5 border-[2px] border-ink bg-snow hover:bg-paper">
              <RefreshCw size={12} className="inline mr-1" /> New
            </button>
          </div>
        </div>
      </header>

      {showKeys && (
        <ApiKeyPanel
          initialGroq={apiKeys.groq || ""}
          initialGemini={apiKeys.gemini || ""}
          onSave={saveKeys}
          onClose={() => setShowKeys(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[1fr,320px] gap-6">
        <main className="min-w-0">
          {/* Hero (only when empty) */}
          {messages.length === 0 && !quiz && !quizResult && (
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary border-[3px] border-ink shadow-neo-sm font-mono text-xs mb-4">
                <Sparkles size={12} /> {language === "hi" ? "मुफ़्त एक्सेल ट्यूटर" : "FREE EXCEL TUTOR · NO SIGNUP"}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-3">
                {language === "hi" ? <>नमस्ते, मैं हूँ<br /><span className="text-accent">याहवी</span> 🌊</> : <>Hello, I'm<br /><span className="text-accent">Yahavi</span> 🌊</>}
              </h1>
              <p className="text-ink/70 text-base sm:text-lg max-w-xl leading-relaxed mb-6">
                {language === "hi"
                  ? <>आपकी एक्सेल टीचर। मैं फ़ॉर्मूले, शॉर्टकट्स, चार्ट्स, पिवट टेबल्स — सब समझाती हूँ क़दम-दर-क़दम। आप मुझसे <b>English</b>, <b>हिंदी</b> या <b>Hinglish</b> में बात कर सकते हैं।</>
                  : <>Your patient Excel teacher. I explain formulas, shortcuts, charts, pivot tables — step by step. Talk to me in <b>English</b>, <b>हिंदी</b>, or <b>Hinglish</b>.</>
                }
              </p>

              {/* Quick prompts */}
              <div className="grid sm:grid-cols-2 gap-2 mb-6">
                {prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p.text)}
                    className="text-left p-3 border-[3px] border-ink bg-snow hover:bg-primary hover:translate-y-[-1px] transition-all shadow-neo-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">{p.icon}</span>
                      <div className="flex-1">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-0.5">{p.short}</div>
                        <div className="text-sm leading-snug">{p.text}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Action cards */}
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <button
                  onClick={startQuiz}
                  className="p-4 border-[3px] border-ink bg-accent text-snow hover:translate-y-[-1px] transition-all shadow-neo-sm text-left"
                >
                  <Target size={20} className="mb-2" />
                  <div className="font-display text-lg leading-tight">{language === "hi" ? "क्विज़ शुरू करें" : "Take a Quiz"}</div>
                  <div className="text-xs opacity-80 mt-1">{language === "hi" ? "5 सवाल · 2 मिनट · असली XP" : "5 questions · 2 minutes · real XP"}</div>
                </button>
                <a
                  href={apiUrl("/api/teach/cheatsheet")}
                  download
                  className="block p-4 border-[3px] border-ink bg-snow hover:bg-primary hover:translate-y-[-1px] transition-all shadow-neo-sm text-left"
                >
                  <FileSpreadsheet size={20} className="mb-2 text-accent" />
                  <div className="font-display text-lg leading-tight">{language === "hi" ? "चीट शीट डाउनलोड" : "Cheat Sheet"}</div>
                  <div className="text-xs text-muted mt-1">{language === "hi" ? "30 फ़ॉर्मूले · 21 शॉर्टकट · 10 चार्ट्स · XLSX" : "30 formulas · 21 shortcuts · 10 charts · XLSX"}</div>
                </a>
                <a
                  href={apiUrl("/api/teach/practice?level=beginner")}
                  download
                  className="block p-4 border-[3px] border-ink bg-snow hover:bg-primary hover:translate-y-[-1px] transition-all shadow-neo-sm text-left"
                >
                  <Zap size={20} className="mb-2 text-accent" />
                  <div className="font-display text-lg leading-tight">{language === "hi" ? "अभ्यास शीट" : "Practice Sheet"}</div>
                  <div className="text-xs text-muted mt-1">{language === "hi" ? "8 कार्य · असली डेटा · हल साथ" : "8 tasks · real data · solutions included"}</div>
                </a>
              </div>

              {/* Daily tip */}
              {dailyTip && (
                <div className="border-[3px] border-ink p-4 bg-paper shadow-neo-sm">
                  <div className="flex items-start gap-2 text-sm">
                    <Lightbulb size={16} className="shrink-0 mt-0.5 text-accent" />
                    <div>
                      <b className="font-mono text-[10px] uppercase tracking-widest text-muted block mb-1">{language === "hi" ? "आज का टिप" : "Tip of the day"}</b>
                      {language === "hi" ? dailyTip.hi : dailyTip.en}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quiz UI */}
          {quiz && (
            <div className="border-[3px] border-ink bg-snow shadow-neo p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">
                  <Target className="inline mr-2 text-accent" size={20} /> {language === "hi" ? "क्विज़" : "Quiz"} · {quiz.total} {language === "hi" ? "सवाल" : "questions"}
                </h2>
                <button onClick={() => setQuiz(null)} className="text-xs text-muted hover:text-ink">{language === "hi" ? "रद्द" : "Cancel"}</button>
              </div>
              <div className="space-y-5">
                {quiz.questions.map((q, qi) => (
                  <div key={qi} className="border-l-[3px] border-accent pl-4">
                    <div className="font-medium mb-2">{qi + 1}. {q.q}</div>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-paper p-1.5 -m-1.5">
                          <input
                            type="radio"
                            name={`q${qi}`}
                            checked={quizAnswers[qi] === oi}
                            onChange={() => {
                              const next = [...quizAnswers];
                              next[qi] = oi;
                              setQuizAnswers(next);
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <NeoButton
                onClick={submitQuiz}
                disabled={quizAnswers.some(a => a === -1)}
                className="mt-5"
              >
                <CheckCircle2 size={14} /> {language === "hi" ? "उत्तर भेजें" : "Submit Answers"}
              </NeoButton>
            </div>
          )}

          {/* Quiz Result */}
          {quizResult && (
            <div className={`border-[3px] border-ink shadow-neo p-5 mb-6 ${quizResult.passed ? "bg-accent/10" : "bg-snow"}`}>
              <h2 className="font-display text-2xl mb-1">
                {quizResult.passed ? "🎉" : "💪"} {language === "hi" ? "आपका स्कोर" : "Your score"}: {quizResult.score} / {quizResult.total}
              </h2>
              <p className="text-sm mb-4">
                {quizResult.percent}% · {language === "hi" ? "स्तर" : "Level"}: <b>{quizResult.new_level}</b> · {language === "hi" ? "अर्जित XP" : "Earned XP"}: <b>+{quizResult.score * 10}</b>
              </p>
              {quizResult.new_badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {quizResult.new_badges.map(b => (
                    <span key={b} className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 bg-accent text-snow border-[2px] border-ink">
                      <Award size={12} /> {BADGE_MAP[b]?.emoji} {BADGE_MAP[b]?.label || b}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-3 mt-5">
                {quizResult.results.map((r, ri) => (
                  <div key={ri} className={`p-3 border-l-[3px] ${r.is_correct ? "border-accent bg-snow" : "border-danger bg-paper"}`}>
                    <div className="flex items-start gap-2 mb-1">
                      {r.is_correct ? <CheckCircle2 size={16} className="text-accent shrink-0 mt-1" /> : <XCircle size={16} className="text-danger shrink-0 mt-1" />}
                      <div className="flex-1">
                        <div className="text-sm font-medium">{ri + 1}. {r.q}</div>
                        <div className="text-xs text-muted mt-1">
                          {language === "hi" ? "आपका उत्तर" : "Your answer"}: <b>{r.options[r.your_answer] ?? "—"}</b>
                          {!r.is_correct && <> · {language === "hi" ? "सही" : "Correct"}: <b className="text-accent">{r.options[r.correct_answer]}</b></>}
                        </div>
                        <div className="text-xs text-ink/80 mt-1.5"><i>{r.explain}</i></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2 flex-wrap">
                <NeoButton onClick={startQuiz}><Target size={14} /> {language === "hi" ? "एक और क्विज़" : "Another Quiz"}</NeoButton>
                <NeoButton variant="ghost" onClick={() => setQuizResult(null)}>{language === "hi" ? "चैट पर वापस" : "Back to chat"}</NeoButton>
              </div>
            </div>
          )}

          {/* Conversation */}
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="inline-block max-w-[85%] px-4 py-2.5 bg-ink text-snow border-[3px] border-ink shadow-neo-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] w-full">
                      <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-widest text-muted">
                        <GraduationCap size={14} /> Yahavi 🌊
                        {m.meta?.lang && <NeoPill variant="snow">lang · {m.meta.lang}</NeoPill>}
                        {m.meta?.level && <NeoPill variant="snow">level · {m.meta.level}</NeoPill>}
                        {m.meta?.ai_used === false && <NeoPill variant="dark">offline</NeoPill>}
                      </div>
                      <div
                        className="bg-snow border-[3px] border-ink shadow-neo-sm p-4 text-[15px]"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                      />
                      {m.meta?.suggested_shortcut && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/40 border-[2px] border-ink text-xs font-mono">
                          <Keyboard size={12} /> {m.meta.suggested_shortcut}
                        </div>
                      )}
                      {m.meta?.homework && (
                        <div className="mt-2 px-3 py-2 bg-paper border-[2px] border-dashed border-ink/40 text-sm">
                          <b className="text-xs font-mono uppercase tracking-widest text-muted">📝 {language === "hi" ? "अभी करके देखें" : "Try it now"}: </b>
                          {m.meta.homework}
                        </div>
                      )}
                      {m.meta?.concepts_covered && m.meta.concepts_covered.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.meta.concepts_covered.map((c, ci) => (
                            <NeoPill key={ci} variant="primary"><BookOpen size={10} /> {c}</NeoPill>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted font-mono">
                <Loader2 size={14} className="animate-spin" /> {language === "hi" ? "याहवी सोच रही है…" : "Yahavi is thinking…"}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger font-mono">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {!busy && !quiz && followUps.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {followUps.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="text-xs font-mono px-3 py-1.5 border-[2px] border-ink bg-snow hover:bg-primary transition-colors"
                  >
                    → {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input bar */}
          {!quiz && !quizResult && (
            <div className="sticky bottom-0 mt-6 pt-3 pb-3 bg-paper border-t-[3px] border-ink">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                  }}
                  placeholder={language === "hi" ? "Excel के बारे में कुछ भी पूछें…" : "Ask anything about Excel… (English / हिंदी / Hinglish)"}
                  disabled={busy}
                  className="flex-1 border-[3px] border-ink bg-snow px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-accent disabled:opacity-50"
                />
                <NeoButton onClick={() => send(input)} disabled={busy || !input.trim()}>
                  <Send size={14} /> {language === "hi" ? "भेजें" : "Send"}
                </NeoButton>
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar — progress */}
        <aside className="space-y-4">
          {progress && progress.tiers && (
            <div className="border-[3px] border-ink bg-snow shadow-neo-sm p-4 sticky top-[76px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base">{language === "hi" ? "आपकी प्रगति" : "Your progress"}</h3>
                <NeoPill variant="primary">{progress.xp} XP</NeoPill>
              </div>

              <div className="mb-3 text-xs font-mono text-muted">
                {language === "hi" ? "स्तर" : "Level"}: <b className="text-ink uppercase">{progress.level}</b>
                {" · "}
                {progress.mastered.length}/{progress.tiers.reduce((a, t) => a + t.total, 0)} {language === "hi" ? "मास्टर" : "mastered"}
              </div>

              <div className="space-y-3">
                {progress.tiers.map(t => (
                  <div key={t.tier}>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span>
                        {language === "hi" ? "स्तर" : "Tier"} {t.tier} · {t.tier === 1 ? (language === "hi" ? "बुनियाद" : "Foundations")
                          : t.tier === 2 ? (language === "hi" ? "मध्यम" : "Intermediate")
                          : t.tier === 3 ? (language === "hi" ? "उन्नत" : "Advanced")
                          : (language === "hi" ? "प्रो" : "Pro")}
                      </span>
                      <span>{t.percent}%</span>
                    </div>
                    <div className="h-2 bg-paper border border-ink/30 overflow-hidden">
                      <div className="h-full bg-accent transition-all" style={{ width: `${t.percent}%` }} />
                    </div>
                    {t.concepts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.concepts.map(c => (
                          <span
                            key={c.id}
                            title={`${c.name} — ${c.status}`}
                            className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                              c.status === "mastered" ? "bg-accent text-snow border-accent"
                              : c.status === "seen" ? "bg-primary/40 text-ink border-ink/30"
                              : "bg-snow text-muted border-ink/20"
                            }`}
                          >
                            {language === "hi" ? c.name_hi : c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {progress.badges.length > 0 && (
                <div className="mt-4 pt-3 border-t border-ink/30">
                  <div className="text-xs font-mono text-muted mb-2">{language === "hi" ? "बैज" : "Badges"}</div>
                  <div className="flex flex-wrap gap-1">
                    {progress.badges.map(b => (
                      <span key={b} title={BADGE_MAP[b]?.label || b} className="text-base">
                        {BADGE_MAP[b]?.emoji || "🏅"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-ink/30 flex gap-2">
                <button
                  onClick={startQuiz}
                  className="flex-1 text-xs font-mono px-2 py-1.5 border-[2px] border-ink bg-accent text-snow hover:translate-y-[-1px] transition-transform"
                >
                  <Target size={11} className="inline mr-1" /> Quiz
                </button>
                <a
                  href={apiUrl("/api/teach/cheatsheet")}
                  download
                  className="flex-1 text-xs font-mono px-2 py-1.5 border-[2px] border-ink bg-snow text-center hover:bg-primary transition-colors"
                >
                  <Download size={11} className="inline mr-1" /> Cheat
                </a>
              </div>

              <a
                href={apiUrl("/api/teach/practice?level=beginner")}
                download
                className="mt-2 block text-xs font-mono px-2 py-1.5 border-[2px] border-ink bg-snow text-center hover:bg-primary transition-colors"
              >
                <Zap size={11} className="inline mr-1" /> Practice Sheet (XLSX)
              </a>

              <Link
                href="/dashboard"
                className="mt-2 block text-xs font-mono px-2 py-1.5 border-[2px] border-ink bg-snow text-center hover:bg-primary transition-colors"
              >
                <FileSpreadsheet size={11} className="inline mr-1" /> Build a Dashboard
              </Link>
            </div>
          )}

          {!progress && (
            <div className="border-[3px] border-ink bg-snow shadow-neo-sm p-4">
              <h3 className="font-display text-base mb-2">{language === "hi" ? "प्रगति यहाँ दिखेगी" : "Progress shows here"}</h3>
              <p className="text-xs text-muted mb-3">
                {language === "hi" ? "क्विज़ देकर अपना स्तर अनलॉक करें।" : "Take a quiz to unlock your level and earn XP."}
              </p>
              <NeoButton size="sm" onClick={startQuiz}><Target size={12} /> {language === "hi" ? "क्विज़" : "Take Quiz"}</NeoButton>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
