package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.theme.GlassBorder
import com.example.theme.StudioCardBg

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    borderBrush: Brush = GlassBorder,
    backgroundColor: Color = StudioCardBg,
    elevation: Dp = 4.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)

    val baseMod = modifier
        .shadow(elevation, shape, ambientColor = Color.Black.copy(alpha = 0.5f), spotColor = Color(0x33A855F7))
        .clip(shape)
        .background(backgroundColor)
        .border(1.dp, borderBrush, shape)

    val finalMod = if (onClick != null) {
        baseMod.clickable(onClick = onClick)
    } else {
        baseMod
    }

    Box(
        modifier = finalMod.padding(16.dp),
        content = content
    )
}
