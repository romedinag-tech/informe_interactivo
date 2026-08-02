import { createHash } from "node:crypto";

export type PronRule = { string_to_replace: string; alias: string };

// Construye las reglas de alias a partir de los términos del glosario que
// tienen una pronunciación definida. Orden estable → hash reproducible.
export function buildPronRules(
  terms: { term: string; pronunciation: string | null }[]
): PronRule[] {
  return terms
    .filter((t) => t.pronunciation && t.pronunciation.trim())
    .map((t) => ({
      string_to_replace: t.term,
      alias: t.pronunciation!.trim(),
    }))
    .sort((a, b) => a.string_to_replace.localeCompare(b.string_to_replace));
}

export function pronRulesHash(rules: PronRule[]): string {
  return createHash("sha256").update(JSON.stringify(rules)).digest("hex");
}
