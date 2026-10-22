package com.example.data

import com.example.audio.AudioEngine
import com.example.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.*

class ProjectRepository {

    private val initialProjects = createSampleProjects()

    private val _projects = MutableStateFlow<List<Project>>(initialProjects)
    val projects: StateFlow<List<Project>> = _projects.asStateFlow()

    private val _currentProject = MutableStateFlow<Project>(initialProjects.first())
    val currentProject: StateFlow<Project> = _currentProject.asStateFlow()

    private val _voiceProfiles = MutableStateFlow<List<VoiceProfile>>(createSampleVoiceProfiles())
    val voiceProfiles: StateFlow<List<VoiceProfile>> = _voiceProfiles.asStateFlow()

    private val _exportHistory = MutableStateFlow<List<ExportRecord>>(createSampleExports())
    val exportHistory: StateFlow<List<ExportRecord>> = _exportHistory.asStateFlow()

    private val _processingJobs = MutableStateFlow<List<ProcessingJob>>(
        listOf(
            ProcessingJob("job_1", "Afro Chorus Layer Generation", "Sam Vocal Studio", 1.0f, false, "Completed successfully"),
            ProcessingJob("job_2", "LUFS & True Peak Stem Audit", "Sam Mastering Studio", 1.0f, false, "Ready for export")
        )
    )
    val processingJobs: StateFlow<List<ProcessingJob>> = _processingJobs.asStateFlow()

    fun selectProject(projectId: String) {
        val proj = _projects.value.find { it.id == projectId } ?: return
        _currentProject.value = proj
    }

    fun createNewProject(name: String, genre: String = "Afrobeats", bpm: Int = 106) {
        val newProj = Project(
            id = "proj_${System.currentTimeMillis()}",
            name = name.ifBlank { "Untitled Afrobeats Session" },
            genre = genre,
            bpm = bpm,
            createdAt = getCurrentDateFormatted(),
            updatedAt = "Just now",
            tracks = createDefaultTracksForProject(name)
        )
        val updatedList = listOf(newProj) + _projects.value
        _projects.value = updatedList
        _currentProject.value = newProj
    }

    fun updateProjectName(newName: String) {
        val updated = _currentProject.value.copy(name = newName, hasUnsavedChanges = true)
        updateCurrentProject(updated)
    }

    fun updateProjectBpm(newBpm: Int) {
        val updated = _currentProject.value.copy(bpm = newBpm, hasUnsavedChanges = true)
        updateCurrentProject(updated)
    }

    fun updateTrackVolume(trackId: String, volume: Float) {
        val updatedTracks = _currentProject.value.tracks.map { track ->
            if (track.id == trackId) track.copy(volume = volume) else track
        }
        updateCurrentProject(_currentProject.value.copy(tracks = updatedTracks, hasUnsavedChanges = true))
    }

    fun updateTrackPan(trackId: String, pan: Float) {
        val updatedTracks = _currentProject.value.tracks.map { track ->
            if (track.id == trackId) track.copy(pan = pan) else track
        }
        updateCurrentProject(_currentProject.value.copy(tracks = updatedTracks, hasUnsavedChanges = true))
    }

    fun toggleTrackMute(trackId: String) {
        val updatedTracks = _currentProject.value.tracks.map { track ->
            if (track.id == trackId) track.copy(isMuted = !track.isMuted) else track
        }
        updateCurrentProject(_currentProject.value.copy(tracks = updatedTracks, hasUnsavedChanges = true))
    }

    fun toggleTrackSolo(trackId: String) {
        val updatedTracks = _currentProject.value.tracks.map { track ->
            if (track.id == trackId) track.copy(isSolo = !track.isSolo) else track
        }
        updateCurrentProject(_currentProject.value.copy(tracks = updatedTracks, hasUnsavedChanges = true))
    }

    fun updateTrackEq(trackId: String, lowDb: Float, midDb: Float, highDb: Float) {
        val updatedTracks = _currentProject.value.tracks.map { track ->
            if (track.id == trackId) track.copy(eqLowDb = lowDb, eqMidDb = midDb, eqHighDb = highDb) else track
        }
        updateCurrentProject(_currentProject.value.copy(tracks = updatedTracks, hasUnsavedChanges = true))
    }

