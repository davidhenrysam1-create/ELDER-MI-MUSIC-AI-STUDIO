import type { MixRecommendation, MixPresetId, StemRole, StudioId } from "@/lib/types";
import { MIX_PRESETS } from "@/lib/types";

/**
 * Prompt + arrangement intelligence.
 *
 * If GEMINI_API_KEY is configured the model is called server-side (the key is
 * never exposed to the browser). Otherwise a deterministic, music-production
 * rule engine is used and the response is explicitly labelled
 * `source: "local-heuristic"` so the UI never pretends an AI call happened.
 */

export type PromptSource = "gemini" | "local-heuristic";

export interface ImprovedPrompt {
  text: string;
  source: PromptSource;
  note: string;
}

const STUDIO_CONTEXT: Record<StudioId, string> = {
  vocal:
    "Afrobeats vocal arrangement: syncopated call-and-response, stacked harmonies, choir width, vocal pocket, clear lead presence",
  mix:
    "Afrobeats mix engineering: kick/log-drum separation, controlled sub-bass, wide shakers and percussion, vocal clarity, depth and space",
  mastering:
    "Afrobeats mastering: streaming loudness, preserved percussion transients, controlled low end, vocal presence, controlled true peak",
};

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

async function callGemini(system: string, user: string, json = false): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = geminiModel();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: json ? 0.5 : 0.8,
          topP: 0.95,
          maxOutputTokens: 1024,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 180)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text.trim();
}

/* ------------------------------------------------------------------ */
/* Prompt improvement                                                  */
/* ------------------------------------------------------------------ */

