import { NextResponse } from "next/server";

export function isUnauthorizedError(err: unknown): boolean {
  const message = String((err as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("unauth") || message.includes("user not found");
}

export function isForbiddenError(err: unknown): boolean {
  return String((err as { message?: string })?.message ?? "").startsWith("Forbidden:");
}

export function apiErrorResponse(err: unknown, logLabel = "API error"): NextResponse {
  if (isUnauthorizedError(err)) {
    return NextResponse.json(
      { message: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }
  if (isForbiddenError(err)) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(logLabel + ":", message);
    return NextResponse.json(
      { message: "You do not have access to perform this action." },
      { status: 403 },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(logLabel + ":", message);
  return NextResponse.json({ message: "Internal server error" }, { status: 500 });
}
