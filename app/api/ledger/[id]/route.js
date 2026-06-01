import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkEnv, hasDatabaseEnv } from "@/lib/env";
import { deleteLedgerRow } from "@/lib/ledger-server";

export const runtime = "nodejs";

export async function DELETE(_request, { params }) {
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

  const { id } = await params;
  await deleteLedgerRow(userId, id);
  return NextResponse.json({ ok: true });
}
