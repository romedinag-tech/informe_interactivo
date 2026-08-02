import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, getReportAccess } from "@/lib/rbac";

export const runtime = "nodejs";

// Sirve la imagen de una figura (bytes en FigureAsset) tras validar acceso.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; blockId: string }> }
) {
  const { slug, blockId } = await params;

  const user = await currentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!report) return new NextResponse("No encontrado", { status: 404 });

  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) return new NextResponse("Sin permiso", { status: 403 });

  const asset = await prisma.figureAsset.findUnique({
    where: { blockId },
    select: { reportId: true, contentType: true, data: true },
  });
  if (!asset || asset.reportId !== report.id) {
    return new NextResponse("Figura no encontrada", { status: 404 });
  }

  const body = new Uint8Array(asset.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": asset.contentType || "image/png",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
