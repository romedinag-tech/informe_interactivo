// Prepara los assets de marca para /public/brand:
//  - hace transparente el fondo blanco (relleno desde bordes, preserva íconos)
//  - recorta el margen y exporta PNG optimizado
//  - genera el favicon desde el isotipo
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/brand";
mkdirSync(OUT, { recursive: true });

// Relleno desde los bordes: vuelve transparentes los píxeles casi-blancos
// CONECTADOS al borde. Los blancos interiores (auto, peatón) quedan intactos.
async function whiteToTransparentFromEdges(src, threshold = 238) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const isBg = (i) => data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const pushIf = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (!isBg(p * 4)) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0; // alpha 0
    const x = p % w, y = (p - x) / w;
    pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .trim({ threshold: 1 }); // recorta el borde transparente
}

async function main() {
  // Isotipo (versátil: header, hero, favicon).
  const iso = await whiteToTransparentFromEdges("Insumos/solo simbolo.png");
  await iso.clone().resize({ width: 512, withoutEnlargement: true }).toFile(`${OUT}/isotipo.png`);
  console.log("✓ isotipo.png");

  // Favicon (isotipo con margen, cuadrado).
  await iso
    .clone()
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(`${OUT}/icon.png`);
  console.log("✓ icon.png");

  // Lockup horizontal (footer, login).
  const lock = await whiteToTransparentFromEdges("Insumos/logo horizontal.png");
  await lock.clone().resize({ width: 640, withoutEnlargement: true }).toFile(`${OUT}/lockup.png`);
  console.log("✓ lockup.png");

  for (const f of ["isotipo.png", "icon.png", "lockup.png"]) {
    const m = await sharp(`${OUT}/${f}`).metadata();
    console.log(`  ${f}: ${m.width}x${m.height} alpha:${m.hasAlpha} ${(readFileSync(`${OUT}/${f}`).length / 1024).toFixed(0)}KB`);
  }
}
main();