    fun addGeneratedVocalTrack(stemType: StemType, name: String) {
        val seed = (_currentProject.value.tracks.size + 1) * 37
        val newTrack = AudioTrack(
            id = "vocal_layer_${System.currentTimeMillis()}",
            name = name,
            stemType = stemType,
            volume = 0.85f,
            pan = if (stemType == StemType.HARMONY_HIGH) 0.35f else if (stemType == StemType.HARMONY_LOW) -0.35f else 0.0f,
            waveform = AudioEngine.generateRealisticWaveform(seed, 90)
        )
        val updated = _currentProject.value.copy(
            tracks = _currentProject.value.tracks + newTrack,
            hasUnsavedChanges = true
        )
        updateCurrentProject(updated)
    }

    fun setMasterProfile(profile: MasterProfileType) {
        val currentControls = _currentProject.value.masteringControls
        val newControls = currentControls.copy(
            targetLufs = profile.targetLufs,
            truePeakCeiling = profile.truePeakCeiling
        )
        val updatedAnalysis = _currentProject.value.analysis.copy(
            integratedLufs = profile.targetLufs,
            truePeakDb = profile.truePeakCeiling,
            headroomDb = kotlin.math.abs(profile.truePeakCeiling)
        )
        val updated = _currentProject.value.copy(
            activeMasterProfile = profile,
            masteringControls = newControls,
            analysis = updatedAnalysis,
            hasUnsavedChanges = true
        )
        updateCurrentProject(updated)
    }

    fun updateMasteringControl(
        targetLufs: Float,
        truePeak: Float,
        lowEnd: Float,
        stereoWidth: Float,
        saturation: Float
    ) {
        val controls = MasteringControls(
            targetLufs = targetLufs,
            truePeakCeiling = truePeak,
            lowEndAdjustmentDb = lowEnd,
            stereoWidthFactor = stereoWidth,
            saturationAmount = saturation
        )
        val analysis = _currentProject.value.analysis.copy(
            integratedLufs = targetLufs,
            truePeakDb = truePeak,
            stereoWidth = stereoWidth
        )
        updateCurrentProject(_currentProject.value.copy(
            masteringControls = controls,
            analysis = analysis,
            hasUnsavedChanges = true
        ))
    }

    fun applyRecommendation(recommendationId: String) {
        val updatedRecs = _currentProject.value.mixRecommendations.map { rec ->
            if (rec.id == recommendationId) rec.copy(isApplied = true) else rec
        }
        updateCurrentProject(_currentProject.value.copy(mixRecommendations = updatedRecs, hasUnsavedChanges = true))
    }

    fun setMixRecommendations(recommendations: List<MixRecommendation>) {
        updateCurrentProject(_currentProject.value.copy(mixRecommendations = recommendations, hasUnsavedChanges = true))
    }

    fun saveProject() {
        val updated = _currentProject.value.copy(hasUnsavedChanges = false, updatedAt = "Just now")
        updateCurrentProject(updated)
    }

    fun recordExport(format: ExportAudioFormat) {
        val proj = _currentProject.value
        val newRecord = ExportRecord(
            id = "exp_${System.currentTimeMillis()}",
            fileName = "${proj.name.replace(" ", "_")}_Master.${format.extension.lowercase()}",
            format = format,
            lufsAchieved = proj.masteringControls.targetLufs,
            durationSeconds = proj.durationSeconds,
            sizeMb = if (format == ExportAudioFormat.WAV_24) 42.5f else 7.8f,
            exportedAt = getCurrentDateFormatted()
        )
        _exportHistory.value = listOf(newRecord) + _exportHistory.value
    }

    private fun updateCurrentProject(updated: Project) {
        _currentProject.value = updated
        _projects.value = _projects.value.map { if (it.id == updated.id) updated else it }
    }

    private fun getCurrentDateFormatted(): String {
        val sdf = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
        return sdf.format(Date())
    }

    private fun createDefaultTracksForProject(name: String): List<AudioTrack> {
        return listOf(
            AudioTrack("tr_lead", "Lead Vocal (Dry)", StemType.LEAD_VOCAL, volume = 0.95f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(12, 85)),
            AudioTrack("tr_drums", "Afrobeat Drums", StemType.DRUMS, volume = 0.88f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(24, 85)),
            AudioTrack("tr_bass", "Log Drum & Sub", StemType.BASS, volume = 0.90f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(36, 85)),
            AudioTrack("tr_perc", "Shakers & Agogo", StemType.PERCUSSION, volume = 0.75f, pan = 0.25f, waveform = AudioEngine.generateRealisticWaveform(48, 85)),
            AudioTrack("tr_inst", "Keys & Guitar Skank", StemType.INSTRUMENTAL, volume = 0.78f, pan = -0.2f, waveform = AudioEngine.generateRealisticWaveform(60, 85))
        )
    }

