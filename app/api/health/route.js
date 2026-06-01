import { NextResponse } from "next/server";
import { hasClerkEnv, hasDatabaseEnv, missingPublicReleaseEnv } from "@/lib/env";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: hasClerkEnv() && hasDatabaseEnv(),
    authConfigured: hasClerkEnv(),
    databaseConfigured: hasDatabaseEnv(),
    missing: missingPublicReleaseEnv(),
  });
}
