package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AudioTrack
import com.example.model.GenrePreset
import com.example.model.StemType
import com.example.theme.*
import com.example.ui.components.*
import com.example.viewmodel.ElderMiViewModel

@Composable
fun SamMixStudioScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val currentProject = viewModel.currentProject.value
    val mixPrompt = viewModel.mixPrompt.value
    val isImproving = viewModel.isImprovingPrompt.value
    val recommendations = currentProject.mixRecommendations

    var selectedPreset by remember { mutableStateOf(currentProject.selectedGenrePreset) }
    var selectedChannelId by remember { mutableStateOf(currentProject.tracks.firstOrNull()?.id ?: "") }
    var showStemGuide by remember { mutableStateOf(false) }

    val activeTrack = currentProject.tracks.find { it.id == selectedChannelId } ?: currentProject.tracks.firstOrNull()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Studio Header
        item {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderBrush = MixStudioGradient,
                backgroundColor = Color(0xEE161230)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = CyanBlue.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, CyanBlue)
                        ) {
                            Text(
                                text = "WORKSPACE 2",
                                color = CyanBlue,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }

                        OutlinedButton(
                            onClick = { showStemGuide = true },
                            modifier = Modifier.height(28.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, CyanBlue.copy(alpha = 0.5f))
                        ) {
                            Icon(Icons.Default.HelpOutline, contentDescription = null, tint = CyanBlue, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("FL Studio & Cubase Guide", fontSize = 10.sp, color = SoftWhite)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    GradientText(
                        text = "Sam Mix Studio",
                        brush = MixStudioGradient,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "AI-assisted song mixing, audio analysis, stem processing, mixing recommendations, and compatible audio project workflows.",
                        color = MutedText,
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }
        }

        // Stem Drop / Upload Zone Card
        item {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderBrush = androidx.compose.ui.graphics.Brush.linearGradient(listOf(CyanBlue.copy(alpha = 0.4f), DarkIndigo)),
                backgroundColor = Color(0xDD120E24)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.CloudUpload,
                        contentDescription = "Upload Stems",
                        tint = CyanBlue,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Drop Your Music Project Here",
                        color = SoftWhite,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Upload audio tracks, stems (WAV, AIFF, MP3, FLAC, MIDI), or ZIP packages to begin.",
                        color = MutedText,
                        fontSize = 11.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                viewModel.generateVocalLayer(com.example.model.VocalToolType.CHORUS)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CyanBlue, contentColor = DeepMidnight),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Browse Stems / Package", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // AI Mixing Assistant Prompt Card
        item {
            PromptEditorCard(
                title = "AI Mixing Assistant",
                prompt = mixPrompt,
                onPromptChange = { viewModel.setMixPrompt(it) },
                onImprovePrompt = { viewModel.improvePrompt("Sam Mix Studio") },
                isImproving = isImproving,
                primaryActionLabel = "Apply Mixing Recommendations",
                onPrimaryAction = { viewModel.applyMixRecommendations() },
                accentBrush = MixStudioGradient,
                accentColor = CyanBlue,
                helperText = "The AI interprets your acoustic request and produces multi-track channel allocations."
            )
        }

        // Proposed Mix Stages / Recommendations
        if (recommendations.isNotEmpty()) {
            item {
                Text(
                    text = "PROPOSED PROCESSING STAGES (${recommendations.size})",
                    color = MutedText,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            items(recommendations) { rec ->
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = if (rec.isApplied) Color(0xDD1B293E) else Color(0xDD191535)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(rec.stageName, color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(CyanBlue.copy(alpha = 0.2f))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(rec.targetStem.label, color = CyanBlue, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(rec.summary, color = GoldenYellow, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            Text(rec.actionDetail, color = MutedText, fontSize = 11.sp)
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        if (rec.isApplied) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Applied", tint = SubtleLime, modifier = Modifier.size(24.dp))
                        } else {
                            Button(
                                onClick = { viewModel.applySingleMixRecommendation(rec.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = CyanBlue, contentColor = DeepMidnight),
                                contentPadding = PaddingValues(horizontal = 10.dp),
                                modifier = Modifier.height(30.dp)
                            ) {
                                Text("Apply", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Genre-Aware Starting Point Presets
        item {
            Text(
                text = "GENRE MIX STARTING POINTS",
                color = MutedText,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(GenrePreset.values()) { preset ->
                    val isChosen = preset == selectedPreset
                    GlassCard(
                        modifier = Modifier.width(180.dp),
                        backgroundColor = if (isChosen) Color(0xDD1E294A) else Color(0xDD15112B),
                        borderBrush = if (isChosen) androidx.compose.ui.graphics.Brush.linearGradient(listOf(CyanBlue, NeonViolet)) else GlassBorder,
                        onClick = { selectedPreset = preset }
                    ) {
                        Column {
                            Text(preset.label, color = if (isChosen) CyanBlue else SoftWhite, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(preset.bpmRange, color = GoldenYellow, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(preset.description, color = MutedText, fontSize = 10.sp, maxLines = 3)
                        }
                    }
                }
            }
        }

        // Multitrack Mixer Channel Strip Selector
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CONSOLE CHANNEL STRIPS",
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Tap channel to tune DSP",
                    color = CyanBlue,
                    fontSize = 10.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(currentProject.tracks) { track ->
                    val isSelected = track.id == selectedChannelId
                    MixerChannelMiniStrip(
                        track = track,
                        isSelected = isSelected,
                        onSelect = { selectedChannelId = track.id },
                        onVolumeChange = { viewModel.updateTrackVolume(track.id, it) },
                        onMuteToggle = { viewModel.toggleTrackMute(track.id) },
                        onSoloToggle = { viewModel.toggleTrackSolo(track.id) }
                    )
                }
            }
        }

        // Active Channel Detailed DSP Controls (EQ, Comp, Reverb, Delay)
        if (activeTrack != null) {
            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = Color(0xEE1A1638)
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "CHANNEL DSP: ${activeTrack.name.uppercase()}",
                                    color = SoftWhite,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Stem Type: ${activeTrack.stemType.label}",
                                    color = CyanBlue,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(
                                    onClick = { viewModel.toggleTrackMute(activeTrack.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = if (activeTrack.isMuted) Magenta else DarkIndigo),
                                    contentPadding = PaddingValues(horizontal = 8.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Text("MUTE", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }

                                Button(
                                    onClick = { viewModel.toggleTrackSolo(activeTrack.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = if (activeTrack.isSolo) GoldenYellow else DarkIndigo),
                                    contentPadding = PaddingValues(horizontal = 8.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Text("SOLO", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = if (activeTrack.isSolo) DeepMidnight else SoftWhite)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // 3-Band Parametric EQ Knobs
                        Text(
                            text = "3-BAND PARAMETRIC EQUALISER",
                            color = MutedText,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            RotaryKnob(
                                value = ((activeTrack.eqLowDb + 12f) / 24f).coerceIn(0f, 1f),
                                onValueChange = { norm ->
                                    val db = (norm * 24f) - 12f
                                    viewModel.updateTrackEq(activeTrack.id, db, activeTrack.eqMidDb, activeTrack.eqHighDb)
                                },
                                label = "LOW 80Hz",
                                displayValue = "${activeTrack.eqLowDb.toInt()} dB",
                                activeColor = WarmOrange
                            )

                            RotaryKnob(
                                value = ((activeTrack.eqMidDb + 12f) / 24f).coerceIn(0f, 1f),
                                onValueChange = { norm ->
                                    val db = (norm * 24f) - 12f
                                    viewModel.updateTrackEq(activeTrack.id, activeTrack.eqLowDb, db, activeTrack.eqHighDb)
                                },
                                label = "MID 1.5kHz",
                                displayValue = "${activeTrack.eqMidDb.toInt()} dB",
                                activeColor = GoldenYellow
                            )

                            RotaryKnob(
                                value = ((activeTrack.eqHighDb + 12f) / 24f).coerceIn(0f, 1f),
                                onValueChange = { norm ->
                                    val db = (norm * 24f) - 12f
                                    viewModel.updateTrackEq(activeTrack.id, activeTrack.eqLowDb, activeTrack.eqMidDb, db)
                                },
                                label = "HIGH 10kHz",
                                displayValue = "${activeTrack.eqHighDb.toInt()} dB",
                                activeColor = CyanBlue
                            )

                            RotaryKnob(
                                value = ((activeTrack.pan + 1f) / 2f).coerceIn(0f, 1f),
                                onValueChange = { norm ->
                                    val pan = (norm * 2f) - 1f
                                    viewModel.updateTrackPan(activeTrack.id, pan)
                                },
                                label = "PAN",
                                displayValue = activeTrack.panString,
                                activeColor = NeonViolet
                            )
                        }
                    }
                }
            }
        }
    }

    // FL Studio & Cubase Stem Export Guidance Modal Dialog
    if (showStemGuide) {
        AlertDialog(
            onDismissRequest = { showStemGuide = false },
            title = {
                Text("Exporting Stems from FL Studio & Cubase", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Native project files (.flp, .cpr) require external plugins and sample paths. For authentic AI mixing, export stems:",
                        color = MutedText,
                        fontSize = 12.sp
                    )

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = DarkIndigo,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("FL Studio Workflow", color = WarmOrange, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text("1. File > Export > Wave file\n2. Enable 'Split mixer tracks'\n3. Set 24-bit WAV, 44.1kHz or 48kHz\n4. Upload the generated stems ZIP here.", color = SoftWhite, fontSize = 11.sp)
                        }
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = DarkIndigo,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Cubase Workflow", color = CyanBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text("1. File > Export > Audio Mixdown\n2. Select 'Multiple' / Channel Batch Export\n3. Check all active audio/instrument channels\n4. Drop exported stems package into Sam Mix Studio.", color = SoftWhite, fontSize = 11.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showStemGuide = false },
                    colors = ButtonDefaults.buttonColors(containerColor = CyanBlue, contentColor = DeepMidnight)
                ) {
                    Text("Understood")
                }
            },
            containerColor = Color(0xFF1B1638)
        )
    }
}

@Composable
private fun MixerChannelMiniStrip(
    track: AudioTrack,
    isSelected: Boolean,
    onSelect: () -> Unit,
    onVolumeChange: (Float) -> Unit,
    onMuteToggle: () -> Unit,
    onSoloToggle: () -> Unit
) {
    val borderColor = if (isSelected) CyanBlue else if (track.isSolo) GoldenYellow else DarkMuted.copy(alpha = 0.4f)
    val bgColor = if (isSelected) Color(0xEE221B48) else Color(0xDD15112B)

    Column(
        modifier = Modifier
            .width(84.dp)
            .height(210.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .clickable(onClick = onSelect)
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Track Name
        Text(
            text = track.name,
            color = SoftWhite,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )

        Text(
            text = track.stemType.label,
            color = CyanBlue,
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            maxLines = 1
        )

        // Fader & Meter Row
        Row(
            modifier = Modifier.weight(1f).padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Slider(
                value = track.volume,
                onValueChange = onVolumeChange,
                valueRange = 0f..1.5f,
                modifier = Modifier
                    .width(100.dp)
                    .height(28.dp),
                colors = SliderDefaults.colors(thumbColor = SoftWhite, activeTrackColor = CyanBlue)
            )
        }

        Text(
            text = track.volumeDbString,
            color = GoldenYellow,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace
        )

        // Mute / Solo mini buttons
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.isMuted) Magenta else DarkIndigo)
                    .clickable(onClick = onMuteToggle),
                contentAlignment = Alignment.Center
            ) {
                Text("M", color = SoftWhite, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }

            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.isSolo) GoldenYellow else DarkIndigo)
                    .clickable(onClick = onSoloToggle),
                contentAlignment = Alignment.Center
            ) {
                Text("S", color = if (track.isSolo) DeepMidnight else SoftWhite, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
