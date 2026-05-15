import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0c0c10",
        surface: "#16161e",
        primary: "#6366f1",
        accent: "#22d3ee",
        text: "#f1f5f9",
        muted: "#64748b",
      },
      fontFamily: {
        display: ["'Clash Display'", "Inter", "system-ui", "sans-serif"],
        body: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 60px -10px rgba(99,102,241,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
