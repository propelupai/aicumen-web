/**
 * Run SQL migrations in order. Usage: npx tsx scripts/migrate.ts [002] [003]
 * Loads .env.local from project root.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("No .env.local found — using existing process.env");
  }
}

async function main() {
  loadEnvLocal();

  const { getPool } = await import("../src/lib/db");

  const args = process.argv.slice(2);
  const migrationsDir = join(root, "migrations");
  const allFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const toRun =
    args.length > 0
      ? allFiles.filter((f) =>
          args.some((a) => f.startsWith(a.replace(/\.sql$/, "")) || f === a),
        )
      : allFiles;

  if (toRun.length === 0) {
    console.error("No migration files matched:", args);
    process.exit(1);
  }

  const pool = await getPool();

  for (const file of toRun) {
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, "utf8");
    console.log(`\n▶ Running ${file}...`);
    try {
      await pool.query(sql);
      console.log(`✓ ${file} OK`);
    } catch (err) {
      console.error(`✗ ${file} failed:`, err);
      process.exit(1);
    }
  }

  await pool.end();
  console.log("\nAll migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
