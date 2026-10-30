/**
 * The address Google is told to call back on.
 *
 * Getting this wrong is invisible until a real person has already picked a
 * Google account and lands on `redirect_uri_mismatch`, so it is pinned here:
 * behind a proxy the internal host (`http://0.0.0.0:3200`) must never leak into
 * the OAuth request, and the value used by `/start` must equal the one used by
 * `/callback`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { redirectHostMismatch, redirectUri, requestOrigin } from "@/lib/server/google";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.GOOGLE_REDIRECT_URI;
});

function incoming(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("requestOrigin", () => {
  it("falls back to the request URL when nothing is proxied", () => {
    expect(requestOrigin(incoming("http://localhost:3200/api/auth/google/start"))).toBe(
      "http://localhost:3200",
    );
  });

  it("prefers the forwarded host and protocol a preview proxy reports", () => {
    expect(
      requestOrigin(
        incoming("http://0.0.0.0:3200/api/auth/google/start", {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "3200-abc123.e2b.app",
        }),
      ),
    ).toBe("https://3200-abc123.e2b.app");
  });

  it("reads the first hop of a forwarded chain", () => {
    expect(
      requestOrigin(
        incoming("http://internal:3200/x", {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "studio.example.com, internal",
        }),
      ),
    ).toBe("https://studio.example.com");
  });
});

describe("redirectUri", () => {
  it("is built from the address the person is actually using", () => {
    expect(redirectUri("https://3200-abc123.e2b.app")).toBe(
      "https://3200-abc123.e2b.app/api/auth/google/callback",
    );
  });

  it("honours NEXT_PUBLIC_SITE_URL when the browser is on that same address", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://eldermi.example.com/";
    expect(redirectUri("https://eldermi.example.com")).toBe(
      "https://eldermi.example.com/api/auth/google/callback",
    );
  });

  /*
   * The bug this pins: NEXT_PUBLIC_SITE_URL was trusted even when the visitor was
   * somewhere else, so a preview (or a tunnel) handed Google a LOCALHOST callback
   * and Google answered with its bare "403. That's an error." page. The callback
   * must belong to the host the browser is really on.
   */
  it("never hands Google a different host's callback than the one in use", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3200";
    expect(redirectUri("https://3200-abc123.e2b.app")).toBe(
      "https://3200-abc123.e2b.app/api/auth/google/callback",
    );
  });

  /*
   * localhost vs 127.0.0.1 are the same machine but NOT the same cookie jar, and
   * the OAuth `state` lives in a cookie. Coming back on `localhost` after starting
   * on `127.0.0.1` would lose it and fail with "attempt expired", so the callback
   * follows the exact host that started the flow. The mismatch check below still
   * treats them as one machine, so this is not reported as a misconfiguration.
   */
  it("keeps 127.0.0.1 and localhost in their own cookie jars", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3200";
    expect(redirectUri("http://127.0.0.1:3200")).toBe(
      "http://127.0.0.1:3200/api/auth/google/callback",
    );
  });

  it("lets GOOGLE_REDIRECT_URI override everything", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://eldermi.example.com";
    process.env.GOOGLE_REDIRECT_URI = "https://auth.example.com/cb";
    expect(redirectUri("https://preview.example")).toBe("https://auth.example.com/cb");
  });
});

/**
 * The pre-flight check that replaces Google's opaque 403 with a readable reason.
 *
 * Google's own page — "403. That's an error. We're sorry, but you do not have
 * access to this document." — is what a visitor saw when the configured address
 * was `localhost` but the browser was on a preview host. A preview URL changes
 * every session, so it can never be registered with Google; saying so plainly is
 * the only honest option.
 */
describe("redirectHostMismatch", () => {
  it("is quiet when nothing is configured: the browser's own address is used", () => {
    expect(redirectHostMismatch("https://3200-abc123.e2b.app")).toBeNull();
  });

  it("is quiet on the configured address", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elder-mi-studio.onrender.com";
    expect(redirectHostMismatch("https://elder-mi-studio.onrender.com")).toBeNull();
  });

  it("reports both hosts when the browser is somewhere else", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3200";
    expect(redirectHostMismatch("https://3200-abc123.e2b.app")).toEqual({
      configuredHost: "localhost:3200",
      currentHost: "3200-abc123.e2b.app",
    });
  });

  it("ignores the localhost / 127.0.0.1 difference", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3200";
    expect(redirectHostMismatch("http://127.0.0.1:3200")).toBeNull();
  });

  it("lets GOOGLE_REDIRECT_URI be authoritative", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://auth.example.com/cb";
    expect(redirectHostMismatch("https://auth.example.com")).toBeNull();
    expect(redirectHostMismatch("https://preview.example")?.configuredHost).toBe(
      "auth.example.com",
    );
  });
});
