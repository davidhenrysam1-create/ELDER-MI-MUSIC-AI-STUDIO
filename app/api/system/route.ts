import { storageUsage } from "@/lib/server/db";
import { geminiConfigured, geminiModel } from "@/lib/server/promptEngine";
import { getSettings } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const usage = await storageUsage();
  return Response.json({
    version: "1.0.0",
    settings,
    storage: usage,
    providers: {
      gemini: { configured: geminiConfigured(), model: geminiModel() },
      voiceConversion: {
        configured: Boolean(process.env.VOICE_CONVERSION_API_URL?.trim()),
        note: "Neural voice transformation requires a licensed external provider.",
      },
    },
    engines: {
      analysis: "Local EBU R128 / ITU-R BS.1770 implementation (K-weighting, gated LUFS, oversampled true peak)",
      playback: "Web Audio API",
      rendering: "OfflineAudioContext + in-house DSP post-chain",
      encoding: "In-house WAV encoder / lamejs MP3 encoder",
    },
  });
}
