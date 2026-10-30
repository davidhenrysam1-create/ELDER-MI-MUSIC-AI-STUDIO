import { guard } from "@/lib/server/auth";
import { storageUsage } from "@/lib/server/db";
import { durableStorage, runtimeStatus, storageStatus } from "@/lib/server/drivers";
import { geminiConfigured, geminiModel } from "@/lib/server/promptEngine";
import { listDescriptors, providerSummary } from "@/lib/server/providers/registry";
import { spendSummary } from "@/lib/server/generation";
import { getSettings } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  const [settings, usage, spend] = await Promise.all([
    getSettings(),
    storageUsage(),
    spendSummary(),
  ]);
  return Response.json({
    version: "1.1.0",
    // Identity of the signed-in account, so the shell can greet them and the
    // account page can show who is logged in without a second request.
    user: auth.user,
    settings,
    storage: usage,
    /**
     * Where the audio and the database physically live.
     *
     * Settings shows this verbatim: "this machine's disk" until Supabase is
     * configured, and the bucket/table names once it is. The studio never
     * implies a backup that does not exist.
     */
    storageDrivers: {
      ...storageStatus(),
      durable: durableStorage(),
      /** Live: the remote store is configured but could not be reached. */
      runtime: runtimeStatus(),
      // Non-null when a driver was requested but could not start; Settings shows
      // it in red rather than letting "local" look like the intended choice.
      warning: storageStatus().warning,
    },
    spend,
    providers: {
      gemini: { configured: geminiConfigured(), model: geminiModel() },
      voiceConversion: {
        configured: Boolean(process.env.VOICE_CONVERSION_API_URL?.trim()),
        note: "Neural voice transformation requires a licensed external provider.",
      },
      // Music generation: one entry per adapter, with its real configuration
      // state so Settings and the studios can label unavailable options.
      generation: listDescriptors(),
      generationSummary: providerSummary(),
    },
    engines: {
      analysis: "Local EBU R128 / ITU-R BS.1770 implementation (K-weighting, gated LUFS, oversampled true peak)",
      playback: "Web Audio API",
      rendering: "OfflineAudioContext + in-house DSP post-chain",
      encoding: "In-house WAV encoder / lamejs MP3 encoder",
      generation:
        "Hosted providers only (Lyria, Stable Audio, ElevenLabs Music, Replicate MusicGen). No local model is bundled.",
    },
  });
}
