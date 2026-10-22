package com.example.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.theme.*

@Composable
fun StereoVUMeter(
    leftLevel: Float,
    rightLevel: Float,
    modifier: Modifier = Modifier,
    height: Dp = 100.dp,
    showLabels: Boolean = true
) {
    val animLeft by animateFloatAsState(targetValue = leftLevel.coerceIn(0f, 1f), label = "vuL")
    val animRight by animateFloatAsState(targetValue = rightLevel.coerceIn(0f, 1f), label = "vuR")

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DarkIndigo.copy(alpha = 0.8f))
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (showLabels) {
            Row(
                modifier = Modifier.width(44.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("L", color = MutedText, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                Text("R", color = MutedText, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        Row(
            modifier = Modifier.height(height),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            SingleLedBar(level = animLeft, modifier = Modifier.width(16.dp).fillMaxHeight())
            SingleLedBar(level = animRight, modifier = Modifier.width(16.dp).fillMaxHeight())
        }
    }
}

@Composable
fun SingleLedBar(
    level: Float,
    modifier: Modifier = Modifier,
    segmentCount: Int = 16
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val segmentGap = 2f
        val segHeight = (h - (segmentCount - 1) * segmentGap) / segmentCount

        for (i in 0 until segmentCount) {
            val segIndexFromBottom = segmentCount - 1 - i
            val threshold = segIndexFromBottom.toFloat() / segmentCount.toFloat()
            val isActive = level >= threshold

            val segColor = when {
                segIndexFromBottom >= segmentCount - 2 -> HotPink // Peak / Clip
                segIndexFromBottom >= segmentCount - 5 -> GoldenYellow // Caution / +3dB
                segIndexFromBottom >= segmentCount - 9 -> SubtleLime // Nominal / 0dB
                else -> CyanBlue // Safe / Low
            }

            val finalColor = if (isActive) segColor else segColor.copy(alpha = 0.15f)

            val yTop = i * (segHeight + segmentGap)
            drawRoundRect(
                color = finalColor,
                topLeft = Offset(0f, yTop),
                size = Size(w, segHeight),
                cornerRadius = CornerRadius(2f, 2f)
            )
        }
    }
}
