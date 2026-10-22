package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.theme.CyanBlue
import com.example.theme.DarkIndigo
import com.example.theme.ElectricPurple
import com.example.theme.MutedText
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun RotaryKnob(
    value: Float, // normalized 0f to 1f (or custom mapped)
    onValueChange: (Float) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    displayValue: String = "",
    sizeDp: Dp = 56.dp,
    activeColor: Color = CyanBlue
) {
    var accumulatedDelta by remember { mutableFloatStateOf(0f) }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(sizeDp)
                .pointerInput(Unit) {
                    detectDragGestures { change, dragAmount ->
                        change.consume()
                        accumulatedDelta -= dragAmount.y
                        val sensitivity = 0.005f
                        val delta = dragAmount.y * -sensitivity
                        val newVal = (value + delta).coerceIn(0f, 1f)
                        onValueChange(newVal)
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = Offset(size.width / 2, size.height / 2)
                val radius = (size.minDimension / 2) - 8f

                // Background track arc (from 135 deg to 405 deg)
                val startAngle = 135f
                val sweepMax = 270f

                drawArc(
                    color = DarkIndigo,
                    startAngle = startAngle,
                    sweepAngle = sweepMax,
                    useCenter = false,
                    style = Stroke(width = 6f, cap = StrokeCap.Round)
                )

                // Active arc
                drawArc(
                    color = activeColor,
                    startAngle = startAngle,
                    sweepAngle = sweepMax * value,
                    useCenter = false,
                    style = Stroke(width = 6f, cap = StrokeCap.Round)
                )

                // Knob Center circle
                drawCircle(
                    color = Color(0xFF1E193C),
                    radius = radius * 0.72f,
                    center = center
                )
                drawCircle(
                    color = ElectricPurple.copy(alpha = 0.4f),
                    radius = radius * 0.72f,
                    center = center,
                    style = Stroke(width = 2f)
                )

                // Indicator needle
                val angleRad = Math.toRadians((startAngle + sweepMax * value).toDouble())
                val needleStart = Offset(
                    center.x + (radius * 0.25f * cos(angleRad)).toFloat(),
                    center.y + (radius * 0.25f * sin(angleRad)).toFloat()
                )
                val needleEnd = Offset(
                    center.x + (radius * 0.65f * cos(angleRad)).toFloat(),
                    center.y + (radius * 0.65f * sin(angleRad)).toFloat()
                )

                drawLine(
                    color = activeColor,
                    start = needleStart,
                    end = needleEnd,
                    strokeWidth = 4f,
                    cap = StrokeCap.Round
                )
            }
        }

        Text(
            text = label,
            fontSize = 11.sp,
            color = MutedText,
            fontWeight = FontWeight.Medium
        )

        if (displayValue.isNotEmpty()) {
            Text(
                text = displayValue,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = activeColor
            )
        }
    }
}
