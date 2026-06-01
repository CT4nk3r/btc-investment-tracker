import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkEnv, hasDatabaseEnv } from "@/lib/env";
import { insertLedgerRow, listLedgerRows } from "@/lib/ledger-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const gate = await requirePublicRuntime();
    if (gate) return gate;

    const { userId } = await auth();
    const rows = await listLedgerRows(userId);
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not load ledger" },
      { status: error.status || 500 },
    );
  }
}

export async function POST(request) {
  try {
    const gate = await requirePublicRuntime();
    if (gate) return gate;

    const { userId } = await auth();
    const input = await request.json();
    const row = await insertLedgerRow(userId, input);
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not save ledger row" },
      { status: error.status || 500 },
    );
  }
}

async function requirePublicRuntime() {
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

  return null;
}
