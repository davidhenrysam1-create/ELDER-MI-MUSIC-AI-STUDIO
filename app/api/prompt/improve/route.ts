import { asString, jsonError } from "@/lib/server/validation";
import type { Genre, MixPresetId, StemRole, StudioId } from "@/lib/types";
import { improvePrompt } from "@/lib/server/promptEngine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const prompt = asString(body.prompt, "", 2000).trim();
  if (prompt.length < 4) return jsonError("Write at least a few words before improving the prompt.");
  const studio = asString(body.studio, "vocal") as StudioId;
  if (!["vocal", "mix", "mastering"].includes(studio)) return jsonError("Unknown studio");

  try {
    const result = await improvePrompt(prompt, studio, {
      genre: asString(body.genre, "Afrobeats") as Genre,
      bpm: typeof body.bpm === "number" ? body.bpm : 104,
      key: asString(body.key, "F# minor", 24),
      tool: asString(body.tool, "", 60) || undefined,
    });
    return Response.json(result);
  } catch (err) {
    return jsonError((err as Error).message, 400);
  }
}

export type ImprovePromptRequest = {
  prompt: string;
  studio: StudioId;
  genre: Genre;
  bpm: number;
  key: string;
  presetId?: MixPresetId;
  stems?: StemRole[];
};
