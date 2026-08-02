"use client";

import { useEffect, useState } from "react";
import { brand, pickLogo, type LogoSlot } from "@/lib/brand";

// Emblema neutro de plataforma (fallback si la marca no trae logo). Monoline,
// usa currentColor → toma el acento del tema. NO es identidad de ningún cliente.
function PlatformMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-hidden>
      <rect x="4" y="3" width="13" height="18" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h6M8 12h6M8 16h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="16.5" r="4" fill="var(--paper)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.8 16.6l1.2 1.2 2.1-2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useTheme(): "light" | "dark" | "sepia" {
  const [t, setT] = useState<"light" | "dark" | "sepia">("light");
  useEffect(() => {
    const read = () =>
      setT((document.documentElement.getAttribute("data-theme") as typeof t) || "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

/**
 * Marca del proveedor. Muestra el logo configurado en `brand` si existe; si no,
 * cae a emblema neutro + nombre de la plataforma. `slot` elige la variante.
 */
export function BrandMark({
  slot = "header",
  className = "h-5 w-5",
  showName = true,
}: {
  slot?: LogoSlot;
  className?: string;
  showName?: boolean;
}) {
  const theme = useTheme();
  const logo = pickLogo(slot, theme);

  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={brand.platformName} className={className} />;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <PlatformMark className={className} />
      {showName && (
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
          {brand.platformName}
        </span>
      )}
    </span>
  );
}
