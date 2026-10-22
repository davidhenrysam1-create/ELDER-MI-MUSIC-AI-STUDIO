package com.example.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Official Brand Palette
val DeepMidnight = Color(0xFF090914)
val DarkIndigo = Color(0xFF15112B)
val StudioCardBg = Color(0xDD181434)
val StudioSurface = Color(0xFF1F1B3E)
val StudioSurfaceLight = Color(0xFF28234E)

// Vibrant Accent Colors
val ElectricPurple = Color(0xFF8B5CF6)
val NeonViolet = Color(0xFFA855F7)
val CyanBlue = Color(0xFF22D3EE)
val ElectricBlue = Color(0xFF38BDF8)
val Magenta = Color(0xFFEC4899)
val HotPink = Color(0xFFF43F5E)
val WarmOrange = Color(0xFFFB923C)
val GoldenYellow = Color(0xFFFACC15)
val SubtleLime = Color(0xFF84CC16)

// Text & Neutral Colors
val SoftWhite = Color(0xFFF8FAFC)
val MutedText = Color(0xFFA1A1B5)
val DarkMuted = Color(0xFF6B6A82)
val GlowingBorder = Color(0x33A855F7)

// Studio Specific Gradients
val BrandGradient = Brush.linearGradient(
    colors = listOf(ElectricPurple, Magenta, CyanBlue)
)

val VocalStudioGradient = Brush.linearGradient(
    colors = listOf(NeonViolet, Magenta, CyanBlue)
)

val MixStudioGradient = Brush.linearGradient(
    colors = listOf(CyanBlue, ElectricBlue, ElectricPurple)
)

val MasteringStudioGradient = Brush.linearGradient(
    colors = listOf(WarmOrange, GoldenYellow, Magenta)
)

val AccentCardBorder = Brush.linearGradient(
    colors = listOf(CyanBlue.copy(alpha = 0.6f), NeonViolet.copy(alpha = 0.6f))
)

val GlassBorder = Brush.linearGradient(
    colors = listOf(Color(0x55FFFFFF), Color(0x11FFFFFF))
)

val GoldGradient = Brush.linearGradient(
    colors = listOf(GoldenYellow, WarmOrange)
)
