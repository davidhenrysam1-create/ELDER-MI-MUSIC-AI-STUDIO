/**
 * GET /api/health
 *
 * A deliberately tiny liveness probe for hosting platforms.
 *
 * Render (and Docker's HEALTHCHECK, and any uptime monitor) needs an endpoint
 * that answers quickly and does not depend on anything else being healthy. This
 * route therefore touches NO database, NO Supabase call and NO filesystem — it
 * only reports that the Node process is up and serving.
 *
 * It is unauthenticated on purpose (a health check cannot sign in) and returns
 * nothing sensitive: no paths, no keys, no account addresses.
 *
 * Must stay dynamic so a static optimisation never freezes the answer.
 */
export const dynamic = "force-dynamic";

/** Never cached: a stale "ok" would hide a dead instance. */
const NO_STORE = { "cache-control": "no-store" } as const;

export async function GET() {
  return Response.json(
    {
      ok: true,
      // Which release is answering, so a deploy can be confirmed from a browser.
      version: "1.1.0",
      // Honest environment marker: "production" or "development".
      environment: process.env.NODE_ENV ?? "unknown",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}

/** Some platforms (and browsers) probe with HEAD first. */
export async function HEAD() {
  return new Response(null, { status: 200, headers: NO_STORE });
}
