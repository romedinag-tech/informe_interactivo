// Marca de agua diagonal "BORRADOR — no válido para distribución", visible
// hasta que el informe se apruebe. No interfiere (pointer-events:none) y queda
// detrás del contenido. Se refuerza al imprimir/exportar a PDF.
export function DraftWatermark({
  text = "BORRADOR · NO VÁLIDO PARA DISTRIBUCIÓN",
}: {
  text?: string;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><text x="50%" y="50%" fill="#8a5510" fill-opacity="0.09" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1" text-anchor="middle" transform="rotate(-27 320 180)">${text}</text></svg>`;
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return (
    <div
      aria-hidden
      className="draft-watermark pointer-events-none fixed inset-0 z-[1] select-none"
      style={{ backgroundImage: uri, backgroundRepeat: "repeat" }}
    />
  );
}