    private fun createSampleProjects(): List<Project> {
        val proj1 = Project(
            id = "proj_lagos_vibes",
            name = "Lagos Nightfall (Afro-Fusion)",
            genre = "Afro-Fusion",
            bpm = 104,
            keySignature = "F# Minor",
            durationSeconds = 194f,
            createdAt = "Oct 20, 2026",
            updatedAt = "2 hrs ago",
            tracks = listOf(
                AudioTrack("t1", "Main Lead Vocal", StemType.LEAD_VOCAL, volume = 0.92f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(101)),
                AudioTrack("t2", "High Harmony (Tier 3)", StemType.HARMONY_HIGH, volume = 0.75f, pan = 0.35f, waveform = AudioEngine.generateRealisticWaveform(102)),
                AudioTrack("t3", "Low Harmony (Tier 5)", StemType.HARMONY_LOW, volume = 0.70f, pan = -0.35f, waveform = AudioEngine.generateRealisticWaveform(103)),
                AudioTrack("t4", "Zulu Choir Ensemble", StemType.CHOIR, volume = 0.80f, pan = 0.1f, waveform = AudioEngine.generateRealisticWaveform(104)),
                AudioTrack("t5", "Afro Drums & Kicks", StemType.DRUMS, volume = 0.88f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(105)),
                AudioTrack("t6", "Amapiano Log Drum", StemType.BASS, volume = 0.92f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(106)),
                AudioTrack("t7", "Polyrhythmic Percussion", StemType.PERCUSSION, volume = 0.72f, pan = 0.4f, waveform = AudioEngine.generateRealisticWaveform(107))
            )
        )

        val proj2 = Project(
            id = "proj_amapiano_sunset",
            name = "Soweto Groove (Amapiano)",
            genre = "Amapiano-influenced Afrobeats",
            bpm = 113,
            keySignature = "G Minor",
            durationSeconds = 210f,
            createdAt = "Oct 18, 2026",
            updatedAt = "Yesterday",
            tracks = listOf(
                AudioTrack("p2_t1", "Lead Vocal Hook", StemType.LEAD_VOCAL, volume = 0.90f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(201)),
                AudioTrack("p2_t2", "Vocal Stabs & Chants", StemType.AD_LIB, volume = 0.78f, pan = -0.25f, waveform = AudioEngine.generateRealisticWaveform(202)),
                AudioTrack("p2_t3", "Amapiano Log Drums", StemType.BASS, volume = 0.95f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(203)),
                AudioTrack("p2_t4", "Rimshot & Claps", StemType.DRUMS, volume = 0.85f, pan = 0.0f, waveform = AudioEngine.generateRealisticWaveform(204))
            )
        )

        return listOf(proj1, proj2)
    }

    private fun createSampleVoiceProfiles(): List<VoiceProfile> {
        return listOf(
            VoiceProfile("vp_1", "Kemi Warm Alto", "Silky African alto with gentle breathy low-mids", "Afro-Soul & R&B"),
            VoiceProfile("vp_2", "Babajide High Tenor", "Crisp, energetic modern Afrobeats tenor lead", "Afro-Pop & Fusion"),
            VoiceProfile("vp_3", "Sipho Deep Baritone", "Rich South African ensemble choir anchor", "Gospel & Zulu Ensemble"),
            VoiceProfile("vp_4", "Nia Soulful Falsetto", "Angelic high-frequency air for ad-lib fills", "Modern Afrobeats")
        )
    }

    private fun createSampleExports(): List<ExportRecord> {
        return listOf(
            ExportRecord("exp_1", "Lagos_Nightfall_StreamingMaster.wav", ExportAudioFormat.WAV_24, -14.0f, 194f, 44.2f, "Oct 21, 2026"),
            ExportRecord("exp_2", "Lagos_Nightfall_ClubMaster.mp3", ExportAudioFormat.MP3_320, -9.0f, 194f, 7.8f, "Oct 21, 2026")
        )
    }
}
