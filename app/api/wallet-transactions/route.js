import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasClerkEnv } from "@/lib/env";
import { fetchWalletTransactions } from "@/lib/wallet-provider";
import { isEvmAddress, WALLET_CHAINS } from "@/lib/wallet-transactions";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    if (!hasClerkEnv()) {
      return NextResponse.json(
        { error: "Clerk is not configured yet. Add Clerk environment variables." },
        { status: 503 },
      );
    }

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim() || "";
    const chain = searchParams.get("chain") || "ethereum";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    validateInput({ address, chain, startDate, endDate });
    const result = await fetchWalletTransactions({ address, chainId: chain, startDate, endDate });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not load wallet transactions" },
      { status: error.status || 500 },
    );
  }
}

function validateInput({ address, chain, startDate, endDate }) {
  if (!isEvmAddress(address)) throw inputError("Enter a valid EVM wallet address.");
  if (!WALLET_CHAINS[chain]) throw inputError("Select a supported chain.");
  if (!isDate(startDate) || !isDate(endDate)) throw inputError("Choose a valid start and end date.");

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (start > end) throw inputError("Start date must be on or before end date.");

  const days = (end - start) / 86_400_000;
  if (days > 366) throw inputError("Choose a date range of 366 days or less.");
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function inputError(message) {
  return Object.assign(new Error(message), { status: 400 });
}
