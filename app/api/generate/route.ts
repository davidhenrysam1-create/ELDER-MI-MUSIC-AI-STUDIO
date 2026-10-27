/**
 * /api/generate
 *
 * POST  create a generation job (validates the budget before calling the vendor)
 * GET   list jobs, optionally filtered by `?projectId=`
 *
 * The response always includes the real job state. A failed job is returned with
 * a non-2xx status *and* the stored job, so the UI can show the vendor's message.
 */
import { createGeneration, listGenerations } from "@/lib/server/generation";
import { isProviderId } from "@/lib/server/providers/registry";
import { ProviderError, type GenerationKind } from "@/lib/server/providers/types";
import { asNumber, asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";
/** Providers can take minutes on long requests. */
export const maxDuration = 300;

const KINDS: GenerationKind[] = ["beat", "instrumental", "song", "vocals"];

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
  return Response.json({ jobs: await listGenerations(projectId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  const projectId = asString(body.projectId, "", 60);
  if (!projectId) return jsonError("projectId is required");

  if (!isProviderId(body.providerId)) {
    return jsonError("Choose a supported provider (lyria, stable_audio, elevenlabs_music, replicate_musicgen)");
  }
  const kind = asString(body.kind, "", 20) as GenerationKind;
  if (!KINDS.includes(kind)) {
    return jsonError(`kind must be one of ${KINDS.join(", ")}`);
  }

  try {
    const outcome = await createGeneration(projectId, {
      providerId: body.providerId,
      kind,
      prompt: asString(body.prompt, "", 600),
      negativePrompt: asString(body.negativePrompt, "", 600) || undefined,
      durationSec: asNumber(body.durationSec, 30, 1, 300),
      seed: body.seed == null ? undefined : asNumber(body.seed, 0, 0, 1_000_000),
    });
    // 200 even when the provider failed at runtime: the job is the payload.
    return Response.json(outcome);
  } catch (err) {
    if (err instanceof ProviderError) {
      return jsonError(err.message, err.status);
    }
    return jsonError((err as Error).message || "Generation failed", 500);
  }
}
