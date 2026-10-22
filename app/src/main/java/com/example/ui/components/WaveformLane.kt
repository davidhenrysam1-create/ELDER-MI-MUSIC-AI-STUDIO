package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VolumeMute
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AudioTrack
import com.example.theme.*

@Composable
fun WaveformLane(
    track: AudioTrack,
    currentPositionSeconds: Float,
    totalDurationSeconds: Float,
    onMuteToggle: () -> Unit,
    onSoloToggle: () -> Unit,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
    accentColor: Color = NeonViolet
) {
    val progress = if (totalDurationSeconds > 0) (currentPositionSeconds / totalDurationSeconds).coerceIn(0f, 1f) else 0f

    val laneBorder = if (track.isSolo) GoldenYellow else if (track.isMuted) DarkMuted else accentColor.copy(alpha = 0.35f)
    val laneBg = if (track.isMuted) Color(0x99100E20) else Color(0xDD181434)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(laneBg)
            .border(1.dp, laneBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Track Controls Left Column
        Column(
            modifier = Modifier.width(110.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = track.name,
                color = if (track.isMuted) MutedText else SoftWhite,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1
            )
            Text(
                text = track.stemType.label,
                color = accentColor,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // Mute button
                Box(
                    modifier = Modifier
                        .size(width = 24.dp, height = 20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (track.isMuted) Magenta else DarkIndigo)
                        .clickable(onClick = onMuteToggle),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "M",
                        color = if (track.isMuted) SoftWhite else MutedText,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Solo button
                Box(
                    modifier = Modifier
                        .size(width = 24.dp, height = 20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (track.isSolo) GoldenYellow else DarkIndigo)
                        .clickable(onClick = onSoloToggle),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "S",
                        color = if (track.isSolo) DeepMidnight else MutedText,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = track.volumeDbString,
                    color = MutedText,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.align(Alignment.CenterVertically)
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Waveform Canvas Area
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFF0F0C1E))
                .clickable {
                    // Tap to seek
                    onSeek(progress * totalDurationSeconds)
                }
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height
                val midY = h / 2f

                val amps = track.waveform
                val barCount = amps.size.coerceAtLeast(1)
                val barWidth = (w / barCount) * 0.75f
                val barGap = (w / barCount) * 0.25f

                // Draw center zero line
                drawLine(
                    color = Color(0x22FFFFFF),
                    start = Offset(0f, midY),
                    end = Offset(w, midY),
                    strokeWidth = 1f
                )

                // Draw waveform bars
                amps.forEachIndexed { index, amp ->
                    val x = index * (barWidth + barGap)
                    val barHeight = amp * (h * 0.85f)
                    val isPastPlayhead = (x / w) <= progress

                    val barColor = when {
                        track.isMuted -> DarkMuted.copy(alpha = 0.5f)
                        isPastPlayhead -> accentColor
                        else -> accentColor.copy(alpha = 0.35f)
                    }

                    drawRoundRect(
                        color = barColor,
                        topLeft = Offset(x, midY - barHeight / 2f),
                        size = Size(barWidth, barHeight),
                        cornerRadius = CornerRadius(1.5f, 1.5f)
                    )
                }

                // Draw Playhead scrubber line
                val playheadX = w * progress
                drawLine(
                    color = SoftWhite,
                    start = Offset(playheadX, 0f),
                    end = Offset(playheadX, h),
                    strokeWidth = 2.5f
                )
            }
        }
    }
}
