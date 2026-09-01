import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      colors: {
        navy: {
          950: "#060B18",
          900: "#0A0F1E",
          800: "#0F172A",
          700: "#1A2540",
          600: "#1E293B",
        },
        warm: {
          50: "#FFFBF5",
          100: "#FFF4E8",
          200: "#FFE4CC",
          900: "#2A1810",
          950: "#1A100C",
        },
        tomato: {
          400: "#F8715A",
          500: "#EF5538",
          600: "#DC4533",
          700: "#C03628",
        },
        sun: {
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
        },
        brand: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(234, 88, 12, 0.1), 0 1px 2px rgba(234, 88, 12, 0.04), inset 0 1px 0 rgba(255,255,255,0.7)",
        "card-dark": "0 8px 32px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        elevated: "0 12px 40px -12px rgba(249, 115, 22, 0.22)",
        gloss: "0 8px 32px -8px rgba(249, 115, 22, 0.18), inset 0 1px 0 rgba(255,255,255,0.75)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "brand-gradient": "linear-gradient(135deg, #DC4533 0%, #F97316 45%, #FBBF24 100%)",
        "gloss-warm":
          "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(255,244,232,0.92) 45%, rgba(255,237,213,0.88) 100%)",
        "gloss-warm-dark":
          "linear-gradient(145deg, rgba(42,24,16,0.96) 0%, rgba(38,24,20,0.94) 50%, rgba(26,16,12,0.98) 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "dialog-enter": "dialogEnter 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "backdrop-enter": "backdropEnter 0.2s ease-out forwards",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        dialogEnter: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        backdropEnter: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
