package com.example.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.ai.GeminiService
import com.example.audio.AudioEngine
import com.example.audio.PlaybackState
import com.example.data.ProjectRepository
import com.example.model.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class StudioDestination(val route: String, val title: String) {
    DASHBOARD("dashboard", "Dashboard"),
    VOCAL_STUDIO("vocal_studio", "Sam Vocal Studio"),
    MIX_STUDIO("mix_studio", "Sam Mix Studio"),
    MASTERING_STUDIO("mastering_studio", "Sam Mastering Studio"),
    PROJECTS("projects", "My Projects"),
    VOICE_PROFILES("voice_profiles", "My Voice Profiles"),
    EXPORTS("exports", "Export History"),
    SETTINGS("settings", "Settings")
}

data class UiNotification(
    val id: Long = System.currentTimeMillis(),
    val message: String,
    val isError: Boolean = false
)

class ElderMiViewModel : ViewModel() {

    private val repository = ProjectRepository()
    private val geminiService = GeminiService()
    val audioEngine = AudioEngine(viewModelScope)

    val projects: StateFlow<List<Project>> = repository.projects
    val currentProject: StateFlow<Project> = repository.currentProject
    val voiceProfiles: StateFlow<List<VoiceProfile>> = repository.voiceProfiles
    val exportHistory: StateFlow<List<ExportRecord>> = repository.exportHistory
    val processingJobs: StateFlow<List<ProcessingJob>> = repository.processingJobs
    val playbackState: StateFlow<PlaybackState> = audioEngine.playbackState

    private val _currentDestination = MutableStateFlow(StudioDestination.DASHBOARD)
    val currentDestination: StateFlow<StudioDestination> = _currentDestination.asStateFlow()

    private val _isImprovingPrompt = MutableStateFlow(false)
    val isImprovingPrompt: StateFlow<Boolean> = _isImprovingPrompt.asStateFlow()

    private val _notification = MutableStateFlow<UiNotification?>(null)
    val notification: StateFlow<UiNotification?> = _notification.asStateFlow()

    // Dialog & Flow States
    private val _showNewProjectDialog = MutableStateFlow(false)
    val showNewProjectDialog: StateFlow<Boolean> = _showNewProjectDialog.asStateFlow()

    private val _showExportDialog = MutableStateFlow(false)
    val showExportDialog: StateFlow<Boolean> = _showExportDialog.asStateFlow()

    private val _showStemImportGuide = MutableStateFlow(false)
    val showStemImportGuide: StateFlow<Boolean> = _showStemImportGuide.asStateFlow()

    private val _showChoirDialog = MutableStateFlow(false)
    val showChoirDialog: StateFlow<Boolean> = _showChoirDialog.asStateFlow()

    private val _isMasterAbCompareMode = MutableStateFlow(false)
    val isMasterAbCompareMode: StateFlow<Boolean> = _isMasterAbCompareMode.asStateFlow()

    private val _isLoudnessMatched = MutableStateFlow(true)
    val isLoudnessMatched: StateFlow<Boolean> = _isLoudnessMatched.asStateFlow()

    // Vocal prompt
    private val _vocalPrompt = MutableStateFlow("Generate an energetic Afrobeats chorus with layered backing vocals, catchy call-and-response phrases, high harmonies, and group vocals.")
    val vocalPrompt: StateFlow<String> = _vocalPrompt.asStateFlow()

    // Mix prompt
    private val _mixPrompt = MutableStateFlow("Give this Afrobeats song a balanced, modern mix. Improve vocal clarity, control the low frequencies, create space between the bass and kick, and keep percussion wide.")
    val mixPrompt: StateFlow<String> = _mixPrompt.asStateFlow()

    // Mastering prompt
    private val _masteringPrompt = MutableStateFlow("Master this Afrobeats track for a polished commercial release. Keep the bass powerful but controlled, preserve percussion punch, and maximize loudness without distortion.")
    val masteringPrompt: StateFlow<String> = _masteringPrompt.asStateFlow()

    fun navigateTo(destination: StudioDestination) {
        _currentDestination.value = destination
    }

    fun selectProject(projectId: String) {
        repository.selectProject(projectId)
        showNotification("Loaded project: ${currentProject.value.name}")
    }

    fun createProject(name: String, genre: String, bpm: Int) {
        repository.createNewProject(name, genre, bpm)
        _showNewProjectDialog.value = false
        showNotification("Created new session: $name")
    }

    fun saveCurrentProject() {
        repository.saveProject()
        showNotification("Session saved successfully")
    }

    fun setVocalPrompt(prompt: String) {
        _vocalPrompt.value = prompt
    }

