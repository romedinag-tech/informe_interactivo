import type { PrismaClient } from "@prisma/client";

export type SnapshotBlock = {
  blockId: string;
  chapterNumber: string | null;
  chapterTitle: string;
  sectionTitle: string | null;
  type: string;
  text: string;
};

// Construye el snapshot del contenido en orden de documento.
export async function buildSnapshot(
  db: PrismaClient,
  reportId: string
): Promise<SnapshotBlock[]> {
  const chapters = await db.chapter.findMany({
    where: { reportId },
    orderBy: { order: "asc" },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { blocks: { orderBy: { order: "asc" } } },
      },
    },
  });
  const out: SnapshotBlock[] = [];
  for (const ch of chapters) {
    for (const s of ch.sections) {
      for (const b of s.blocks) {
        const c = b.content as { text?: string; caption?: string } | null;
        out.push({
          blockId: b.id,
          chapterNumber: ch.number,
          chapterTitle: ch.title,
          sectionTitle: s.title,
          type: b.type,
          text: typeof c?.text === "string" ? c.text : (c?.caption ?? ""),
        });
      }
    }
  }
  return out;
}

export type Diff = {
  added: SnapshotBlock[];
  removed: SnapshotBlock[];
  modified: { block: SnapshotBlock; before: string; after: string }[];
};

// Diff bloque-a-bloque entre dos snapshots (identidad = blockId).
export function diffSnapshots(prev: SnapshotBlock[], next: SnapshotBlock[]): Diff {
  const prevMap = new Map(prev.map((b) => [b.blockId, b]));
  const nextMap = new Map(next.map((b) => [b.blockId, b]));
  const added = next.filter((b) => !prevMap.has(b.blockId));
  const removed = prev.filter((b) => !nextMap.has(b.blockId));
  const modified: Diff["modified"] = [];
  for (const b of next) {
    const old = prevMap.get(b.blockId);
    if (old && old.text.trim() !== b.text.trim()) {
      modified.push({ block: b, before: old.text, after: b.text });
    }
  }
  return { added, removed, modified };
}

// Diff de palabras (LCS) para resaltar cambios dentro de un bloque modificado.
export function wordDiff(before: string, after: string): { text: string; op: "same" | "add" | "del" }[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: { text: string; op: "same" | "add" | "del" }[] = [];
  let i = 0;
  let j = 0;
  const push = (text: string, op: "same" | "add" | "del") => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(a[i], "del");
      i++;
    } else {
      push(b[j], "add");
      j++;
    }
  }
  while (i < n) push(a[i++], "del");
  while (j < m) push(b[j++], "add");
  return out;
}
