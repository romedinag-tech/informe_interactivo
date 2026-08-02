import { brand } from "@/lib/brand";
import { APP_VERSION } from "@/lib/version";

// Pie institucional. Separa la marca del PROVEEDOR (quien ofrece la herramienta)
// de la identidad del MANDANTE (co-branding), sin imitar identidad de gobierno.
export function AppFooter() {
  return (
    <footer
      className="mt-16 border-t"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1" style={{ color: "var(--faint)" }}>
          {brand.legal.map((line, i) => (
            <p key={i} className={i === 0 ? "font-medium text-[color:var(--muted)]" : ""}>
              {line}
            </p>
          ))}
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end" style={{ color: "var(--faint)" }}>
          {brand.client && (
            <span>
              Mandante: <span className="text-[color:var(--muted)]">{brand.client.name}</span>
            </span>
          )}
          <span>
            {brand.platformName} · v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
