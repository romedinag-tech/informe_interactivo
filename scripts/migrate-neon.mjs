// Migra el esquema + datos (seed + informe de Talca) a la Postgres de la nube (Neon).
// La URL de Neon se lee de `.env.production.local` (ignorado por git), NO del chat.
//
// Uso:
//   1) Crea `.env.production.local` con:  DATABASE_URL="postgresql://...neon..."
//   2) node scripts/migrate-neon.mjs
//
// Node no sobreescribe variables ya definidas al cargar .env, así que al fijar
// DATABASE_URL=Neon aquí, prisma/seed/import lo usan aunque también carguen .env.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".env.production.local")) {
  console.error("Falta .env.production.local con la DATABASE_URL de Neon.");
  process.exit(1);
}
process.loadEnvFile(".env.production.local");

const url = process.env.DATABASE_URL || "";
if (!/neon|postgres/i.test(url)) {
  console.error("DATABASE_URL no parece válida en .env.production.local.");
  process.exit(1);
}
// Muestra solo el host, nunca la contraseña.
const host = url.replace(/:\/\/[^@]*@/, "://***@").split("?")[0];
console.log(`→ Migrando a: ${host}`);

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

console.log("\n[1/3] Esquema (prisma db push)…");
run("npx prisma db push --skip-generate");

console.log("\n[2/3] Datos de demo (seed)…");
run("npx tsx prisma/seed.ts");

console.log("\n[3/3] Informe de Talca…");
run("npx tsx scripts/import-talca.ts");

console.log("\n✅ Base de Neon lista (usuarios demo + informe de Talca).");
