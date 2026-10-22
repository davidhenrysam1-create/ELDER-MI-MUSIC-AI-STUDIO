import { addVoiceProfile, listVoiceProfiles } from "@/lib/server/repo";
import { asString, jsonError } from "@/lib/server/validation";
import type { VoiceProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ voiceProfiles: await listVoiceProfiles() });
}

/**
 * Voice profiles are gated on an explicit consent confirmation: no reference
 * sample may be registered otherwise. Neural conversion itself requires an
 * external provider and is not offered until one is configured.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const name = asString(body.name, "", 60).trim();
  const consentName = asString(body.consentName, "", 80).trim();
  if (!name) return jsonError("Give the voice profile a name");
  if (body.consentConfirmed !== true) {
    return jsonError("Explicit consent is required before registering a voice profile.", 403);
  }
  if (!consentName) {
    return jsonError("Record who gave consent (your name or the performer's).", 403);
  }

  const profile: VoiceProfile = {
    id: `vp_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    name,
    timbreDescription: asString(body.timbreDescription, "", 200),
    genreSuitability: asString(body.genreSuitability, "Afrobeats", 80),
    consentConfirmed: true,
    consentName,
    referenceAssetId: body.referenceAssetId ? asString(body.referenceAssetId, "", 60) : null,
    createdAt: new Date().toISOString(),
  };
  await addVoiceProfile(profile);
  return Response.json({ voiceProfile: profile }, { status: 201 });
}
