import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { currentUser, getReportAccess } from "@/lib/rbac";
import {
  audioConfig,
  isElevenLabsConfigured,
  synthesizeWithTimestamps,
  type DictLocator,
} from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voz dedicada del resumen ejecutivo (español latinoamericano, sin acento de
// España). Configurable por env; por defecto la voz que el usuario eligió.
const INTRO_VOICE_ID = process.env.ELEVENLABS_INTRO_VOICE_ID || "ClNifCEVq1smkl4M3aTk";

// Narración del resumen ejecutivo (portada) con ElevenLabs: voz controlada (sin
// acento de España), CACHEADA en la base → se genera una sola vez y no re-gasta
// créditos. Devuelve el mp3 (base64) + tiempos por carácter para el resaltado.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const report = await prisma.report.findUnique({
    where: { slug },
    select: {
      id: true,
      execSummary: true,
      pronunciationDictId: true,
      pronunciationDictVersion: true,
      chapters: { orderBy: { order: "asc" }, take: 1, select: { id: true } },
    },
  });
  if (!report) return new NextResponse("No encontrado", { status: 404 });

  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) return new NextResponse("Sin permiso", { status: 403 });

  const summary = report.execSummary?.trim();
  if (!summary) return NextResponse.json({ fallback: "none" });

  const voiceId = INTRO_VOICE_ID;
  const { model } = audioConfig;
  const dictVersion = report.pronunciationDictVersion ?? "";
  const dictLocators: DictLocator[] | undefined =
    report.pronunciationDictId && report.pronunciationDictVersion
      ? [{ pronunciation_dictionary_id: report.pronunciationDictId, version_id: report.pronunciationDictVersion }]
      : undefined;

  const textHash = createHash("sha256")
    .update(`intro|${voiceId}|${model}|${dictVersion}|${summary}`)
    .digest("hex");

  // 1) ¿Cacheado? → servir sin llamar a ElevenLabs.
  const cached = await prisma.audioAsset.findUnique({ where: { textHash } });
  if (cached?.data) {
    return NextResponse.json({
      audioBase64: Buffer.from(cached.data).toString("base64"),
      charStartTimes: (cached.alignment as number[] | null) ?? [],
    });
  }

  // 2) Sin ElevenLabs → el cliente usa la voz del navegador (latinoamericana).
  if (!isElevenLabsConfigured()) return NextResponse.json({ fallback: "browser" });

  // 3) Generar una vez, cachear.
  let audio: Buffer;
  let charStartTimes: number[];
  try {
    ({ audio, charStartTimes } = await synthesizeWithTimestamps(summary, { voiceId, model, dictLocators }));
  } catch (e) {
    return NextResponse.json({ fallback: "browser", reason: String(e).slice(0, 200) });
  }

  const bytes = new Uint8Array(audio);
  try {
    await prisma.audioAsset.upsert({
      where: { textHash },
      create: {
        reportId: report.id,
        chapterId: report.chapters[0]?.id ?? report.id, // agrupador (Introducción)
        textHash,
        voiceId,
        model,
        data: bytes,
        bytes: bytes.length,
        alignment: charStartTimes,
      },
      update: { data: bytes, bytes: bytes.length, alignment: charStartTimes },
    });
  } catch {
    /* si falla el guardado, igual servimos */
  }

  return NextResponse.json({
    audioBase64: Buffer.from(audio).toString("base64"),
    charStartTimes,
  });
}
