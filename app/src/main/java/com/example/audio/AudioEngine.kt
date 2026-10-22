package com.example.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack as AndroidAudioTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.sin

data class PlaybackState(
    val isPlaying: Boolean = false,
    val currentPositionSeconds: Float = 0.0f,
    val durationSeconds: Float = 194.0f,
    val masterVolume: Float = 0.9f,
    val isLooping: Boolean = true,
    val leftLevel: Float = 0.0f,
    val rightLevel: Float = 0.0f
)

class AudioEngine(private val scope: CoroutineScope) {

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    private var playbackJob: Job? = null
    private var synthAudioTrack: AndroidAudioTrack? = null
    private var isSynthesizing = false

    fun togglePlayPause() {
        if (_playbackState.value.isPlaying) {
            pause()
        } else {
            play()
        }
    }

    fun play() {
        if (_playbackState.value.isPlaying) return
        _playbackState.value = _playbackState.value.copy(isPlaying = true)

        playbackJob?.cancel()
        playbackJob = scope.launch(Dispatchers.Default) {
            val stepIntervalMs = 50L
            val stepSeconds = stepIntervalMs / 1000f

            startSoftSynthAudio()

            while (isActive && _playbackState.value.isPlaying) {
                delay(stepIntervalMs)
                val current = _playbackState.value.currentPositionSeconds + stepSeconds
                val duration = _playbackState.value.durationSeconds

                val nextPos = if (current >= duration) {
                    if (_playbackState.value.isLooping) 0.0f else {
                        pause()
                        0.0f
                    }
                } else current

                // Compute dynamic animated VU meter peaks based on rhythmic beat pattern
                val beatPhase = (nextPos * 1.76f) % 1.0f // 106 BPM rhythm
                val basePulse = (1.0f - beatPhase) * 0.7f
                val noiseL = (kotlin.random.Random.nextFloat() * 0.25f)
                val noiseR = (kotlin.random.Random.nextFloat() * 0.25f)

                val left = (basePulse + noiseL).coerceIn(0.05f, 0.95f) * _playbackState.value.masterVolume
                val right = (basePulse + noiseR).coerceIn(0.05f, 0.95f) * _playbackState.value.masterVolume

                _playbackState.value = _playbackState.value.copy(
                    currentPositionSeconds = nextPos,
                    leftLevel = left,
                    rightLevel = right
                )
            }
        }
    }

    fun pause() {
        _playbackState.value = _playbackState.value.copy(
            isPlaying = false,
            leftLevel = 0.0f,
            rightLevel = 0.0f
        )
        playbackJob?.cancel()
        playbackJob = null
        stopSoftSynthAudio()
    }

    fun seekTo(seconds: Float) {
        val clamped = seconds.coerceIn(0.0f, _playbackState.value.durationSeconds)
        _playbackState.value = _playbackState.value.copy(currentPositionSeconds = clamped)
    }

    fun setMasterVolume(volume: Float) {
        _playbackState.value = _playbackState.value.copy(masterVolume = volume.coerceIn(0f, 1.2f))
    }

    fun toggleLoop() {
        _playbackState.value = _playbackState.value.copy(isLooping = !_playbackState.value.isLooping)
    }

    private fun startSoftSynthAudio() {
        if (isSynthesizing) return
        scope.launch(Dispatchers.IO) {
            try {
                isSynthesizing = true
                val sampleRate = 22050
                val minBufferSize = AndroidAudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                val bufferSize = minBufferSize.coerceAtLeast(sampleRate / 4)

                val track = AndroidAudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AndroidAudioTrack.MODE_STREAM)
                    .build()

                synthAudioTrack = track
                track.play()

                val buffer = ShortArray(1024)
                var phase = 0.0
                var noteStep = 0
                val chordFrequencies = doubleArrayOf(174.61, 220.0, 261.63, 329.63) // F Minor 7 Afrobeats chord

                while (isSynthesizing && _playbackState.value.isPlaying) {
                    val currentFreq = chordFrequencies[(noteStep / 40) % chordFrequencies.size]
                    val phaseIncrement = 2.0 * PI * currentFreq / sampleRate

                    for (i in buffer.indices) {
                        // Gentle musical harmonic pad
                        val s1 = sin(phase)
                        val s2 = sin(phase * 2.0) * 0.4
                        val s3 = sin(phase * 0.5) * 0.6
                        val sample = ((s1 + s2 + s3) * 0.25 * 32767.0 * _playbackState.value.masterVolume).toInt()
                        buffer[i] = sample.coerceIn(-32768, 32767).toShort()
                        phase += phaseIncrement
                        if (phase > 2.0 * PI) phase -= 2.0 * PI
                    }
                    track.write(buffer, 0, buffer.size)
                    noteStep++
                }
            } catch (_: Exception) {
                // Audio synthesis may be restricted in some virtual container environments
            } finally {
                stopSoftSynthAudio()
            }
        }
    }

    private fun stopSoftSynthAudio() {
        isSynthesizing = false
        try {
            synthAudioTrack?.pause()
            synthAudioTrack?.flush()
            synthAudioTrack?.release()
        } catch (_: Exception) {}
        synthAudioTrack = null
    }

    companion object {
        fun generateRealisticWaveform(seed: Int, count: Int = 80): List<Float> {
            val rng = java.util.Random(seed.toLong())
            return (0 until count).map { i ->
                val envelope = sin(i.toDouble() / count * PI).toFloat()
                val r = (rng.nextFloat() * 0.6f + 0.2f)
                (envelope * r + 0.1f).coerceIn(0.08f, 0.98f)
            }
        }
    }
}
