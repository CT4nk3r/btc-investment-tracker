import { describe, expect, it } from "vitest";
import {
  formatUnits,
  isEvmAddress,
  normalizeWalletTransactions,
  WALLET_CHAINS,
} from "../lib/wallet-transactions.js";

const wallet = "0x1111111111111111111111111111111111111111";
const router = "0x2222222222222222222222222222222222222222";
const sender = "0x3333333333333333333333333333333333333333";
const chain = WALLET_CHAINS.ethereum;

describe("wallet transaction normalization", () => {
  it("validates EVM addresses", () => {
    expect(isEvmAddress(wallet)).toBe(true);
    expect(isEvmAddress("bc1q-not-an-evm-address")).toBe(false);
    expect(isEvmAddress("0x1234")).toBe(false);
  });

  it("formats integer token values without floating point precision loss", () => {
    expect(formatUnits("20000000", 6)).toBe("20");
    expect(formatUnits("100000000000000", 18)).toBe("0.0001");
    expect(formatUnits("123456789012345678901234", 18)).toBe("123456.789012345678901234");
  });

  it("decodes clear outgoing and incoming flows as a swap", () => {
    const transactions = normalizeWalletTransactions({
      address: wallet,
      chain,
      normalTransactions: [
        {
          hash: "0xswap",
          timestamp: "2026-06-01T12:00:00.000Z",
          from: wallet,
          to: router,
          value: "0",
          feeWei: "21000000000000",
          input: "0x1234",
          method: "swapExactTokensForTokens",
          status: "ok",
        },
      ],
      tokenTransfers: [
        {
          hash: "0xswap",
          timestamp: "2026-06-01T12:00:00.000Z",
          from: wallet,
          to: router,
          value: "20000000",
          decimals: 6,
          symbol: "USDC",
          contractAddress: "0xaaaa",
        },
        {
          hash: "0xswap",
          timestamp: "2026-06-01T12:00:00.000Z",
          from: router,
          to: wallet,
          value: "100000000000000",
          decimals: 18,
          symbol: "WBTC",
          contractAddress: "0xbbbb",
        },
      ],
    });

    expect(transactions[0]).toMatchObject({
      type: "swap",
      summary: "Swapped 20 USDC for 0.0001 WBTC",
      counterparty: router,
      fee: { amount: "0.000021", symbol: "ETH" },
      sentAssets: [{ amount: "20", symbol: "USDC", contractAddress: "0xaaaa" }],
      receivedAssets: [{ amount: "0.0001", symbol: "WBTC", contractAddress: "0xbbbb" }],
    });
  });

  it("aggregates repeated token transfers and describes received assets", () => {
    const transactions = normalizeWalletTransactions({
      address: wallet,
      chain,
      tokenTransfers: [
        {
          hash: "0xreceive",
          timestamp: "2026-06-02T12:00:00.000Z",
          from: sender,
          to: wallet,
          value: "1000000",
          decimals: 6,
          symbol: "USDC",
          contractAddress: "0xaaaa",
        },
        {
          hash: "0xreceive",
          timestamp: "2026-06-02T12:00:00.000Z",
          from: sender,
          to: wallet,
          value: "2500000",
          decimals: 6,
          symbol: "USDC",
          contractAddress: "0xaaaa",
        },
      ],
    });

    expect(transactions[0]).toMatchObject({
      type: "transfer",
      summary: "Received 3.5 USDC",
      counterparty: sender,
      fee: null,
      receivedAssets: [{ amount: "3.5", symbol: "USDC" }],
    });
  });

  it("keeps unknown contract calls visible without crashing", () => {
    const transactions = normalizeWalletTransactions({
      address: wallet,
      chain,
      normalTransactions: [
        {
          hash: "0xcall",
          timestamp: "2026-06-03T12:00:00.000Z",
          from: wallet,
          to: router,
          value: "0",
          input: "0xdeadbeef",
          status: "error",
        },
      ],
    });

    expect(transactions[0]).toMatchObject({
      type: "contract_interaction",
      summary: "Undecoded contract interaction",
      status: "failed",
    });
  });
});
