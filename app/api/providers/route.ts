/**
 * GET /api/providers
 *
 * Public catalogue of music-generation providers: what each can make, whether a
 * key is configured, the estimated cost, the licence, and how much of the spend
 * cap is left. Contains no secrets — only which environment variables are needed.
 */
import { guard } from "@/lib/server/auth";
import { listDescriptors, providerSummary } from "@/lib/server/providers/registry";
import { spendSummary } from "@/lib/server/generation";
import { getSettings } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  const [settings, spend] = await Promise.all([getSettings(), spendSummary()]);
  return Response.json({
    providers: listDescriptors(),
    summary: providerSummary(),
    spend,
    settings: {
      allowPaidGeneration: settings.allowPaidGeneration,
      spendCapUsd: settings.spendCapUsd,
    },
  });
}
