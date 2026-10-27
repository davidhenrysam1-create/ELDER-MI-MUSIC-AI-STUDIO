/**
 * /api/generate/[id]
 *
 * GET     advance a pending job by one poll and return its real state
 * DELETE  cancel a pending job (best effort at the vendor, always recorded)
 *
 * Polling is explicit rather than server-push so the studio works on a plain
 * Node server with no queue infrastructure.
 */
import { advanceGeneration, cancelGeneration } from "@/lib/server/generation";
import { ProviderError } from "@/lib/server/providers/types";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const outcome = await advanceGeneration(id);
    if (!outcome) return jsonError("Generation job not found", 404);
    return Response.json(outcome);
  } catch (err) {
    if (err instanceof ProviderError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not poll the provider", 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const job = await cancelGeneration(id);
    if (!job) return jsonError("Generation job not found", 404);
    return Response.json({ job });
  } catch (err) {
    if (err instanceof ProviderError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not cancel the job", 500);
  }
}
