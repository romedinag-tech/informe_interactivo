// ─────────────────────────────────────────────────────────────
// Capa de marca (white-label). ÚNICA fuente de identidad del proveedor.
// Cambiar de empresa = editar SOLO este archivo (y dejar sus assets en
// /public/brand). Cero nombres/logos hardcodeados en los componentes.
//
// Los colores de tema viven en globals.css (design tokens); `accent` aquí es
// un override opcional para derivar la identidad desde la marca (validar AA).
// ─────────────────────────────────────────────────────────────

export type BrandLogos = {
  /** Lockup horizontal (isotipo + nombre). Header en escritorio. */
  lockup?: string;
  /** Variante clara del lockup, para fondos oscuros (tema oscuro). */
  lockupDark?: string;
  /** Logo vertical / grande. Portada. */
  vertical?: string;
  /** Isotipo (marca sola). Móvil, splash, estados vacíos, favicon. */
  isotype?: string;
  /** Monocromo. Footer, marca de agua PDF. */
  mono?: string;
};

export type CoBrand = {
  /** Mandante / cliente (p. ej. MTT–SECTRA). NO se imita identidad de gobierno. */
  name: string;
  logo?: string;
  logoDark?: string;
};

export type BrandConfig = {
  /** Nombre de la plataforma (producto). */
  platformName: string;
  /** Razón social del proveedor que ofrece la herramienta. */
  providerName: string;
  /** Nombre corto del proveedor (chips, footer compacto). */
  providerShort: string;
  tagline?: string;
  /** Emoji o ruta para el favicon/pestaña (fallback si no hay isotipo). */
  favicon: string;
  /** Override opcional del token --accent (debe validar contraste AA). */
  accent?: string;
  logos: BrandLogos;
  /** Co-branding del mandante (separado de la marca del proveedor). */
  client?: CoBrand;
  /** Líneas legales del footer. */
  legal: string[];
  /** Hero de portada ejecutiva (video configurable por ciudad/proyecto). */
  hero?: {
    /** Video de fondo (sobrevuelo). Solo material con licencia adecuada. */
    video?: string;
    /** Imagen poster (fallback y mientras carga). */
    poster?: string;
    /** Crédito/atribución del video, si la licencia lo exige. */
    credit?: string;
  };
};

// Marca por defecto: el proveedor actual. Reemplazable íntegramente por cliente.
export const brand: BrandConfig = {
  platformName: "Informes Interactivos",
  providerName: "Inversiones y Asesorías V&R Ltda.",
  providerShort: "V&R Ltda.",
  tagline: "Revisión de informes técnicos en línea",
  favicon: "📘",
  // accent: "#1e4d88", // descomentar para forzar acento de marca (valida AA)
  logos: {
    // Deja aquí las rutas cuando cargues los assets en /public/brand:
    // lockup: "/brand/vr-lockup.svg",
    // lockupDark: "/brand/vr-lockup-dark.svg",
    // vertical: "/brand/vr-vertical.svg",
    // isotype: "/brand/vr-isotipo.svg",
    // mono: "/brand/vr-mono.svg",
  },
  client: {
    name: "Ministerio de Transportes y Telecomunicaciones · SECTRA",
    // logo: "/brand/sectra.svg",
  },
  legal: [
    "Herramienta provista por Inversiones y Asesorías V&R Ltda.",
    "Documento para revisión ministerial. Uso restringido a las partes autorizadas.",
  ],
};

/** Contexto de uso de un logo, para elegir la mejor variante disponible. */
export type LogoSlot = "header" | "cover" | "isotype" | "footer";

/**
 * Elige la mejor variante de logo para un slot y tema, con degradación:
 * si no hay asset, devuelve null y el componente usa el fallback tipográfico.
 */
export function pickLogo(
  slot: LogoSlot,
  theme: "light" | "dark" | "sepia" = "light"
): string | null {
  const l = brand.logos;
  const dark = theme === "dark";
  switch (slot) {
    case "header":
      return (dark && l.lockupDark) || l.lockup || l.isotype || null;
    case "cover":
      return l.vertical || l.lockup || l.isotype || null;
    case "isotype":
      return l.isotype || l.lockup || null;
    case "footer":
      return l.mono || l.isotype || l.lockup || null;
    default:
      return null;
  }
}
