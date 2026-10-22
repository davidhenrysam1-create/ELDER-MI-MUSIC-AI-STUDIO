package com.example.model

enum class GenrePreset(val label: String, val bpmRange: String, val description: String) {
    MODERN_AFROBEATS("Modern Afrobeats", "100 - 108 BPM", "Punchy kick, crisp shakers, upfront vocal clarity and wide synth pads"),
    AFRO_POP("Afro-Pop Radio", "104 - 114 BPM", "Glossy lead vocal, controlled bass, bright top-end air and dynamic chorus impact"),
    AFRO_FUSION("Afro-Fusion Live", "98 - 106 BPM", "Warm analog midrange, organic percussion, subtle tape saturation and roomy reverbs"),
    AMAPIANO_GROOVE("Amapiano Groove", "112 - 116 BPM", "Sub-heavy log drums, tight percussive rimshots, syncopated vocal chops"),
    AFRO_SOUL("Afro-Soul Acoustic", "85 - 96 BPM", "Intimate vocal dynamics, natural instrument separation, gentle bus compression")
}

data class MixRecommendation(
    val id: String,
    val stageName: String,
    val targetStem: StemType,
    val summary: String,
    val actionDetail: String,
    val isApplied: Boolean = false
)

data class StemUploadFile(
    val id: String,
    val fileName: String,
    val format: String,
    val durationSeconds: Float,
    val sizeMb: Float,
    val stemType: StemType,
    val isProcessed: Boolean = true
)
