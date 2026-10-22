package com.example.model

enum class MasterProfileType(
    val title: String,
    val targetLufs: Float,
    val truePeakCeiling: Float,
    val shortDesc: String,
    val character: String
) {
    STREAMING_READY(
        "Streaming-Ready Master",
        -14.0f,
        -1.0f,
        "Optimized for Spotify, Apple Music & YouTube without penalizing normalizers.",
        "Balanced, Transparent, Clean"
    ),
    LOUD_ENERGETIC(
        "Loud and Energetic Master",
        -9.0f,
        -0.3f,
        "Heavy radio loudness and club commercial presence with peak density.",
        "Aggressive, Dense, Maximum Punch"
    ),
    WARM_AFROBEATS(
        "Warm Afrobeats Master",
        -11.5f,
        -0.8f,
        "Analog tape warmth, enriched 150-300Hz low-mids and rounded transients.",
        "Silky Top End, Round Bass, Organic"
    ),
    PUNCHY_CLUB(
        "Punchy Club Master",
        -8.5f,
        -0.2f,
        "Sub-bass clarity for club sound systems with snappy percussive snap.",
        "Explosive Kick, Sub-Heavy, Loud"
    ),
    VOCAL_FORWARD(
        "Vocal-Forward Master",
        -12.0f,
        -0.8f,
        "Focuses listening attention onto the lead vocal and backing harmony choir.",
        "Vocal Presence, Vocal Air, Crisp"
    ),
    BASS_FOCUSED(
        "Bass-Focused Master",
        -10.0f,
        -0.5f,
        "Designed specifically for Amapiano log drums and heavy 808 sub basslines.",
        "Tight Log Drum, Sub Control, High Impact"
    ),
    SMOOTH_PREMIUM(
        "Smooth and Premium Master",
        -13.0f,
        -1.0f,
        "Audiophile-grade dynamic range, open high frequencies and wide spatial image.",
        "Pristine, Dynamic, Expansive"
    )
}

data class AudioAnalysis(
    val integratedLufs: Float = -15.8f,
    val shortTermLufs: Float = -14.2f,
    val peakLevelDb: Float = -0.8f,
    val truePeakDb: Float = -0.4f,
    val tonalBalance: String = "Good (Slight Mid-Bass Accumulation)",
    val lowFrequencyBalance: String = "+1.8 dB at 65Hz",
    val stereoWidth: Float = 1.15f,
    val headroomDb: Float = 0.4f,
    val dynamicRangeLu: Float = 8.6f,
    val sampleRate: String = "48.0 kHz",
    val bitDepth: String = "24-bit"
)

data class MasteringControls(
    val targetLufs: Float = -14.0f,
    val truePeakCeiling: Float = -1.0f,
    val lowEndAdjustmentDb: Float = 1.2f,
    val stereoWidthFactor: Float = 1.1f,
    val saturationAmount: Float = 0.35f,
    val dynamicPreservation: Float = 0.7f,
    val limitingThresholdDb: Float = -2.5f
)

enum class ExportAudioFormat(val extension: String, val spec: String) {
    WAV_24("WAV", "24-Bit / 48.0 kHz Uncompressed"),
    WAV_16("WAV", "16-Bit / 44.1 kHz Red Book CD"),
    MP3_320("MP3", "320 kbps Constant Bitrate (Broadcast Ready)")
}
