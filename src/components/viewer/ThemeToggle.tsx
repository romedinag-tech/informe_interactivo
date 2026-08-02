"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "sepia";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀️" },
  { value: "sepia", label: "Sepia", icon: "📖" },
  { value: "dark", label: "Oscuro", icon: "🌙" },
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
    const saved = (localStorage.getItem("theme") as Theme) || "light";
    setTheme(saved);
  }, []);

  const change = (t: Theme) => {
    setTheme(t);
    apply(t);
  };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => change(o.value)}
          title={o.label}
          aria-pressed={theme === o.value}
          className={`rounded-full px-2 py-1 text-xs transition ${
            theme === o.value
              ? "bg-navy text-white"
              : "text-ink-soft hover:bg-gray-100"
          }`}
        >
          <span aria-hidden>{o.icon}</span>
          <span className="ml-1 hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
