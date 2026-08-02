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
        // Superficies y texto se manejan por tokens CSS (globals.css); aquí solo
        // dejamos los nombres semánticos que ya usan los componentes.
        ink: {
          DEFAULT: "#1a2231",
          soft: "#5b6675",
        },
        navy: {
          DEFAULT: "#1c3663",
          700: "#142a4f",
        },
        highlight: {
          DEFAULT: "#fef3c7",
          active: "#fde68a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        xl2: "14px",
      },
      boxShadow: {
        // Sombras muy suaves para las tarjetas (según el brief).
        card: "0 10.5px 25px -5px rgba(16,24,40,0.05), 0 8px 10px -6px rgba(16,24,40,0.04)",
        "card-hover":
          "0 18px 40px -12px rgba(16,24,40,0.12), 0 8px 14px -8px rgba(16,24,40,0.06)",
      },
      maxWidth: {
        reading: "44rem", // ~700px de medida de lectura
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "44rem",
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
