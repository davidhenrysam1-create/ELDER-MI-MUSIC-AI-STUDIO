package com.example.model

enum class StemType(val label: String, val category: String) {
    LEAD_VOCAL("Lead Vocal", "Vocal"),
    CHORUS("Chorus", "Vocal"),
    HARMONY_HIGH("High Harmony", "Vocal"),
    HARMONY_LOW("Low Harmony", "Vocal"),
    CHOIR("African Choir", "Vocal"),
    AD_LIB("Ad-Lib & Chants", "Vocal"),
    VOCAL_DOUBLE("Vocal Double", "Vocal"),
    DRUMS("Afro Drums", "Rhythm"),
    PERCUSSION("Percussion & Shakers", "Rhythm"),
    BASS("Log Drum & Bass", "Low End"),
    INSTRUMENTAL("Main Instrumental", "Music"),
    SYNTHS("Synths & Keys", "Music")
}

data class AudioTrack(
    val id: String,
    val name: String,
    val stemType: StemType,
    val volume: Float = 0.85f, // 0.0f to 1.5f
    val pan: Float = 0.0f,     // -1.0f (L) to 1.0f (R)
    val isMuted: Boolean = false,
    val isSolo: Boolean = false,
    val eqLowDb: Float = 0.0f,  // -12dB to +12dB
    val eqMidDb: Float = 0.0f,  // -12dB to +12dB
    val eqHighDb: Float = 0.0f, // -12dB to +12dB
    val compThresholdDb: Float = -16.0f,
    val compRatio: Float = 3.0f,
    val reverbSend: Float = 0.25f,
    val delaySend: Float = 0.15f,
    val stereoWidth: Float = 1.0f,
    val waveform: List<Float> = emptyList(),
    val durationSeconds: Float = 180f
) {
    val volumeDbString: String
        get() {
            if (volume <= 0.001f) return "-∞ dB"
            val db = (20 * kotlin.math.log10(volume)).toInt()
            return if (db > 0) "+$db dB" else "$db dB"
        }

    val panString: String
        get() = when {
            pan < -0.05f -> "L ${(-pan * 50).toInt()}"
            pan > 0.05f -> "R ${(pan * 50).toInt()}"
            else -> "C"
        }
}
