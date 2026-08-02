import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, getReportAccess } from "@/lib/rbac";

export const runtime = "nodejs";

// Geodata de un mapa (se carga cuando el mapa se monta en el cliente).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; key: string }> }
) {
  const { slug, key } = await params;

  const user = await currentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const report = await prisma.report.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!report) return new NextResponse("No encontrado", { status: 404 });

  const access = await getReportAccess(report.id, user.id);
  if (!access.canView) return new NextResponse("Sin permiso", { status: 403 });

  const asset = await prisma.mapAsset.findUnique({
    where: { reportId_key: { reportId: report.id, key } },
    select: { title: true, data: true },
  });
  if (!asset) return new NextResponse("Mapa no encontrado", { status: 404 });

  return NextResponse.json(asset, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
