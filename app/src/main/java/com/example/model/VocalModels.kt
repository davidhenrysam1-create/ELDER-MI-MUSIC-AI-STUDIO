package com.example.model

enum class VocalToolType(val title: String, val shortDesc: String) {
    CHORUS("AI Chorus Generator", "Catchy layered Afrobeats hooks & group vocals"),
    HARMONY("AI Harmony Generator", "High, mid, low thirds & 5th harmonies"),
    AD_LIB("AI Ad-Lib Generator", "Chants, call-and-response & hype fills"),
    SA_CHOIR("South African Choir", "Deep ensemble vocal textures & call-refrains"),
    DOUBLING("AI Vocal Doubling", "Stereo-widened humanized double tracking"),
    VOICE_TRANSFORM("Voice Transformation", "Authorized reference timbre & character modeling")
}

enum class ChoirStyle(val label: String, val description: String) {
    ZULU_ENSEMBLE("Zulu Harmonic Ensemble", "Rich low-mid harmonies and melodic swells"),
    CALL_RESPONSE("Afro Call & Response", "Energetic rhythmic vocal leads answered by group choir"),
    AMAPIANO_HYPER("Amapiano Vocal Stabs", "Rhythmic syncopated chants, stabs and falsettos"),
    HIGHLIFE_CHOIR("Highlife Vocal Choir", "Warm polyphonic brass-like vocal arrangements"),
    SOUL_CHORUS("Afro-Soul Warm Choirs", "Intimate, warm acoustic choir backing")
}

data class VocalArrangementRequest(
    val toolType: VocalToolType = VocalToolType.CHORUS,
    val prompt: String = "Generate an energetic Afrobeats chorus with layered backing vocals, catchy call-and-response phrases, high harmonies, and group vocals.",
    val intensity: Float = 0.8f,        // 0f to 1.0f
    val layerDensity: Float = 0.75f,     // 0f to 1.0f
    val layerCount: Int = 4,            // 1 to 8
    val choirStyle: ChoirStyle = ChoirStyle.CALL_RESPONSE,
    val choirSize: Int = 12,            // 4 to 32 voices
    val performanceStyle: String = "Lively, Syncopated, Warm",
    val selectedSection: String = "Chorus (01:12 - 01:45)",
    val selectedVoiceProfileId: String? = null
)

data class VoiceProfile(
    val id: String,
    val name: String,
    val timbreDescription: String,
    val genreSuitability: String,
    val isAuthorized: Boolean = true,
    val consentConfirmed: Boolean = true
)
