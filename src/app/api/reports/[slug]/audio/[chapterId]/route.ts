import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { currentUser, getReportAccess } from "@/lib/rbac";
import {
  audioConfig,
  isElevenLabsConfigured,
  synthesizeAlternating,
  createPronunciationDictionary,
  VOICE_SCHEME,
  type DictLocator,
} from "@/lib/elevenlabs";
import { chapterNarrationSegments } from "@/lib/chapter-text";
import { buildPronRules, pronRulesHash } from "@/lib/pronunciation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // segmentos en paralelo; margen para capítulos largos

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; chapterId: string }> }
) {
  const { slug, chapterId } = await params;

  const user = await currentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, report: { slug } },
    include: {
      report: { select: { id: true } },
      sections: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!chapter) return new NextResponse("No encontrado", { status: 404 });

  const access = await getReportAccess(chapter.report.id, user.id);
  if (!access.canView) return new NextResponse("Sin permiso", { status: 403 });

  const blocks = chapter.sections.flatMap((s) => s.blocks);
  const segments = chapterNarrationSegments(chapter.title, blocks);
  const text = segments.join(" ");
  const { model } = audioConfig;

  // Diccionario de pronunciación (derivado del glosario del informe).
  const report = await prisma.report.findUnique({
    where: { id: chapter.report.id },
    select: {
      id: true,
      pronunciationDictId: true,
      pronunciationDictVersion: true,
      pronunciationHash: true,
      glossary: { select: { term: true, pronunciation: true } },
    },
  });

  let dictLocators: DictLocator[] | undefined;
  let dictVersion = report?.pronunciationDictVersion ?? "";
  if (report && isElevenLabsConfigured()) {
    const rules = buildPronRules(report.glossary);
    if (rules.length > 0) {
      const hash = pronRulesHash(rules);
      let dictId = report.pronunciationDictId;
      if (!dictId || report.pronunciationHash !== hash) {
        try {
          const created = await createPronunciationDictionary(`informe-${slug}`, rules);
          dictId = created.id;
          dictVersion = created.versionId;
          await prisma.report.update({
            where: { id: report.id },
            data: {
              pronunciationDictId: created.id,
              pronunciationDictVersion: created.versionId,
              pronunciationHash: hash,
            },
          });
        } catch {
          /* si falla el diccionario, narramos sin él */
        }
      }
      if (dictId && dictVersion) {
        dictLocators = [{ pronunciation_dictionary_id: dictId, version_id: dictVersion }];
      }
    }
  }

  // Clave de caché: esquema de voces + modelo + versión del diccionario + texto.
  const textHash = createHash("sha256")
    .update(`${VOICE_SCHEME}|${model}|${dictVersion}|${text}`)
    .digest("hex");

  // 1) ¿Está en la base? (durable: no se vuelve a llamar a ElevenLabs)
  const cached = await prisma.audioAsset.findUnique({ where: { textHash } });
  if (cached?.data) {
    return audioResponse(Buffer.from(cached.data), true);
  }

  // 2) Sin ElevenLabs configurado → el cliente usa la voz del navegador.
  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { fallback: "browser", reason: "ELEVENLABS_NO_CONFIGURADO" },
      { status: 200 }
    );
  }

  // 3) Generar con voces alternadas (mujer/hombre) + diccionario de pronunciación.
  let audio: Buffer;
  try {
    audio = await synthesizeAlternating(segments, { model, dictLocators });
  } catch (e) {
    return NextResponse.json(
      { fallback: "browser", reason: String(e).slice(0, 200) },
      { status: 200 }
    );
  }

  // 4) Guardar en la base (best-effort) para no regenerar nunca más.
  const bytes = new Uint8Array(audio);
  try {
    await prisma.audioAsset.upsert({
      where: { textHash },
      create: {
        reportId: chapter.report.id,
        chapterId: chapter.id,
        textHash,
        voiceId: VOICE_SCHEME,
        model,
        data: bytes,
        bytes: bytes.length,
      },
      update: { data: bytes, bytes: bytes.length },
    });
  } catch {
    /* si falla el guardado, igual servimos el audio */
  }

  return audioResponse(audio, false);
}

function audioResponse(buf: Buffer, cacheHit: boolean) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=86400",
      "X-Audio-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}
