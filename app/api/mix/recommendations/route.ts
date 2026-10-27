import { guardStudio } from "@/lib/server/auth";
import { mixRecommendations } from "@/lib/server/promptEngine";
import { asString, asRole, jsonError } from "@/lib/server/validation";
import type { MixPresetId, StemRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Mixing suggestions belong to the mixing room: producers and engineers only.
  const auth = await guardStudio("mix");
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const prompt = asString(body.prompt, "", 2000).trim();
  if (!prompt) return jsonError("A mixing brief is required");
  const presetId = asString(body.presetId, "modern_afrobeats") as MixPresetId;
  const stems = Array.isArray(body.stems) ? body.stems.map(asRole) : [];
  const result = await mixRecommendations(prompt, presetId, stems as StemRole[]);
  return Response.json(result);
}
