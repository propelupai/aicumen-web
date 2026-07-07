import fs from "fs";
import os from "os";
import path from "path";

/**
 * Wires Application Default Credentials for @google-cloud/* clients (used by the
 * Cloud SQL connector).
 *
 * Precedence (first match wins):
 * 1. `GOOGLE_APPLICATION_CREDENTIALS` already set -> left unchanged.
 * 2. Otherwise decode `GOOGLE_SA_KEY_BASE64` into a temp JSON file and point
 *    `GOOGLE_APPLICATION_CREDENTIALS` at it.
 */
export function initGoogleCreds() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_SA_KEY_BASE64");

  const jsonPath = path.join(os.tmpdir(), "gcp-sa-key.json");
  fs.writeFileSync(jsonPath, Buffer.from(b64, "base64").toString("utf-8"), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = jsonPath;
}
