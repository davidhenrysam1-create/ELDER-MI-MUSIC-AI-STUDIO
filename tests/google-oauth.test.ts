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
import { redirectUri, requestOrigin } from "@/lib/server/google";

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

  it("honours NEXT_PUBLIC_SITE_URL and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://eldermi.example.com/";
    expect(redirectUri("https://preview.example")).toBe(
      "https://eldermi.example.com/api/auth/google/callback",
    );
  });

  it("lets GOOGLE_REDIRECT_URI override everything", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://eldermi.example.com";
    process.env.GOOGLE_REDIRECT_URI = "https://auth.example.com/cb";
    expect(redirectUri("https://preview.example")).toBe("https://auth.example.com/cb");
  });
});
