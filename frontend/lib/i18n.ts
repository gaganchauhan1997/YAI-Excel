"use client";

import { createContext, useContext, useState, ReactNode, createElement } from "react";

export type Locale = "en" | "hi";

const STRINGS = {
  en: {
    nav: { inputs: "Inputs", themes: "Themes", how: "How it works", tryFree: "Try free" },
    hero: {
      title1: "Give us",
      title2: "anything",
      title3: "Get a dashboard.",
      sub: "Drop a screenshot, video, PDF, Excel, CSV or just describe what you need. YAI-Excel returns a fully interactive, formula-complete, enterprise-grade workbook.",
      cta: "Try free →",
      ghost: "Star on GitHub",
    },
    badges: { free: "100% free tier", mit: "MIT licensed", themes: "10 themes", charts: "20+ chart types" },
    sections: {
      inputs: "10 INPUTS. ONE ENGINE.",
      inputsSub: "Anything goes in. A complete dashboard comes out.",
      themes: "10 THEMES BUILT IN",
      themesSub: "Switch the entire workbook palette in one click.",
      how: "HOW IT WORKS",
    },
    steps: [
      { n: "01", t: "Drop anything", d: "Image, video, PDF, Excel, CSV, JSON, link, prompt — anything." },
      { n: "02", t: "AI audits every pixel", d: "Vision + reasoning detect every chart, KPI, formula, layout band." },
      { n: "03", t: "Download a finished workbook", d: "Interactive, formula-complete, theme-perfect — in seconds." },
    ],
    studio: {
      menu: "Menu",
      newDashboard: "New dashboard",
      yourDashboards: "Your dashboards",
      empty: "Drop a file or describe a dashboard.",
      modelLabel: "Model",
      themeLabel: "Theme",
      indianFormat: "Indian (₹ L / Cr)",
      placeholder: "Describe a dashboard, or drop a file…",
      send: "Generate",
      tip: "Tip: drop image, video, PDF, Excel, CSV or just type",
      thinking: "Thinking…",
      downloading: "Downloading workbook…",
      open: "Open .xlsx",
      retry: "Retry",
      stages: [
        "Detecting input",
        "Enhancing image / extracting frames",
        "Running vision audit",
        "Merging detected elements",
        "Designing dashboard schema",
        "Creating sheets",
        "Writing raw data",
        "Building named ranges",
        "Building interactive controls",
        "Building pivots",
        "Building charts",
        "Building KPI cards",
        "Building data tables",
        "Applying conditional formats",
        "Wiring data validation",
        "Applying theme",
        "Running quality gates",
        "Saving workbook",
      ],
    },
    footer: "Built by Hackknow · part of YAHAVIS AI · MIT",
  },
  hi: {
    nav: { inputs: "इनपुट्स", themes: "थीम्स", how: "कैसे काम करता है", tryFree: "मुफ्त आज़माएँ" },
    hero: {
      title1: "हमें दीजिए",
      title2: "कुछ भी",
      title3: "लीजिए एक डैशबोर्ड।",
      sub: "स्क्रीनशॉट, वीडियो, PDF, Excel, CSV डालिए — या बस बताइए क्या चाहिए। YAI-Excel एक पूरा इंटरैक्टिव, फ़ॉर्मूला-कम्प्लीट, एंटरप्राइज़-ग्रेड वर्कबुक देगा।",
      cta: "मुफ्त आज़माएँ →",
      ghost: "GitHub पर स्टार दें",
    },
    badges: { free: "100% मुफ्त", mit: "MIT लाइसेंस", themes: "10 थीम्स", charts: "20+ चार्ट्स" },
    sections: {
      inputs: "10 इनपुट्स। एक इंजन।",
      inputsSub: "कुछ भी अंदर। पूरा डैशबोर्ड बाहर।",
      themes: "10 बिल्ट-इन थीम्स",
      themesSub: "एक क्लिक में पूरी वर्कबुक का रंग बदलें।",
      how: "यह कैसे काम करता है",
    },
    steps: [
      { n: "०१", t: "कुछ भी डालें", d: "तस्वीर, वीडियो, PDF, Excel, CSV, JSON, लिंक, प्रॉम्प्ट — कुछ भी।" },
      { n: "०२", t: "AI हर पिक्सेल जाँचता है", d: "विज़न + रीज़निंग हर चार्ट, KPI, फ़ॉर्मूला, लेआउट पहचानते हैं।" },
      { n: "०३", t: "तैयार वर्कबुक डाउनलोड करें", d: "इंटरैक्टिव, फ़ॉर्मूला-कम्प्लीट, थीम-परफेक्ट — कुछ ही सेकंड में।" },
    ],
    studio: {
      menu: "मेनू",
      newDashboard: "नया डैशबोर्ड",
      yourDashboards: "आपके डैशबोर्ड",
      empty: "फ़ाइल डालें या डैशबोर्ड का विवरण दें।",
      modelLabel: "मॉडल",
      themeLabel: "थीम",
      indianFormat: "भारतीय (₹ लाख / करोड़)",
      placeholder: "डैशबोर्ड का विवरण दें या फ़ाइल डालें…",
      send: "बनाएँ",
      tip: "इमेज, वीडियो, PDF, Excel, CSV डालें या टाइप करें",
      thinking: "सोच रहा हूँ…",
      downloading: "वर्कबुक डाउनलोड…",
      open: ".xlsx खोलें",
      retry: "फिर से",
      stages: [
        "इनपुट पहचान रहा हूँ",
        "इमेज सुधार / फ़्रेम निकाल रहा हूँ",
        "विज़न ऑडिट चला रहा हूँ",
        "तत्वों को मिला रहा हूँ",
        "डैशबोर्ड डिज़ाइन कर रहा हूँ",
        "शीट्स बना रहा हूँ",
        "डेटा लिख रहा हूँ",
        "नेम्ड रेंज बना रहा हूँ",
        "इंटरैक्टिव कंट्रोल बना रहा हूँ",
        "पिवट बना रहा हूँ",
        "चार्ट बना रहा हूँ",
        "KPI कार्ड बना रहा हूँ",
        "डेटा टेबल बना रहा हूँ",
        "कंडीशनल फ़ॉर्मेट लगा रहा हूँ",
        "डेटा वैलिडेशन जोड़ रहा हूँ",
        "थीम लगा रहा हूँ",
        "क्वालिटी गेट्स",
        "वर्कबुक सेव कर रहा हूँ",
      ],
    },
    footer: "Hackknow द्वारा निर्मित · YAHAVIS AI का हिस्सा · MIT",
  },
};

type Strings = typeof STRINGS.en;

const I18nCtx = createContext<{ locale: Locale; t: Strings; setLocale: (l: Locale) => void }>({
  locale: "en",
  t: STRINGS.en,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  return createElement(I18nCtx.Provider, { value: { locale, t: STRINGS[locale], setLocale } }, children);
}

export const useI18n = () => useContext(I18nCtx);
export const t = STRINGS;
