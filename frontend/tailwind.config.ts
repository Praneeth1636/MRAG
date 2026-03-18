import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e1a",
        "surface-1": "#111827",
        "surface-2": "#1a2236",
        "surface-3": "#232d42",
        "border-default": "#1e293b",
        "border-hover": "#334155",
        accent: "#22d3ee",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(34,211,238,0.15)",
        "glow-emerald": "0 0 20px rgba(52,211,153,0.12)",
        lifted: "0 8px 32px rgba(0,0,0,0.4)",
        deep: "0 16px 48px rgba(0,0,0,0.5)",
      },
      animation: {
        fade: "fadeIn 0.35s ease-out both",
        slide: "slideIn 0.3s ease-out both",
        scale: "scaleIn 0.25s ease-out both",
        gauge: "drawGauge 1.4s cubic-bezier(0.22,1,0.36,1) both",
        pulse: "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

