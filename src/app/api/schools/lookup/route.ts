export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Public lookup: resolve an active school signup code for the signup welcome UI.
 * Does not expose the signup code back; only identity / partner chrome fields.
 */
export async function GET(request: NextRequest) {
  let client;
  try {
    const code = String(request.nextUrl.searchParams.get("code") ?? "").trim();
    if (!code) {
      return NextResponse.json({ message: "signup code is required" }, { status: 400 });
    }

    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT id, name, partner_label, welcome_blurb
         FROM schools
        WHERE signup_code = $1 AND is_active = TRUE
        LIMIT 1`,
      [code],
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "Invalid signup code" }, { status: 404 });
    }

    const school = rows[0];
    return NextResponse.json(
      {
        id: school.id,
        name: school.name,
        partner_label: school.partner_label,
        welcome_blurb: school.welcome_blurb,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    return apiErrorResponse(err, "Error looking up school");
  } finally {
    if (client) client.release();
  }
}
