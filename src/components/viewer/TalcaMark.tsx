// Emblema de Talca: cordillera de los Andes del Maule + río, monolínea sobria.
// Usa currentColor, así toma el acento del tema.
export function TalcaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Talca"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="24"
        cy="24"
        r="22"
        fill="var(--accent-soft)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Sol sobre la cordillera */}
      <circle cx="32.5" cy="17" r="2.4" fill="currentColor" opacity="0.85" />
      {/* Cordillera */}
      <path
        d="M9 30 L16.5 19.5 L21.5 26 L27 15.5 L33 24 L39 30 Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M9 30 L16.5 19.5 L21.5 26 L27 15.5 L33 24 L39 30"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Río del Maule */}
      <path
        d="M11 35 C 18 32, 20 37, 26 34 S 36 31, 38 35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
