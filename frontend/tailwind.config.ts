import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#F5F1E8",
        snow: "#FFFFFF",
        sand: "#EFE8D8",
        line: "#0A0A0A",
        primary: "#FFD300",
        secondary: "#FF6BCB",
        accent: "#4F7DF3",
        success: "#5EE49B",
        danger: "#FF5470",
        muted: "#6B6657",
      },
      fontFamily: {
        display: ["'Archivo Black'", "'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Space Grotesk'", "'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Menlo", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        neo: "5px 5px 0 0 #0A0A0A",
        "neo-sm": "3px 3px 0 0 #0A0A0A",
        "neo-lg": "8px 8px 0 0 #0A0A0A",
        "neo-xl": "12px 12px 0 0 #0A0A0A",
        "neo-primary": "5px 5px 0 0 #FFD300",
        "neo-pink": "5px 5px 0 0 #FF6BCB",
        "neo-blue": "5px 5px 0 0 #4F7DF3",
        "neo-inset": "inset 4px 4px 0 0 #0A0A0A",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-0.6deg)" },
          "50%": { transform: "rotate(0.6deg)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        wiggle: "wiggle 1.4s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
