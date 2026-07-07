export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ROLE_DEFINITIONS } from "@/lib/rbac";

/** Role catalog with human-readable permissions (for access management UI). */
export async function GET() {
  return NextResponse.json(ROLE_DEFINITIONS, { status: 200 });
}
