/**
 * Cross-site write guard.
 *
 * `SameSite=None` is what makes sign-in work inside an embedded preview, but it
 * also means the browser will *send* our session cookie on a form post from
 * another site. This check is the replacement protection: a write is only
 * accepted when its `Origin` names the host we are actually serving.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { crossSiteWrite } from "../middleware";

function request(method: string, origin: string | null, host = "localhost:3200") {
  const headers: Record<string, string> = { host };
  if (origin) headers.origin = origin;
  return new NextRequest(`http://${host}/api/auth/login`, { method, headers });
}

describe("crossSiteWrite", () => {
  it("allows a read from anywhere", () => {
    expect(crossSiteWrite(request("GET", "https://evil.example"))).toBe(false);
  });

  it("allows a same-origin write", () => {
    expect(crossSiteWrite(request("POST", "http://localhost:3200"))).toBe(false);
  });

  it("refuses a write from another site", () => {
    expect(crossSiteWrite(request("POST", "https://evil.example"))).toBe(true);
    expect(crossSiteWrite(request("DELETE", "https://evil.example"))).toBe(true);
  });

  it("matches the forwarded host a proxy reports", () => {
    const proxied = new NextRequest("http://internal:3200/api/auth/login", {
      method: "POST",
      headers: { host: "internal:3200", "x-forwarded-host": "3200-abc.e2b.app", origin: "https://3200-abc.e2b.app" },
    });
    expect(crossSiteWrite(proxied)).toBe(false);
  });

  it("believes the browser's own Sec-Fetch-Site verdict", () => {
    // What a preview does: the proxy may rewrite Host, so comparing hosts is
    // unreliable — but the browser knows the request came from its own page.
    const fromOwnPage = new NextRequest("http://internal:3200/api/auth/login", {
      method: "POST",
      headers: { host: "internal:3200", origin: "https://3200-abc.e2b.app", "sec-fetch-site": "same-origin" },
    });
    expect(crossSiteWrite(fromOwnPage)).toBe(false);

    const fromElsewhere = new NextRequest("http://internal:3200/api/auth/login", {
      method: "POST",
      headers: { host: "internal:3200", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(crossSiteWrite(fromElsewhere)).toBe(true);
  });

  it("allows requests with no Origin (curl, server-to-server) but never trusts a broken one", () => {
    expect(crossSiteWrite(request("POST", null))).toBe(false);
    expect(crossSiteWrite(request("POST", "not a url"))).toBe(true);
  });
});
