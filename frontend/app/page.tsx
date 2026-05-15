"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import NeoButton from "@/components/neo/NeoButton";
import NeoCard from "@/components/neo/NeoCard";
import NeoPill from "@/components/neo/NeoPill";
import LanguageToggle from "@/components/neo/LanguageToggle";
import {
  Image as ImageIcon, Video, FileText, FileSpreadsheet, Database,
  MessageSquare, Sparkles, Calculator, Layers, Zap, ArrowRight,
  Github, Mic, IndianRupee,
} from "lucide-react";

const INPUTS = [
  { icon: ImageIcon, name: "Image", desc: "Screenshot, photo, scan, handwriting — even blurry." },
  { icon: Video, name: "Video", desc: "Screen recording of any dashboard or sheet." },
  { icon: FileText, name: "PDF", desc: "Reports, scanned tables, financial statements." },
  { icon: FileSpreadsheet, name: "Excel", desc: "Rebrand, enhance or fully redesign workbooks." },
  { icon: Database, name: "CSV · JSON · XML", desc: "Raw data of any structure — schema auto-detected." },
  { icon: Layers, name: "Google Sheets link", desc: "Paste a URL and we pull the data." },
  { icon: Calculator, name: "DB query result", desc: "Paste output from any database or app." },
  { icon: MessageSquare, name: "Natural-language prompt", desc: "Describe the dashboard — we design it." },
  { icon: Sparkles, name: "Calculation description", desc: "Numbers + intent — we write the formulas." },
  { icon: Zap, name: "Mixed input", desc: "Image + extra data + description, merged smartly." },
];

const THEMES = [
  { name: "midnight", colors: ["#1E3A5F", "#FFC000"] },
  { name: "emerald", colors: ["#1A3C2E", "#70AD47"] },
  { name: "crimson", colors: ["#7B0000", "#FFFFFF"] },
  { name: "slate", colors: ["#2D3748", "#63B3ED"] },
  { name: "amber", colors: ["#3D1F00", "#F59E0B"] },
  { name: "ocean", colors: ["#0F4C5C", "#22D3EE"] },
  { name: "violet", colors: ["#2D1B69", "#A78BFA"] },
  { name: "rose", colors: ["#7C3048", "#FBCFE8"] },
  { name: "carbon", colors: ["#0A0A0A", "#00FF41"] },
  { name: "arctic", colors: ["#FFFFFF", "#BFDBFE"] },
];

const MARQUEE = ["IMAGE", "VIDEO", "PDF", "EXCEL", "CSV", "JSON", "GOOGLE SHEETS", "SQL PASTE", "TEXT PROMPT", "MIXED"];

