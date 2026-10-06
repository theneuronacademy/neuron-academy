import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1400px" } },
    extend: {
      colors: {
        navy: {
          DEFAULT: "#24466D",
          dark: "#183653",
          50: "#EEF3F6",
          100: "#DCE6ED",
          200: "#BCD0DE",
          300: "#90AEC2",
          400: "#5E86A1",
          500: "#35617E",
          600: "#183653",
          700: "#24466D",
          800: "#183653",
          900: "#183653",
        },
        teal: {
          DEFAULT: "#008C9E",
          bright: "#1AA6B5",
          50: "#E6F4F6",
          100: "#C9E8EC",
          200: "#9BD3DA",
          300: "#5DBECD",
          400: "#1AA6B5",
          500: "#008C9E",
          600: "#007A8A",
          700: "#006070",
        },
        crimson: { DEFAULT: "#B4453D", bright: "#963A34", 50: "#F9EBEA", 100: "#F2CFCB" },
        silver: { DEFAULT: "#D7DEE4", light: "#EEF3F6", 50: "#F7F9FA", 100: "#EEF3F6", 200: "#D7DEE4", 300: "#CBD3DA", 400: "#93A1AD" },
        gold: { DEFAULT: "#D4AF37", light: "#F4E3A1", pale: "#F9EFC8", dark: "#A67C1A", 50: "#FBF6E3", 100: "#F9EFC8", 200: "#F4E3A1", 300: "#ECD27A", 400: "#D4AF37", 500: "#B8941F", 600: "#A67C1A" },
        background: "#F7F9FA",
        ink: "#172B3A",
        muted: "#667786",
      },
      borderRadius: { card: "18px", "card-lg": "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(36,70,109,0.06), 0 4px 16px rgba(36,70,109,0.07)",
        "card-hover": "0 4px 8px rgba(36,70,109,0.08), 0 12px 28px rgba(36,70,109,0.12)",
        metallic: "inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(36,70,109,0.08)",
      },
      fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"] },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        kenburns: { from: { transform: "scale(1) translate(0, 0)" }, to: { transform: "scale(1.12) translate(-1.5%, 1.5%)" } },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(26, 166, 181, 0.45), 0 8px 30px -8px rgba(180, 69, 61, 0.5)" },
          "50%": { boxShadow: "0 0 0 10px rgba(26, 166, 181, 0), 0 8px 34px -6px rgba(180, 69, 61, 0.65)" },
        },
        "gradient-pan": { "0%, 100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
      },
      animation: { "fade-in": "fade-in 0.5s ease-out both", "slide-up": "slide-up 0.5s ease-out both", marquee: "marquee 28s linear infinite", float: "float 5s ease-in-out infinite", "float-slow": "float 7.5s ease-in-out infinite", kenburns: "kenburns 12s ease-in-out infinite alternate", glow: "glow 2.8s ease-in-out infinite", "gradient-pan": "gradient-pan 6s ease-in-out infinite" },
    },
  },
  plugins: [animate],
};

export default config;
