import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkEnv, hasDatabaseEnv } from "@/lib/env";
import { deleteLedgerRow, updateLedgerRow } from "@/lib/ledger-server";

export const runtime = "nodejs";

export async function PUT(request, { params }) {
  try {
    const runtime = await requireLedgerRuntime();
    if (runtime.response) return runtime.response;

    const { id } = await params;
    const input = await request.json();
    const row = await updateLedgerRow(runtime.userId, id, input);
    return NextResponse.json({ row });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not update row" },
      { status: error.status || 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const runtime = await requireLedgerRuntime();
    if (runtime.response) return runtime.response;

    const { id } = await params;
    await deleteLedgerRow(runtime.userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete row" },
      { status: error.status || 500 },
    );
  }
}

async function requireLedgerRuntime() {
  if (!hasClerkEnv() || !hasDatabaseEnv()) {
    return {
      response: NextResponse.json(
        { error: "Public release is not configured yet. Add Clerk and Neon environment variables." },
        { status: 503 },
      ),
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { userId };
}
