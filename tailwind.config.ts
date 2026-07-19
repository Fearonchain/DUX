import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        "bg-soft": "#f4f5f7",
        card: "#ffffff",
        line: "#e3e6ea",
        ink: "#0a0a0a",
        "ink-dim": "#6b7280",
        accent: "#111111",
        "accent-dark": "#333333",
        danger: "#d92d20",
        up: "#16a34a",
        "up-soft": "#dcfce7",
        down: "#dc2626",
        "down-soft": "#fee2e2",
        brand: "#6d5efc",
        "brand-soft": "#eef0ff",
      },
      fontFamily: {
        mono: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "flash-border": {
          "0%": { borderColor: "#111111", boxShadow: "0 0 18px rgba(17,17,17,0.25)" },
          "100%": { borderColor: "#e3e6ea", boxShadow: "none" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        flash: "flash-border 4s ease-out",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "fade-in": "fade-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
