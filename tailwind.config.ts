import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 24px 60px rgba(1, 30, 65, 0.18)",
        glow: "0 0 0 1px rgba(245, 168, 0, 0.28), 0 14px 40px rgba(245, 168, 0, 0.18)"
      },
      colors: {
        brand: {
          amber: "var(--brand-amber-core)",
          "amber-bright": "var(--brand-amber-bright)",
          indigo: "var(--brand-indigo-dark)",
          "indigo-core": "var(--brand-indigo-core)",
          "indigo-bright": "var(--brand-indigo-bright)"
        }
      },
      fontFamily: {
        sans: [
          "\"Helvetica Now Display\"",
          "\"Helvetica Now Text\"",
          "Arial",
          "Helvetica",
          "sans-serif"
        ]
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 168, 0, 0.14)" },
          "50%": { boxShadow: "0 0 0 10px rgba(245, 168, 0, 0)" }
        }
      },
      animation: {
        "pulse-glow": "pulseGlow 2.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
