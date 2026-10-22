package com.example.theme

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = NeonViolet,
    onPrimary = SoftWhite,
    primaryContainer = ElectricPurple,
    onPrimaryContainer = SoftWhite,
    secondary = CyanBlue,
    onSecondary = DeepMidnight,
    secondaryContainer = StudioSurface,
    onSecondaryContainer = SoftWhite,
    tertiary = Magenta,
    onTertiary = SoftWhite,
    background = DeepMidnight,
    onBackground = SoftWhite,
    surface = StudioSurface,
    onSurface = SoftWhite,
    surfaceVariant = StudioCardBg,
    onSurfaceVariant = MutedText,
    outline = DarkMuted
)

@Composable
fun ElderMiMusicTheme(
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = DeepMidnight.toArgb()
            window.navigationBarColor = DeepMidnight.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}

// Glassmorphism modifier helper
fun Modifier.glassPanel(
    cornerRadius: Dp = 16.dp,
    borderBrush: Brush = GlassBorder,
    backgroundColor: Color = StudioCardBg,
    elevation: Dp = 6.dp
): Modifier = this
    .shadow(elevation, RoundedCornerShape(cornerRadius), ambientColor = Color.Black, spotColor = NeonViolet.copy(alpha = 0.25f))
    .clip(RoundedCornerShape(cornerRadius))
    .background(backgroundColor)
    .border(1.dp, borderBrush, RoundedCornerShape(cornerRadius))
