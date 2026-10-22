package com.example.model

data class ExportRecord(
    val id: String,
    val fileName: String,
    val format: ExportAudioFormat,
    val lufsAchieved: Float,
    val durationSeconds: Float,
    val sizeMb: Float,
    val exportedAt: String
)

data class ProcessingJob(
    val id: String,
    val title: String,
    val studioName: String,
    val progress: Float, // 0.0f to 1.0f
    val isRunning: Boolean,
    val statusText: String
)

data class Project(
    val id: String,
    val name: String,
    val genre: String = "Afrobeats",
    val bpm: Int = 106,
    val keySignature: String = "F# Minor",
    val durationSeconds: Float = 194f,
    val createdAt: String = "Today",
    val updatedAt: String = "Just now",
    val tracks: List<AudioTrack> = emptyList(),
    val vocalRequest: VocalArrangementRequest = VocalArrangementRequest(),
    val selectedGenrePreset: GenrePreset = GenrePreset.MODERN_AFROBEATS,
    val mixRecommendations: List<MixRecommendation> = emptyList(),
    val activeMasterProfile: MasterProfileType = MasterProfileType.STREAMING_READY,
    val masteringControls: MasteringControls = MasteringControls(),
    val analysis: AudioAnalysis = AudioAnalysis(),
    val hasUnsavedChanges: Boolean = false
)