    fun setMixPrompt(prompt: String) {
        _mixPrompt.value = prompt
    }

    fun setMasteringPrompt(prompt: String) {
        _masteringPrompt.value = prompt
    }

    fun improvePrompt(workspaceName: String) {
        viewModelScope.launch {
            _isImprovingPrompt.value = true
            val current = when (workspaceName) {
                "Sam Vocal Studio" -> _vocalPrompt.value
                "Sam Mix Studio" -> _mixPrompt.value
                else -> _masteringPrompt.value
            }
            val result = geminiService.improvePrompt(current, workspaceName, currentProject.value.genre)
            result.onSuccess { improved ->
                when (workspaceName) {
                    "Sam Vocal Studio" -> _vocalPrompt.value = improved
                    "Sam Mix Studio" -> _mixPrompt.value = improved
                    else -> _masteringPrompt.value = improved
                }
                showNotification("Prompt enhanced by Gemini AI")
            }
            _isImprovingPrompt.value = false
        }
    }

    fun generateVocalLayer(toolType: VocalToolType) {
        viewModelScope.launch {
            showNotification("AI Engine generating ${toolType.title}...")
            delay(1200L) // Real async synthesis simulation
            val stemType = when (toolType) {
                VocalToolType.CHORUS -> StemType.CHORUS
                VocalToolType.HARMONY -> StemType.HARMONY_HIGH
                VocalToolType.AD_LIB -> StemType.AD_LIB
                VocalToolType.SA_CHOIR -> StemType.CHOIR
                VocalToolType.DOUBLING -> StemType.VOCAL_DOUBLE
                VocalToolType.VOICE_TRANSFORM -> StemType.LEAD_VOCAL
            }
            val layerName = "AI ${toolType.title} (Layer ${currentProject.value.tracks.size + 1})"
            repository.addGeneratedVocalTrack(stemType, layerName)
            showNotification("Added $layerName to vocal timeline")
        }
    }

    fun applyMixRecommendations() {
        viewModelScope.launch {
            _isImprovingPrompt.value = true
            val result = geminiService.generateMixRecommendations(_mixPrompt.value, currentProject.value.selectedGenrePreset)
            result.onSuccess { recs ->
                repository.setMixRecommendations(recs)
                showNotification("Generated ${recs.size} mixing stages")
            }
            _isImprovingPrompt.value = false
        }
    }

    fun applySingleMixRecommendation(id: String) {
        repository.applyRecommendation(id)
        showNotification("Applied mixing recommendation")
    }

    fun updateTrackVolume(trackId: String, volume: Float) {
        repository.updateTrackVolume(trackId, volume)
    }

    fun updateTrackPan(trackId: String, pan: Float) {
        repository.updateTrackPan(trackId, pan)
    }

    fun toggleTrackMute(trackId: String) {
        repository.toggleTrackMute(trackId)
    }

    fun toggleTrackSolo(trackId: String) {
        repository.toggleTrackSolo(trackId)
    }

    fun updateTrackEq(trackId: String, low: Float, mid: Float, high: Float) {
        repository.updateTrackEq(trackId, low, mid, high)
    }

    fun selectMasterProfile(profile: MasterProfileType) {
        repository.setMasterProfile(profile)
        showNotification("Applied profile: ${profile.title}")
    }

    fun updateMasteringControls(targetLufs: Float, truePeak: Float, lowEnd: Float, width: Float, sat: Float) {
        repository.updateMasteringControl(targetLufs, truePeak, lowEnd, width, sat)
    }

    fun toggleMasterAbCompare() {
        _isMasterAbCompareMode.value = !_isMasterAbCompareMode.value
    }

    fun toggleLoudnessMatched() {
        _isLoudnessMatched.value = !_isLoudnessMatched.value
    }

    fun exportMaster(format: ExportAudioFormat) {
        viewModelScope.launch {
            showNotification("Rendering non-destructive master in ${format.extension}...")
            delay(1500L)
            repository.recordExport(format)
            _showExportDialog.value = false
            showNotification("Export completed: ${format.spec}")
        }
    }

    fun setShowNewProjectDialog(show: Boolean) { _showNewProjectDialog.value = show }
    fun setShowExportDialog(show: Boolean) { _showExportDialog.value = show }
    fun setShowStemImportGuide(show: Boolean) { _showStemImportGuide.value = show }
    fun setShowChoirDialog(show: Boolean) { _showChoirDialog.value = show }

    fun clearNotification() { _notification.value = null }

    private fun showNotification(msg: String, isError: Boolean = false) {
        _notification.value = UiNotification(message = msg, isError = isError)
    }
}
