import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#090914",
        indigoDeep: "#15112B",
        surface: "#1B1638",
        violet: { DEFAULT: "#8B5CF6", neon: "#A855F7" },
        cyan: { DEFAULT: "#22D3EE", soft: "#67E8F9" },
        magenta: "#EC4899",
        orange: { DEFAULT: "#FB923C" },
        gold: "#FACC15",
        lime: "#A3E635",
        softwhite: "#F8FAFC",
        muted: "#A1A1B5",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        display: [
          "ui-rounded",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 32px -6px rgba(168,85,247,0.55)",
        "glow-cyan": "0 0 32px -6px rgba(34,211,238,0.5)",
        "glow-gold": "0 0 32px -6px rgba(250,204,21,0.4)",
        inner1: "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      backdropBlur: { xs: "2px" },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-6px) scale(1.01)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "0.95" },
        },
        wavebar: {
          "0%,100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        pulseGlow: "pulseGlow 4s ease-in-out infinite",
        wavebar: "wavebar 1.1s ease-in-out infinite",
        rise: "rise 0.5s ease-out both",
        ticker: "ticker 28s linear infinite",
      },
      transitionTimingFunction: {
        studio: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
