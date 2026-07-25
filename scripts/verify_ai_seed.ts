import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }

  const { getPool } = await import("../src/lib/db");
  const pool = await getPool();

  const chapters = await pool.query(
    `SELECT s.slug, s.kind, c.chapter_code, c.title, COUNT(a.id)::int AS activities
       FROM subjects s
       JOIN chapters c ON c.subject_id = s.id
       LEFT JOIN activities a ON a.chapter_id = c.id AND a.status = 'published'
      WHERE s.slug = 'ai'
      GROUP BY s.slug, s.kind, c.chapter_code, c.title
      ORDER BY c.chapter_code`,
  );
  console.log("chapters:", chapters.rows);

  const roles = await pool.query(
    `SELECT q.role, COUNT(*)::int AS n
       FROM questions q
       JOIN activities a ON a.id = q.activity_id
       JOIN chapters c ON c.id = a.chapter_id
       JOIN subjects s ON s.id = c.subject_id
      WHERE s.slug = 'ai'
      GROUP BY q.role
      ORDER BY q.role`,
  );
  console.log("question roles:", roles.rows);

  const emojis = await pool.query(
    `SELECT a.metadata->>'quest_code' AS code,
            a.metadata->>'emoji' AS emoji,
            a.title
       FROM activities a
       JOIN chapters c ON c.id = a.chapter_id
       JOIN subjects s ON s.id = c.subject_id
      WHERE s.slug = 'ai'
      ORDER BY c.chapter_code, a.sort_order`,
  );
  console.log("activities:", emojis.rows.length);
  console.log(emojis.rows.map((r) => `${r.code} ${r.emoji} ${r.title}`).join("\n"));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
