/**
 * Session-cookie attributes.
 *
 * These tests exist because the failure they prevent is invisible from the
 * server side: with `SameSite=Lax` the sign-in POST still returns `200`, the
 * browser silently drops the cookie, and the user is bounced back to `/login`
 * with no error at all. Only the attributes tell the two worlds apart.
 */
import { describe, expect, it } from "vitest";
import { cookiePolicyFor } from "@/lib/server/cookies";

describe("cookie policy", () => {
  it("uses the strict first-party default on plain HTTP", () => {
    const policy = cookiePolicyFor({ proto: "http", origin: "http://localhost:3200" });
    expect(policy.sameSite).toBe("lax");
    // Never Secure over plain HTTP: a LAN address on an old phone must still be
    // able to sign in.
    expect(policy.secure).toBe(false);
    expect(policy.partitioned).toBe(false);
  });

  it("allows an embedded HTTPS preview to keep the cookie", () => {
    const policy = cookiePolicyFor({
      proto: "https",
      origin: "https://3200-abc123.e2b.app",
    });
    expect(policy).toEqual({ sameSite: "none", secure: true, partitioned: true });
  });

  it("trusts the Origin header when the proxy omits x-forwarded-proto", () => {
    // Some proxies only forward the Origin on a fetch; the POST still needs to
    // set a usable cookie or sign-in loops inside the frame.
    const policy = cookiePolicyFor({ origin: "https://studio.example.com" });
    expect(policy.sameSite).toBe("none");
    expect(policy.secure).toBe(true);
  });

  it("reads the first hop of a comma-separated proto chain", () => {
    expect(cookiePolicyFor({ proto: "https, http" }).sameSite).toBe("none");
    expect(cookiePolicyFor({ proto: "http, https" }).sameSite).toBe("lax");
  });

  it("is case-insensitive about the protocol and origin", () => {
    expect(cookiePolicyFor({ proto: " HTTPS " }).secure).toBe(true);
    expect(cookiePolicyFor({ origin: "HTTPS://Studio.Example.com" }).secure).toBe(true);
  });

  it("never asks for SameSite=None without Secure", () => {
    // A browser rejects that combination outright, which would break the very
    // sign-in the change was meant to fix.
    for (const policy of [
      cookiePolicyFor({ proto: "http" }),
      cookiePolicyFor({ proto: "https" }),
      cookiePolicyFor({ origin: "http://localhost" }),
      cookiePolicyFor({}),
    ]) {
      if (policy.sameSite === "none") expect(policy.secure).toBe(true);
      if (policy.partitioned) expect(policy.sameSite).toBe("none");
    }
  });
});
