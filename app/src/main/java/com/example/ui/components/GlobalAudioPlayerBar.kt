package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.audio.PlaybackState
import com.example.theme.*

@Composable
fun GlobalAudioPlayerBar(
    playbackState: PlaybackState,
    projectName: String,
    onTogglePlay: () -> Unit,
    onSeek: (Float) -> Unit,
    onVolumeChange: (Float) -> Unit,
    onToggleLoop: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
            .border(1.dp, GlassBorder, RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)),
        color = DeepMidnight.copy(alpha = 0.95f),
        tonalElevation = 8.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            // Top scrub progress slider with timecodes
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = formatTime(playbackState.currentPositionSeconds),
                    color = CyanBlue,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Slider(
                    value = playbackState.currentPositionSeconds,
                    onValueChange = { onSeek(it) },
                    valueRange = 0f..playbackState.durationSeconds,
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 8.dp)
                        .height(28.dp),
                    colors = SliderDefaults.colors(
                        thumbColor = SoftWhite,
                        activeTrackColor = CyanBlue,
                        inactiveTrackColor = DarkIndigo
                    )
                )

                Text(
                    text = formatTime(playbackState.durationSeconds),
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Bottom Transport Controls Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left: Project Info & Tempo
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1.2f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(StudioCardBg)
                            .border(1.dp, NeonViolet.copy(alpha = 0.5f), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.GraphicEq,
                            contentDescription = "Playing Audio",
                            tint = NeonViolet,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Column {
                        Text(
                            text = projectName,
                            color = SoftWhite,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                        Text(
                            text = if (playbackState.isPlaying) "Playing • 106 BPM" else "Paused",
                            color = if (playbackState.isPlaying) SubtleLime else MutedText,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Center: Transport Buttons
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.weight(1.5f)
                ) {
                    // Loop Button
                    IconButton(
                        onClick = onToggleLoop,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Repeat,
                            contentDescription = "Loop Audio",
                            tint = if (playbackState.isLooping) CyanBlue else MutedText,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    // Play / Pause Primary Button
                    FloatingActionButton(
                        onClick = onTogglePlay,
                        modifier = Modifier.size(44.dp),
                        containerColor = NeonViolet,
                        contentColor = SoftWhite,
                        shape = CircleShape
                    ) {
                        Icon(
                            imageVector = if (playbackState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (playbackState.isPlaying) "Pause" else "Play",
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    // Stop / Rewind to start
                    IconButton(
                        onClick = { onSeek(0f) },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipPrevious,
                            contentDescription = "Rewind to Start",
                            tint = SoftWhite,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Right: Master Volume & Mini VU Meter
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.End,
                    modifier = Modifier.weight(1.2f)
                ) {
                    SingleLedBar(
                        level = playbackState.leftLevel,
                        modifier = Modifier
                            .width(8.dp)
                            .height(28.dp)
                    )
                    Spacer(modifier = Modifier.width(2.dp))
                    SingleLedBar(
                        level = playbackState.rightLevel,
                        modifier = Modifier
                            .width(8.dp)
                            .height(28.dp)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Icon(
                        imageVector = if (playbackState.masterVolume > 0.5f) Icons.Default.VolumeUp else Icons.Default.VolumeDown,
                        contentDescription = "Master Volume",
                        tint = MutedText,
                        modifier = Modifier.size(18.dp)
                    )

                    Slider(
                        value = playbackState.masterVolume,
                        onValueChange = onVolumeChange,
                        valueRange = 0f..1.2f,
                        modifier = Modifier
                            .width(60.dp)
                            .height(28.dp),
                        colors = SliderDefaults.colors(
                            thumbColor = CyanBlue,
                            activeTrackColor = CyanBlue,
                            inactiveTrackColor = DarkIndigo
                        )
                    )
                }
            }
        }
    }
}

private fun formatTime(seconds: Float): String {
    val totalSec = seconds.toInt().coerceAtLeast(0)
    val mins = totalSec / 60
    val secs = totalSec % 60
    return String.format("%02d:%02d", mins, secs)
}
