const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt, studioType } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "A prompt string is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!studioType || !["vocal", "mix", "mastering"].includes(studioType)) {
      return new Response(
        JSON.stringify({ error: "A valid studioType is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const improved = generateLocalImprovement(prompt, studioType);
      return new Response(
        JSON.stringify({
          improvedPrompt: improved,
          source: "local",
          note: "Prompt improved using built-in rules. Connect an OpenAI API key for AI-powered improvements.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompts: Record<string, string> = {
      vocal: "You are an expert Afrobeats vocal producer. Improve the user's vocal arrangement instructions to be specific, professional, and actionable. Include details about harmony types, layer counts, arrangement density, placement, and genre-appropriate characteristics. Keep it concise and practical.",
      mix: "You are an expert Afrobeats mixing engineer. Improve the user's mixing instructions to be specific, professional, and actionable. Include details about frequency balance, dynamics, spatial placement, genre-specific considerations, and reference to standard mixing practices. Keep it concise and practical.",
      mastering: "You are an expert Afrobeats mastering engineer. Improve the user's mastering instructions to be specific, professional, and actionable. Include details about loudness targets, tonal balance, dynamic control, format considerations, and genre-specific characteristics. Keep it concise and practical.",
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompts[studioType] },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", errText);
      const improved = generateLocalImprovement(prompt, studioType);
      return new Response(
        JSON.stringify({
          improvedPrompt: improved,
          source: "local-fallback",
          note: "AI service returned an error. Used built-in rules instead.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const improvedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!improvedPrompt) {
      throw new Error("Empty response from AI service");
    }

    return new Response(
      JSON.stringify({ improvedPrompt, source: "openai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateLocalImprovement(prompt: string, studioType: string): string {
  const base = prompt.trim();

  if (studioType === "vocal") {
    return `${base}. Specifically: generate layered backing vocals with 3-4 harmony parts (high, mid, low), add rhythmic call-and-response phrases in the chorus, include 2 ad-lib tracks with energetic delivery, create vocal doubles on the lead for thickness, and ensure the arrangement complements the Afrobeats groove. Set vocal intensity to medium-high with natural performance character. Place harmonies behind the lead vocal in the stereo field.`;
  }

  if (studioType === "mix") {
    return `${base}. Specifically: improve vocal clarity with presence boost around 3-5 kHz, control low frequencies below 80 Hz on non-bass tracks, create separation between bass and kick with appropriate EQ cuts, keep percussion energetic with transient preservation, position backing vocals behind the lead with reverb and delay, apply gentle compression on vocals (3:1 ratio), and ensure the mix translates well across playback systems. Target a modern Afrobeats balance.`;
  }

  return `${base}. Specifically: target integrated loudness of -14 LUFS for streaming or -10 LUFS for loud master, set true-peak ceiling at -1.0 dBTP, maintain warm low-end without muddiness, preserve percussion punch and transient detail, ensure vocal clarity in the upper midrange, apply multiband compression for tonal balance, use stereo widening on non-low-frequency elements, and finalize with limiting for consistent loudness. Export at 24-bit/48 kHz WAV for production quality.`;
}
