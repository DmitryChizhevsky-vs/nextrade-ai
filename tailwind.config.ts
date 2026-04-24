import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // NexTrade brand tokens
        "brand-primary": "#008080",     // Deep Teal
        "brand-primary-hover": "#006D6D",
        "brand-accent": "#39FF14",      // Neon Lime (AI only)
        "bg-app": "#F8F9FA",
        "bg-surface": "#FFFFFF",
        "text-primary": "#1A1A1A",
        "text-muted": "#6C757D",
        "border-hairline": "#E5E7EB",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        "h1": ["60px", { lineHeight: "0.95", letterSpacing: "-0.05em", fontWeight: "700" }],
        "h2": ["36px", { lineHeight: "1",    letterSpacing: "-0.035em", fontWeight: "700" }],
        "h3": ["20px", { lineHeight: "1.2",  letterSpacing: "-0.02em",  fontWeight: "700" }],
        "body": ["15px", { lineHeight: "1.6" }],
        "small": ["13px", { lineHeight: "1.5" }],
        "label": ["11px", { lineHeight: "1.2", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        brand: "4px",
      },
      boxShadow: {
        "brand-sm": "0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
