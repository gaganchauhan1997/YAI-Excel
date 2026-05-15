"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Video,
  FileText,
  FileSpreadsheet,
  Database,
  MessageSquare,
  Sparkles,
  Calculator,
  Layers,
  Zap,
  ArrowRight,
} from "lucide-react";

const inputModes = [
  { icon: ImageIcon, name: "Image", desc: "Screenshot, photo, scan, handwriting — even blurry." },
  { icon: Video, name: "Video", desc: "Screen recording of any dashboard or sheet." },
  { icon: FileText, name: "PDF", desc: "Report PDFs, scanned tables, financial statements." },
  { icon: FileSpreadsheet, name: "Excel", desc: "Rebrand, enhance, or fully redesign existing workbooks." },
  { icon: Database, name: "CSV / JSON / XML", desc: "Raw data of any structure — AI detects schema." },
  { icon: Layers, name: "Google Sheets link", desc: "Paste a URL and we'll pull the data." },
  { icon: Calculator, name: "DB query result", desc: "Paste output from any database or app." },
  { icon: MessageSquare, name: "Natural-language prompt", desc: "Describe the dashboard — we design it." },
  { icon: Sparkles, name: "Calculation description", desc: "Numbers + intent — we write the formulas." },
  { icon: Zap, name: "Mixed input", desc: "Combine image + extra data + description in one go." },
];

const themes = [
  { name: "Midnight", colors: ["#1E3A5F", "#FFC000"] },
  { name: "Emerald", colors: ["#1A3C2E", "#70AD47"] },
  { name: "Crimson", colors: ["#7B0000", "#FFFFFF"] },
  { name: "Slate", colors: ["#2D3748", "#63B3ED"] },
  { name: "Amber", colors: ["#3D1F00", "#F59E0B"] },
  { name: "Ocean", colors: ["#0F4C5C", "#22D3EE"] },
  { name: "Violet", colors: ["#2D1B69", "#A78BFA"] },
  { name: "Rose", colors: ["#7C3048", "#FBCFE8"] },
  { name: "Carbon", colors: ["#0A0A0A", "#00FF41"] },
  { name: "Arctic", colors: ["#FFFFFF", "#BFDBFE"] },
];

const steps = [
  { n: "01", title: "Drop anything", desc: "Image, video, PDF, Excel, CSV, JSON, link, prompt — anything." },
  { n: "02", title: "AI audits every pixel", desc: "Vision + reasoning detect every chart, KPI, formula, layout band." },
  { n: "03", title: "Download a finished workbook", desc: "Interactive, formula-complete, theme-perfect — in seconds." },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-bg/60 border-b border-white/5">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold">
            <span className="gradient-text">YAI</span>-Excel
          </Link>
          <div className="flex items-center gap-6">
            <Link href="#modes" className="text-sm text-muted hover:text-text">Inputs</Link>
            <Link href="#themes" className="text-sm text-muted hover:text-text">Themes</Link>
            <Link href="#how" className="text-sm text-muted hover:text-text">How it works</Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium px-4 py-2 rounded-full bg-primary text-white hover:bg-primary/80 transition"
            >
              Try free
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-32 px-6 max-w-6xl mx-auto text-center relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,#6366f130,transparent_60%)]" />
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-display text-6xl md:text-8xl font-bold leading-[0.95]"
        >
          Give us <span className="gradient-text">anything</span>.<br />
          Get a dashboard.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="mt-8 text-lg md:text-xl text-muted max-w-2xl mx-auto"
        >
          A universal dashboard intelligence system. Drop a screenshot, video, PDF, Excel
          file, CSV, or just describe it in plain English — YAI-Excel returns a fully
          interactive, formula-complete, enterprise-grade workbook.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary/80 transition glow"
          >
            Try free <ArrowRight size={18} />
          </Link>
          <a
            href="https://github.com/gaganchauhan1997/YAI-Excel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-text hover:bg-white/5 transition"
          >
            Star on GitHub
          </a>
        </motion.div>
      </section>

      {/* Input modes */}
      <section id="modes" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold">10 inputs. One engine.</h2>
          <p className="text-muted mt-3">Anything goes in. A complete dashboard comes out.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {inputModes.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              viewport={{ once: true }}
              className="card p-5 hover:border-primary/40 hover:bg-white/[0.04] transition group"
            >
              <m.icon className="text-primary group-hover:text-accent transition" size={28} />
              <h3 className="mt-4 font-semibold">{m.name}</h3>
              <p className="text-sm text-muted mt-1">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold">10 themes built in</h2>
          <p className="text-muted mt-3">Switch the entire workbook palette in one click.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {themes.map((t) => (
            <div key={t.name} className="card p-4">
              <div className="flex gap-2 mb-3">
                {t.colors.map((c) => (
                  <span
                    key={c}
                    className="w-10 h-10 rounded-lg border border-white/10"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <h3 className="font-semibold">{t.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold">How it works</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="font-mono text-accent">{s.n}</span>
              <h3 className="font-display text-2xl mt-3">{s.title}</h3>
              <p className="text-muted mt-2 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold">Free intelligence. Infinite capability.</h2>
        <p className="text-muted mt-3">100% open source. MIT licensed. Free-tier APIs only.</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-white font-medium hover:bg-primary/80 transition glow"
        >
          Try YAI-Excel free <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="py-10 px-6 text-center text-muted text-sm border-t border-white/5">
        Built by <a href="https://hackknow.com" className="text-text hover:text-primary">Hackknow</a> · MIT · Part of the YAHAVIS AI ecosystem
      </footer>
    </main>
  );
}