export async function improvePrompt(
  prompt: string,
  studio: StudioId,
  context: { genre: string; bpm: number; key: string; tool?: string },
): Promise<ImprovedPrompt> {
  const cleaned = prompt.trim();
  if (!cleaned) throw new Error("Write an instruction first — the enhancer needs something to improve.");

  if (geminiConfigured()) {
    try {
      const system = [
        "You are Elder Mi, a senior Afrobeats producer, vocal arranger and mastering engineer.",
        `Rewrite the user's ${STUDIO_CONTEXT[studio]} instruction into one clear, practical production brief.`,
        "Be concrete: name frequency ranges, dynamics behaviour, stereo placement, section timing and target loudness where relevant.",
        "Never claim to have listened to audio you have not heard and never invent measured values.",
        "Return only the rewritten brief (max 110 words), no preamble, no quotes.",
      ].join(" ");
      const user = `Studio: ${studio}. Genre: ${context.genre}. Tempo: ${context.bpm} BPM. Key: ${context.key}.${
        context.tool ? ` Tool: ${context.tool}.` : ""
      }\nOriginal instruction: ${cleaned}`;
      const text = await callGemini(system, user);
      return {
        text: text.replace(/^["'`]+|["'`]+$/g, "").trim(),
        source: "gemini",
        note: `Enhanced by Gemini (${geminiModel()}) on the server.`,
      };
    } catch (err) {
      const fallback = localImprove(cleaned, studio, context);
      return {
        text: fallback,
        source: "local-heuristic",
        note: `Gemini request failed (${(err as Error).message.slice(0, 120)}). Used the local rule engine instead.`,
      };
    }
  }

  return {
    text: localImprove(cleaned, studio, context),
    source: "local-heuristic",
    note: "GEMINI_API_KEY is not configured, so the local rule-based production enhancer was used.",
  };
}

const HAS = (s: string, ...terms: string[]) => terms.some((t) => s.includes(t));

function localImprove(raw: string, studio: StudioId, ctx: { genre: string; bpm: number }): string {
  const s = raw.toLowerCase();
  const genre = ctx.genre;
  const bpm = ctx.bpm;

  if (studio === "vocal") {
    const parts: string[] = [];
    parts.push(
      `Build a ${genre} vocal arrangement at ${bpm} BPM around the existing lead, keeping the lead dry, centred and intelligible.`,
    );
    const layers = HAS(s, "layer", "stack", "harmon", "chorus", "choir")
      ? "Stack 4 backing layers: one unison double, one high harmony, one low harmony and a rhythmic group answer."
      : "Add two supporting layers (one double, one harmony) so the lead stays dominant.";
    parts.push(layers);
    if (HAS(s, "call", "response", "chant", "adlib", "ad-lib")) {
      parts.push(
        "Place call-and-response answers on the last beat of each 2-bar phrase, timed to leave the lead's first syllable clear.",
      );
    }
    if (HAS(s, "choir", "south africa", "zulu", "group")) {
      parts.push(
        "Widen the group layer to 70% stereo with 12–18 ms of inter-voice offset; low-pass the ensemble at 9 kHz so it sits behind the lead.",
      );
    }
    if (HAS(s, "clear", "natural", "clean")) {
      parts.push("High-pass every backing layer at 180 Hz and duck 2 dB under the lead with a 40 ms release.");
    }
    parts.push("Leave the original lead untouched and non-destructive; export layers separately.");
    return parts.join(" ");
  }

  if (studio === "mix") {
    const parts: string[] = [];
    parts.push(
      `Deliver a balanced, modern ${genre} mix at ${bpm} BPM with a stable gain structure and about 6 dB of headroom on the mix bus.`,
    );
    parts.push(
      HAS(s, "bass", "kick", "low")
        ? "Create kick/bass separation: high-pass the kick at 30 Hz with a 3 dB dip at 250 Hz, keep bass fundamentals full between 50–90 Hz, and sidechain 1.5–2.5 dB at 60 Hz with a 30 ms release."
        : "Keep sub-bass controlled below 100 Hz and clear the 200–400 Hz build-up on melodic parts.",
    );
    parts.push(
      HAS(s, "vocal", "clarity", "lead")
        ? "Lead vocal: high-pass at 110 Hz, presence lift +2 dB at 3.5 kHz, air shelf +1.5 dB at 10 kHz, 3:1 compression with a 20 ms attack, and automation to hold it 2–3 dB above the beat."
        : "Keep the lead vocal centred and 2–3 dB above the instrumental bed.",
    );
    if (HAS(s, "percussion", "shaker", "energy", "groove")) {
      parts.push(
        "Widen shakers and congas to 130% with a 350 Hz high-pass, and keep the polyrhythms transient-forward rather than compressed.",
      );
    }
    if (HAS(s, "backing", "harmony", "choir", "behind")) {
      parts.push(
        "Seat backing vocals 5–7 dB below the lead with a 1.4 s plate reverb at 18% send and a gentle 250 Hz dip for clarity.",
      );
    }
    parts.push("Report the processing that was actually applied; do not normalise the mix to a streaming target at this stage.");
    return parts.join(" ");
  }

  const parts: string[] = [];
  const lufsMatch = /-?\d{1,2}(\.\d)?\s?(lufs)/.exec(s);
  const target = lufsMatch ? `${lufsMatch[1]} LUFS` : "-14 LUFS integrated";
  parts.push(
    `Master for a commercial ${genre} release targeting ${target} with a -1.0 dBTP ceiling and no inter-sample clipping.`,
  );
  parts.push(
    HAS(s, "bass", "low", "powerful")
      ? "Add 1–2 dB of low shelf at 90 Hz, keep 250–400 Hz clean, and control sub movement with a 2:1 slow compressor before the limiter."
      : "Apply only corrective tonal moves; keep the low end within ±1 dB of the source balance.",
  );
  parts.push(
    HAS(s, "punch", "percussion", "transient")
      ? "Preserve percussion transients with a 30 ms limiter attack and light parallel saturation (≤0.25 drive)."
      : "Use gentle saturation (0.15–0.25) to add density without smearing transients.",
  );
  parts.push(
    HAS(s, "vocal", "clarity")
      ? "Add a 1.5 dB shelf at 8 kHz for vocal air without harshness at 3 kHz."
      : "Keep the vocal presence stable; avoid boosting 2–4 kHz above 1.5 dB.",
  );
  parts.push(
    "Verify the result by measurement after rendering and report achieved LUFS/true peak rather than predicted values.",
  );
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Mixing recommendations                                             */
/* ------------------------------------------------------------------ */

const SETTING_BOUNDS: Record<string, [number, number]> = {
  volumeDb: [-24, 6],
  pan: [-1, 1],
  eqLowDb: [-12, 12],
  eqMidDb: [-12, 12],
  eqHighDb: [-12, 12],
  compThresholdDb: [-40, 0],
  compRatio: [1, 8],
  reverbSend: [0, 1],
  delaySend: [0, 1],
  width: [0, 2],
};

/** Accept only known, numerically bounded channel settings from a model. */
function sanitizeSettings(input: unknown): Record<string, number> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [key, bounds] of Object.entries(SETTING_BOUNDS)) {
    const raw = (input as Record<string, unknown>)[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value)) {
      out[key] = Math.round(Math.min(bounds[1], Math.max(bounds[0], value)) * 100) / 100;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const ROLE_LABEL: Record<StemRole, string> = {
  lead_vocal: "Lead Vocal",
  double: "Vocal Double",
  harmony: "Harmony",
  chorus: "Chorus",
  adlib: "Ad-lib",
  choir: "Choir",
  drums: "Drums",
  bass: "Bass",
  percussion: "Percussion",
  keys: "Keys",
  instrumental: "Instrumental",
  other: "Track",
};

export async function mixRecommendations(
  prompt: string,
  presetId: MixPresetId,
  roles: StemRole[],
): Promise<{ recommendations: MixRecommendation[]; source: PromptSource; note: string }> {
  const preset = MIX_PRESETS.find((p) => p.id === presetId) ?? MIX_PRESETS[0];
  const available: StemRole[] = roles.filter((r) => r !== "other");

  if (geminiConfigured()) {
    try {
      const system = [
        "You are a senior Afrobeats mix engineer.",
        "Produce 4–6 concrete mixing stages as JSON.",
        'Schema: {"recommendations":[{"stage":string,"targetRole":string,"summary":string,"detail":string}]}',
        `Allowed targetRole values: ${available.join(", ") || "lead_vocal, drums, bass, percussion"}.`,
        "Each detail must be a specific, reviewable action (frequency, dB, ratio, timing). No invented measurements.",
        'Also include optional "settings" with numeric channel values chosen from: volumeDb (-24..6), pan (-1..1), eqLowDb, eqMidDb, eqHighDb (-12..12), compThresholdDb (-40..0), compRatio (1..8), reverbSend (0..1), delaySend (0..1), width (0..2).',
      ].join(" ");
      const user = `Genre preset: ${preset.label}. Brief: ${prompt}. Available stems: ${available.join(", ") || "unknown"}.`;
      const raw = await callGemini(system, user, true);
      const parsed = JSON.parse(raw) as {
        recommendations?: {
          stage?: string;
          targetRole?: string;
          summary?: string;
          detail?: string;
          settings?: Record<string, unknown>;
        }[];
      };
      const list = (parsed.recommendations ?? []).slice(0, 8).map((r, i) => ({
        id: `rec_${Date.now()}_${i}`,
        stage: r.stage?.slice(0, 90) || `Stage ${i + 1}`,
        targetRole: (available.includes(r.targetRole as StemRole)
          ? (r.targetRole as StemRole)
          : (available[0] ?? "lead_vocal")) as StemRole | "all",
        summary: r.summary?.slice(0, 200) || "Balancing action",
        detail: r.detail?.slice(0, 400) || "Adjust the channel to improve balance.",
        applied: false,
        settings: sanitizeSettings(r.settings),
      }));
      if (list.length) {
        return {
          recommendations: list,
          source: "gemini",
          note: `Generated by Gemini (${geminiModel()}). Review each stage before applying.`,
        };
      }
      throw new Error("Gemini returned no usable stages");
    } catch (err) {
      return {
        recommendations: localRecommendations(prompt, presetId, available),
        source: "local-heuristic",
        note: `Gemini request failed (${(err as Error).message.slice(0, 110)}). Local arrangement rules used instead.`,
      };
    }
  }

  return {
    recommendations: localRecommendations(prompt, presetId, available),
    source: "local-heuristic",
    note: "Local rule engine (GEMINI_API_KEY not configured). Every stage is a reviewable, editable suggestion.",
  };
}

function localRecommendations(
  prompt: string,
  presetId: MixPresetId,
  roles: StemRole[],
): MixRecommendation[] {
  const s = prompt.toLowerCase();
  const has = (r: StemRole) => roles.length === 0 || roles.includes(r);
  const out: MixRecommendation[] = [];
  const push = (
    stage: string,
    role: StemRole | "all",
    summary: string,
    detail: string,
    settings?: MixRecommendation["settings"],
  ) => {
    out.push({
      id: `rec_${Date.now()}_${out.length}`,
      stage,
      targetRole: role,
      summary,
      detail,
      applied: false,
      settings,
    });
  };

  if (has("bass") || has("drums")) {
    push(
      "Low-end separation",
      has("bass") ? "bass" : "drums",
      HAS(s, "kick", "bass", "low", "sub", "space")
        ? "Carve a 2 dB pocket at 60 Hz so the kick and bass stop masking each other"
        : "Tighten the sub-bass and keep the kick transient readable",
      "High-pass the kick at 30 Hz, dip the bass −2 dB between 55–70 Hz, then sidechain 1.5–2 dB at 60 Hz with a 30 ms release. Verify the combined low end does not exceed the rest of the mix by more than 3 dB.",
      { volumeDb: -2, eqLowDb: -2, eqMidDb: 0.5, compRatio: 3.5, compThresholdDb: -20 },
    );
  }
  if (has("lead_vocal")) {
    push(
      "Lead vocal clarity",
      "lead_vocal",
      "Presence lift and controlled dynamics",
      "High-pass at 110 Hz, +2 dB bell at 3.5 kHz, +1.5 dB shelf at 10 kHz, 3:1 compression with 20 ms attack / 120 ms release, then automate the lead 2–3 dB above the bed.",
      { volumeDb: 0.5, eqLowDb: -2, eqMidDb: 1, eqHighDb: 2, compRatio: 3, compThresholdDb: -18 },
    );
  }
  if (has("percussion")) {
    push(
      "Percussion width and air",
      "percussion",
      "Widen the shakers and clear the mud",
      "High-pass at 350 Hz, widen to 130%, and add +1 dB at 12 kHz. Keep the groove transient-forward: avoid more than 2 dB of compression on shakers.",
      { eqLowDb: -4, eqHighDb: 1, width: 1.3, compRatio: 1.5 },
    );
  }
  if (has("chorus") || has("harmony") || has("choir") || has("double") || has("adlib")) {
    push(
      "Backing vocal depth",
      has("choir") ? "choir" : has("chorus") ? "chorus" : "harmony",
      "Seat backing vocals behind the lead",
      "Set the backing bus 6 dB under the lead, send 18% to a 1.4 s plate, dip 250 Hz by 1.5 dB and duck 2 dB whenever the lead is singing.",
      { volumeDb: -6, eqLowDb: -1.5, reverbSend: 0.18, width: 1.25 },
    );
  }
  if (has("keys")) {
    push(
      "Mid-range space",
      "keys",
      "Clear the 300–500 Hz build-up",
      "High-pass the keys at 200 Hz, cut 2 dB at 400 Hz, and narrow slightly to leave room for the vocal and percussion.",
      { eqLowDb: -3, eqMidDb: -2, width: 0.9 },
    );
  }
  if (out.length < 3) {
    push(
      "Mix bus balance",
      "all",
      `Apply the ${MIX_PRESETS.find((p) => p.id === presetId)?.label ?? "Afrobeats"} balance as a starting point`,
      "Set a −6 dB mix-bus ceiling, check mono compatibility, and confirm the loudest section is not more than 4 dB above the quietest verse before mastering.",
      { volumeDb: -1 },
    );
  }
  return out;
}

export { ROLE_LABEL };
