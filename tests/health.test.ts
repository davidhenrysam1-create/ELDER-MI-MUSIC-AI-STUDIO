/**
 * Liveness probe (`GET /api/health`) and the middleware rule that keeps it
 * reachable.
 *
 * Why this is worth testing: hosting platforms (Render, Cloud Run, Docker's
 * HEALTHCHECK, uptime monitors) probe with **no cookie and no password**. If
 * the probe were gated like every other API, a healthy deployment would answer
 * `401`, the platform would call it dead, and it would restart-loop or send no
 * traffic. That is a deploy-time failure nobody sees in a browser, so it is
 * pinned here instead.
 *
 * The suite runs with `STUDIO_ACCOUNTS=on` (see vitest.config.ts), which is the
 * strictest case: a signed-out visitor reaching an API route normally gets 401.
 */
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, HEAD } from "../app/api/health/route";
import { middleware } from "../middleware";

/** Call the route handler directly — no server needed. */
describe("GET /api/health", () => {
  it("answers 200 with no session and no database access", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("is never cached, so a stale 'ok' cannot hide a dead instance", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("leaks nothing sensitive", async () => {
    const body = await (await GET()).json();
    const keys = Object.keys(body).sort();
    // A closed whitelist: if someone later adds a field, this test asks why.
    expect(keys).toEqual(["environment", "ok", "timestamp", "uptimeSeconds", "version"]);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/key|secret|token|password|supabase/i);
  });

  it("supports HEAD, which some platforms probe first", async () => {
    const response = await HEAD();
    expect(response.status).toBe(200);
  });
});

describe("middleware lets the probe through", () => {
  const saved = { STUDIO_PASSWORD: process.env.STUDIO_PASSWORD };

  afterEach(() => {
    if (saved.STUDIO_PASSWORD === undefined) delete process.env.STUDIO_PASSWORD;
    else process.env.STUDIO_PASSWORD = saved.STUDIO_PASSWORD;
  });

  it("does not redirect a signed-out probe to /login", () => {
    const response = middleware(new NextRequest("https://studio.example/api/health"));
    // NextResponse.next() carries no Location header; a redirect would.
    expect(response.headers.get("location")).toBeNull();
  });

  it("passes even when the whole studio sits behind a password", () => {
    process.env.STUDIO_PASSWORD = "let-me-in";
    const response = middleware(new NextRequest("https://studio.example/api/health"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("still gates everything else behind that password", () => {
    process.env.STUDIO_PASSWORD = "let-me-in";
    const response = middleware(new NextRequest("https://studio.example/settings"));
    expect(response.status).toBe(401);
  });
});
