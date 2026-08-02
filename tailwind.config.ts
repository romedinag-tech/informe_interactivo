import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta sobria de nivel ministerial.
        ink: {
          DEFAULT: "#1f2a37",
          soft: "#4b5563",
        },
        navy: {
          DEFAULT: "#1e3a5f",
          700: "#182f4d",
        },
        highlight: {
          // Resaltado de fragmentos con observaciones.
          DEFAULT: "#fef3c7",
          active: "#fde68a",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: ["-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "72ch",
            color: "#1f2a37",
            h1: { fontFamily: "Georgia, serif" },
            h2: { fontFamily: "Georgia, serif" },
            h3: { fontFamily: "Georgia, serif" },
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
