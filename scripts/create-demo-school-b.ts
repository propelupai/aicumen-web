/**
 * Create a second demo school and add Arjun Badami as a member (for overlay A/B testing).
 * Does not change platform_admin status or delete anything.
 *
 * Usage: npx tsx scripts/create-demo-school-b.ts
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

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
    console.warn("No .env.local found");
  }
}

async function main() {
  loadEnvLocal();
  const { getPool } = await import("../src/lib/db");
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const users = await client.query(
      `SELECT user_id, email, display_name, platform_role, school_id
         FROM users
        WHERE LOWER(display_name) LIKE '%arjun%badami%'
           OR LOWER(email) LIKE '%arjun%'
           OR LOWER(display_name) LIKE '%badami%'
        ORDER BY created_at
        LIMIT 20`,
    );
    console.log("Matching users:");
    console.table(users.rows);

    const me =
      users.rows.find((u) => /badami/i.test(String(u.display_name ?? ""))) ??
      users.rows.find((u) => /arjun/i.test(String(u.display_name ?? ""))) ??
      users.rows[0];

    if (!me) {
      throw new Error("Could not find Arjun Badami in users table");
    }
    console.log("Using user:", me);

    const existingSchools = await client.query(
      `SELECT id, name, signup_code FROM schools WHERE is_active = TRUE ORDER BY id`,
    );
    console.log("Existing schools:");
    console.table(existingSchools.rows);

    const schoolName = "Demo School B";
    let school = (
      await client.query(`SELECT id, name, signup_code FROM schools WHERE name = $1`, [schoolName])
    ).rows[0];

    if (!school) {
      const signupCode = `DEMO-B-${randomBytes(3).toString("hex").toUpperCase()}`;
      const inserted = await client.query(
        `INSERT INTO schools (name, signup_code, is_active)
         VALUES ($1, $2, TRUE)
         RETURNING id, name, signup_code`,
        [schoolName, signupCode],
      );
      school = inserted.rows[0];
      console.log("Created school:", school);
    } else {
      console.log("School already exists:", school);
    }

    await client.query(
      `INSERT INTO user_schools (user_id, school_id, role_key)
       VALUES ($1, $2, 'school_admin')
       ON CONFLICT (user_id, school_id) DO UPDATE
         SET role_key = EXCLUDED.role_key`,
      [me.user_id, school.id],
    );

    await client.query(
      `INSERT INTO school_preferences (school_id)
       VALUES ($1)
       ON CONFLICT (school_id) DO NOTHING`,
      [school.id],
    );

    // Keep current active school unchanged; membership enables the header switcher.
    const memberships = await client.query(
      `SELECT s.id, s.name, us.role_key, (s.id = $2) AS is_active_now
         FROM user_schools us
         JOIN schools s ON s.id = us.school_id
        WHERE us.user_id = $1
        ORDER BY s.name`,
      [me.user_id, me.school_id],
    );

    await client.query("COMMIT");

    console.log("\nDone.");
    console.log(`School: ${school.name} (id=${school.id}, code=${school.signup_code})`);
    console.log(`Member: ${me.display_name} <${me.email}> as school_admin`);
    console.log("Your school memberships:");
    console.table(memberships.rows);
    console.log(
      "\nIn the app header, switch to Demo School B, then open Customize and toggle — overlays are per-school.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
