import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "@/lib/db";
import { currentUser, getReportAccess } from "@/lib/rbac";
import {
  audioConfig,
  isElevenLabsConfigured,
  synthesizeSpeech,
} from "@/lib/elevenlabs";
import { chapterNarrationText } from "@/lib/chapter-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// En serverless (Vercel) el cwd es de solo lectura; el temporal sí es escribible.
const CACHE_DIR = join(tmpdir(), "informes-audio-cache");

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
  const text = chapterNarrationText(chapter.title, blocks);

  const { voiceId, model } = audioConfig;
  const textHash = createHash("sha256")
    .update(`${voiceId}|${model}|${text}`)
    .digest("hex");

  // 1) ¿Está en caché?
  const cached = await prisma.audioAsset.findUnique({ where: { textHash } });
  if (cached && existsSync(cached.path)) {
    const buf = await readFile(cached.path);
    return audioResponse(buf, true);
  }

  // 2) Sin ElevenLabs configurado → el cliente usa la voz del navegador.
  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { fallback: "browser", reason: "ELEVENLABS_NO_CONFIGURADO" },
      { status: 200 }
    );
  }

  // 3) Generar con ElevenLabs.
  let audio: Buffer;
  try {
    audio = await synthesizeSpeech(text, { voiceId, model });
  } catch (e) {
    // Falla la API → respaldo del navegador en vez de romper la lectura.
    return NextResponse.json(
      { fallback: "browser", reason: String(e).slice(0, 200) },
      { status: 200 }
    );
  }

  // 4) Cachear es best-effort: en serverless el disco es efímero/limitado, pero
  //    si falla igual servimos el audio ya generado.
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const filePath = join(CACHE_DIR, `${textHash}.mp3`);
    await writeFile(filePath, audio);
    await prisma.audioAsset.upsert({
      where: { textHash },
      create: {
        reportId: chapter.report.id,
        chapterId: chapter.id,
        textHash,
        voiceId,
        model,
        path: filePath,
        bytes: audio.length,
      },
      update: { path: filePath, bytes: audio.length },
    });
  } catch {
    /* sin caché persistente, pero el audio se entrega igual */
  }

  return audioResponse(audio, false);
}

function audioResponse(buf: Buffer, cacheHit: boolean) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
      "X-Audio-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}
