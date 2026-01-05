import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Chess.com-inspired color scheme
        chess: {
          dark: "#779556",
          light: "#ebecd0",
          primary: "#81b64c",
          secondary: "#5d9948",
          bg: {
            primary: "#312e2b",
            secondary: "#272522",
            tertiary: "#21201d",
          },
          text: {
            primary: "#ffffff",
            secondary: "#bababa",
            muted: "#8b8987",
          },
        },
        // Move classification colors
        move: {
          brilliant: "#1baca6",
          great: "#5c8bb0",
          good: "#96bc4b",
          book: "#a88865",
          inaccuracy: "#f7c631",
          mistake: "#e68a2b",
          blunder: "#ca3431",
        },
        // Evaluation colors
        eval: {
          white: "#ffffff",
          black: "#000000",
          advantage: "#96bc4b",
          disadvantage: "#ca3431",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
