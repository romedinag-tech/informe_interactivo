// Opciones comunes de los CLI del modo revisión (servidor local y export offline).
// Los textos del encabezado y el archivo de títulos numerados se toman de parámetros,
// nunca fijos en el código:
//   --estudio "<nombre del estudio>"  --titulo "<Informe de Avance N° 1>"  --titulos <csv>
// Si no vienen como bandera se buscan en `encabezado.json` ({ "estudio", "titulo" }) en la
// carpeta de la ronda o en la de revisión (`_revision\`), y el CSV de títulos junto al
// docx (`<stem>_titulos.csv`, el que deja mapa_titulos.py del estudio).
// Igual el de figuras agrupadas (`--grupos`, o `<stem>_grupos_figuras.csv` junto al docx) y
// las respuestas de la ronda (`--respuestas`, o `respuestas.json` en la carpeta de la ronda).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { leerTitulosCsv, type TituloNumerado } from "./numbering";
import { leerGruposCsv, type FilaGrupo } from "./grupos";
import type { Respuesta } from "./rounds";

export type OpcionesRevision = {
  posicionales: string[];
  estudio?: string;
  titulo?: string;
  titulos: TituloNumerado[] | null;
  titulosCsv: string | null;
  encabezadoJson: string | null;
  grupos: FilaGrupo[] | null;
  gruposCsv: string | null;
  respuestas: Respuesta[];
  respuestasJson: string | null;
};

export function leerOpciones(argv: string[], docxPath: string | undefined, carpetaRonda: (pos: string[]) => string | undefined): OpcionesRevision {
  const posicionales: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--") && i + 1 < argv.length) { flags[a.slice(2)] = argv[++i]; } else posicionales.push(a);
  }
  const ronda = carpetaRonda(posicionales);
  let enc: { estudio?: string; titulo?: string } = {};
  let encabezadoJson: string | null = null;
  for (const d of ronda ? [ronda, dirname(ronda)] : []) {
    const f = join(d, "encabezado.json");
    if (existsSync(f)) { enc = JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")); encabezadoJson = f; break; }
  }
  const doc = docxPath ?? posicionales[0];
  const auto = doc ? doc.replace(/\.docx$/i, "_titulos.csv") : null;
  const titulosCsv = flags.titulos ?? (auto && existsSync(auto) ? auto : null);
  const autoG = doc ? doc.replace(/\.docx$/i, "_grupos_figuras.csv") : null;
  const gruposCsv = flags.grupos ?? (autoG && existsSync(autoG) ? autoG : null);
  const autoR = ronda ? join(ronda, "respuestas.json") : null;
  const respuestasJson = flags.respuestas ?? (autoR && existsSync(autoR) ? autoR : null);
  let respuestas: Respuesta[] = [];
  if (respuestasJson) try { const j = JSON.parse(readFileSync(respuestasJson, "utf8").replace(/^﻿/, "")); respuestas = Array.isArray(j) ? j : (j.respuestas ?? []); } catch { respuestas = []; }
  return {
    posicionales,
    estudio: flags.estudio ?? enc.estudio,
    titulo: flags.titulo ?? enc.titulo,
    titulos: titulosCsv ? leerTitulosCsv(readFileSync(titulosCsv, "utf8")) : null,
    titulosCsv,
    encabezadoJson,
    grupos: gruposCsv ? leerGruposCsv(readFileSync(gruposCsv, "utf8")) : null,
    gruposCsv,
    respuestas,
    respuestasJson,
  };
}
