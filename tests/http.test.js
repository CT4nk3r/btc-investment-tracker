import { describe, expect, it } from "vitest";
import { readJsonResponse } from "../lib/http.js";

describe("readJsonResponse", () => {
  it("returns parsed JSON for valid responses", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    await expect(readJsonResponse(response)).resolves.toEqual({ ok: true });
  });

  it("returns null for empty responses", async () => {
    const response = new Response("");

    await expect(readJsonResponse(response)).resolves.toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    const response = new Response("<html>not json</html>", {
      headers: { "Content-Type": "text/html" },
    });

    await expect(readJsonResponse(response)).resolves.toBeNull();
  });
});
