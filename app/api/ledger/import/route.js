import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkEnv, hasDatabaseEnv } from "@/lib/env";
import { importLedgerRows } from "@/lib/ledger-server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!hasClerkEnv() || !hasDatabaseEnv()) {
      return NextResponse.json(
        { error: "Public release is not configured yet. Add Clerk and Neon environment variables." },
        { status: 503 },
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode === "replace" ? "replace" : "merge";
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const importedRows = await importLedgerRows(userId, rows, mode);
    return NextResponse.json({ rows: importedRows });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not import ledger rows" },
      { status: error.status || 500 },
    );
  }
}
