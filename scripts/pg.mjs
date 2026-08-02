// Postgres local embebido para desarrollo (sin Docker, sin admin).
// El clúster se inicializa con el encoding nativo del sistema (initdb en UTF-8
// falla en Windows con rutas/locales no-ASCII), pero la base "informes" se crea
// en UTF-8 desde template0 — así admite caracteres como "→" del informe.
// Mantiene el proceso vivo hasta Ctrl-C. Mismo DATABASE_URL que docker-compose.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// El clúster vive FUERA del proyecto, en una ruta ASCII estable.
const dataDir = process.env.PGDATA_DIR || join(homedir(), ".informes-pgdata");
const alreadyInit = existsSync(join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

async function ensureUtf8Database() {
  const client = pg.getPgClient("postgres");
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'informes'"
    );
    if (rows.length === 0) {
      await client.query(
        "CREATE DATABASE informes WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'"
      );
      console.log("[pg] Base 'informes' creada en UTF-8.");
    } else {
      console.log("[pg] Base 'informes' ya existía.");
    }
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`[pg] Data dir: ${dataDir}`);
  if (!alreadyInit) {
    console.log("[pg] Inicializando clúster (primera vez)…");
    await pg.initialise();
  }
  console.log("[pg] Iniciando PostgreSQL en localhost:5432…");
  await pg.start();
  await ensureUtf8Database();

  console.log("[pg] LISTO. Postgres corriendo. Deja esta ventana abierta.");

  const shutdown = async () => {
    console.log("\n[pg] Deteniendo PostgreSQL…");
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error("[pg] Error:", e);
  process.exit(1);
});
