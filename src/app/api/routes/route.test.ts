import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("POST /api/routes", () => {
  it("returns 400 when a cancelled request has no JSON body", async () => {
    const request = new NextRequest("http://localhost/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid JSON body" });
  });
});
