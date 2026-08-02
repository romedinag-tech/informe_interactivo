"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "sepia";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀" },
  { value: "sepia", label: "Sepia", icon: "❦" },
  { value: "dark", label: "Oscuro", icon: "☾" },
];

function apply(theme: Theme) {
  const r = document.documentElement;
  r.setAttribute("data-theme", theme);
  r.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme((localStorage.getItem("theme") as Theme) || "light");
  }, []);

  const change = (t: Theme) => {
    setTheme(t);
    apply(t);
  };

  return (
    <div
      role="group"
      aria-label="Tema de lectura"
      className="inline-flex items-center gap-0.5 rounded-full border p-0.5"
      style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
    >
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            onClick={() => change(o.value)}
            aria-pressed={active}
            title={`Tema ${o.label.toLowerCase()}`}
            className="ring-focus rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            style={
              active
                ? {
                    background: "var(--surface)",
                    color: "var(--accent)",
                    boxShadow: "var(--shadow-soft)",
                  }
                : { color: "var(--muted)", background: "transparent" }
            }
          >
            <span aria-hidden>{o.icon}</span>
            <span className="ml-1 hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