export default function HomePage() {
  const { t } = useI18n();
  return (
    <main className="relative">
      {/* ───── Nav ───── */}
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper/95 backdrop-blur">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 bg-primary border-[3px] border-ink shadow-neo-sm font-display text-lg">Y</span>
            <span className="font-display text-lg sm:text-xl">
              YAI-<span className="bg-ink text-snow px-1.5">EXCEL</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <a href="#inputs" className="text-sm font-semibold hover:underline underline-offset-4 decoration-[3px] decoration-primary">{t.nav.inputs}</a>
            <a href="#themes" className="text-sm font-semibold hover:underline underline-offset-4 decoration-[3px] decoration-secondary">{t.nav.themes}</a>
            <a href="#how" className="text-sm font-semibold hover:underline underline-offset-4 decoration-[3px] decoration-accent">{t.nav.how}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/dashboard">
              <NeoButton size="sm">{t.nav.tryFree}</NeoButton>
            </Link>
          </div>
        </nav>
        {/* marquee */}
        <div className="bg-ink text-snow overflow-hidden border-t-[3px] border-ink">
          <div className="flex gap-10 animate-marquee whitespace-nowrap py-1.5 text-xs font-mono tracking-widest">
            {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="flex items-center gap-10">
                <span>{w}</span>
                <span className="text-primary">✺</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-16 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              <NeoPill variant="primary">v1.1 · NEW</NeoPill>
              <NeoPill variant="dark">{t.badges.free}</NeoPill>
              <NeoPill variant="pink">{t.badges.themes}</NeoPill>
              <NeoPill variant="blue">{t.badges.charts}</NeoPill>
            </div>
            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.92]">
              {t.hero.title1}{" "}
              <span className="inline-block bg-primary px-3 border-[3px] border-ink shadow-neo">{t.hero.title2}</span>.
              <br />
              {t.hero.title3}
            </h1>
            <p className="mt-6 text-base sm:text-lg max-w-2xl text-ink/80">{t.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard"><NeoButton size="lg">{t.hero.cta}</NeoButton></Link>
              <a href="https://github.com/gaganchauhan1997/YAI-Excel" target="_blank" rel="noopener noreferrer">
                <NeoButton variant="snow" size="lg">
                  <Github size={18} /> {t.hero.ghost}
                </NeoButton>
              </a>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-muted">
              <Mic size={14} /> Voice: "Yahavi, dashboard banao" ·
              <IndianRupee size={14} /> ₹ Lakhs / Crores baked in
            </div>
          </div>

          {/* Mock dashboard preview */}
          <div className="relative">
            <NeoCard className="!p-0 overflow-hidden" tilt="r">
              <div className="bg-ink text-snow text-xs font-mono px-4 py-2 flex justify-between border-b-[3px] border-ink">
                <span>yai-excel · Dashboard.xlsx</span>
                <span className="text-primary">●●●</span>
              </div>
              <div className="p-5 bg-snow">
                <div className="font-display text-xl mb-3">SALES DASHBOARD · Q4</div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { l: "Revenue", v: "₹1.84 Cr", c: "bg-primary" },
                    { l: "Cost", v: "₹1.12 Cr", c: "bg-secondary" },
                    { l: "Profit", v: "₹72 L", c: "bg-accent text-snow" },
                    { l: "Margin", v: "39%", c: "bg-success" },
                  ].map((k) => (
                    <div key={k.l} className={`border-[3px] border-ink p-3 shadow-neo-sm ${k.c}`}>
                      <div className="text-[10px] font-mono uppercase opacity-80">{k.l}</div>
                      <div className="font-display text-xl mt-1">{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="border-[3px] border-ink bg-paper">
                  <div className="flex items-end gap-1 h-24 px-3 py-2">
                    {[40, 65, 50, 80, 70, 92, 58, 75, 88, 95].map((h, i) => (
                      <div key={i} className="flex-1 bg-ink border-r-[2px] border-paper" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </NeoCard>
            <div className="hidden sm:block absolute -bottom-6 -left-6">
              <NeoPill variant="dark">+ 12 charts · 6 KPIs · 1 pivot</NeoPill>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-ink py-2"></div>

      {/* ───── Inputs ───── */}
      <section id="inputs" className="px-4 sm:px-6 py-16 sm:py-24 max-w-7xl mx-auto">
        <header className="mb-10">
          <h2 className="font-display text-4xl sm:text-6xl">{t.sections.inputs}</h2>
          <p className="text-muted mt-2 max-w-2xl">{t.sections.inputsSub}</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
          {INPUTS.map((m, i) => (
            <NeoCard
              key={m.name}
              hover
              shadow={i % 3 === 0 ? "primary" : i % 3 === 1 ? "pink" : "blue"}
              className="!p-4"
            >
              <m.icon size={28} strokeWidth={2.5} />
              <h3 className="font-display mt-3 text-lg">{m.name}</h3>
              <p className="text-sm text-ink/70 mt-1">{m.desc}</p>
            </NeoCard>
          ))}
        </div>
      </section>

      <div className="bg-ink py-2"></div>

      {/* ───── Themes ───── */}
      <section id="themes" className="px-4 sm:px-6 py-16 sm:py-24 max-w-7xl mx-auto">
        <header className="mb-10">
          <h2 className="font-display text-4xl sm:text-6xl">{t.sections.themes}</h2>
          <p className="text-muted mt-2 max-w-2xl">{t.sections.themesSub}</p>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {THEMES.map((th, i) => (
            <NeoCard key={th.name} className="!p-4" shadow={i % 2 ? "pink" : "primary"}>
              <div className="flex gap-2 mb-3">
                {th.colors.map((c) => (
                  <span key={c} className="w-10 h-10 border-[3px] border-ink" style={{ background: c }} />
                ))}
              </div>
              <div className="font-display capitalize">{th.name}</div>
            </NeoCard>
          ))}
        </div>
      </section>

      <div className="bg-ink py-2"></div>

      {/* ───── How it works ───── */}
      <section id="how" className="px-4 sm:px-6 py-16 sm:py-24 max-w-6xl mx-auto">
        <header className="mb-10">
          <h2 className="font-display text-4xl sm:text-6xl">{t.sections.how}</h2>
        </header>
        <div className="grid md:grid-cols-3 gap-5">
          {t.steps.map((s, i) => (
            <NeoCard key={s.n} className="!p-6" shadow={["primary", "pink", "blue"][i] as any}>
              <div className="font-mono text-sm text-muted">{s.n}</div>
              <h3 className="font-display text-2xl mt-2">{s.t}</h3>
              <p className="text-sm text-ink/70 mt-2">{s.d}</p>
            </NeoCard>
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="px-4 sm:px-6 py-16 max-w-5xl mx-auto">
        <div className="bg-ink text-snow border-[3px] border-ink shadow-neo-xl p-8 sm:p-14 text-center">
          <h2 className="font-display text-4xl sm:text-6xl">FREE INTELLIGENCE.<br />INFINITE CAPABILITY.</h2>
          <p className="text-snow/70 mt-4 max-w-xl mx-auto">
            100% open source. MIT. Built on free-tier APIs — Gemini, Groq, OpenAI, Claude. Rotate, fall back, never pay until you choose to.
          </p>
          <div className="mt-7 flex justify-center gap-3 flex-wrap">
            <Link href="/dashboard"><NeoButton size="lg" variant="primary">{t.hero.cta}</NeoButton></Link>
            <a href="https://github.com/gaganchauhan1997/YAI-Excel" target="_blank" rel="noopener noreferrer">
              <NeoButton size="lg" variant="snow"><Github size={18} /> GitHub</NeoButton>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t-[3px] border-ink py-6 px-4 sm:px-6 text-center text-sm font-mono">
        © 2026 Hackknow · part of YAHAVIS AI · MIT
      </footer>
    </main>
  );
}
