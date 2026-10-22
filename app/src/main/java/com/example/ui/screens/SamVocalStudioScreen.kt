package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.example.model.ChoirStyle
import com.example.model.StemType
import com.example.model.VocalToolType
import com.example.theme.*
import com.example.ui.components.GlassCard
import com.example.ui.components.GradientText
import com.example.ui.components.PromptEditorCard
import com.example.ui.components.WaveformLane
import com.example.viewmodel.ElderMiViewModel

@Composable
fun SamVocalStudioScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val currentProject = viewModel.currentProject.value
    val playbackState = viewModel.playbackState.value
    val vocalPrompt = viewModel.vocalPrompt.value
    val isImproving = viewModel.isImprovingPrompt.value

    var selectedTool by remember { mutableStateOf(VocalToolType.CHORUS) }
    var vocalIntensity by remember { mutableFloatStateOf(0.8f) }
    var layerDensity by remember { mutableFloatStateOf(0.75f) }
    var selectedChoirStyle by remember { mutableStateOf(ChoirStyle.CALL_RESPONSE) }
    var choirSize by remember { mutableIntStateOf(16) }
    var showChoirDialog by remember { mutableStateOf(false) }

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
                borderBrush = VocalStudioGradient,
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
                            color = NeonViolet.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, NeonViolet)
                        ) {
                            Text(
                                text = "WORKSPACE 1",
                                color = NeonViolet,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }

                        Text(
                            text = "Key: ${currentProject.keySignature} • ${currentProject.bpm} BPM",
                            color = CyanBlue,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    GradientText(
                        text = "Sam Vocal Studio",
                        brush = VocalStudioGradient,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "AI vocal generation, chorus creation, vocal harmonies, ad-libs, backing vocals, choir arrangements, and vocal production.",
                        color = MutedText,
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }
        }

        // Tool Selector Tabs
        item {
            Text(
                text = "SELECT VOCAL ENGINE TOOL",
                color = MutedText,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            ScrollableTabRow(
                selectedTabIndex = selectedTool.ordinal,
                edgePadding = 0.dp,
                containerColor = Color(0xFF130F26),
                contentColor = NeonViolet,
                indicator = {}
            ) {
                VocalToolType.values().forEach { tool ->
                    val isSelected = tool == selectedTool
                    Tab(
                        selected = isSelected,
                        onClick = { selectedTool = tool },
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSelected) NeonViolet else DarkIndigo)
                            .border(1.dp, if (isSelected) Magenta else DarkMuted.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = tool.title,
                            color = if (isSelected) SoftWhite else MutedText,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }
        }

        // Arrangement Assistant & Prompt Refiner Card
        item {
            PromptEditorCard(
                title = "Vocal Arrangement Assistant",
                prompt = vocalPrompt,
                onPromptChange = { viewModel.setVocalPrompt(it) },
                onImprovePrompt = { viewModel.improvePrompt("Sam Vocal Studio") },
                isImproving = isImproving,
                primaryActionLabel = "Generate ${selectedTool.title}",
                onPrimaryAction = { viewModel.generateVocalLayer(selectedTool) },
                accentBrush = VocalStudioGradient,
                accentColor = NeonViolet,
                helperText = "Selected: ${selectedTool.shortDesc}"
            )
        }

        // Arrangement Parameter Sliders
        item {
            GlassCard(modifier = Modifier.fillMaxWidth(), backgroundColor = Color(0xDD181434)) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "PRODUCTION PARAMETERS",
                        color = MutedText,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Intensity Slider
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Vocal Intensity", color = SoftWhite, fontSize = 12.sp)
                        Text("${(vocalIntensity * 100).toInt()}%", color = CyanBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    Slider(
                        value = vocalIntensity,
                        onValueChange = { vocalIntensity = it },
                        modifier = Modifier.height(30.dp),
                        colors = SliderDefaults.colors(thumbColor = NeonViolet, activeTrackColor = NeonViolet)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Density Slider
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Arrangement Density", color = SoftWhite, fontSize = 12.sp)
                        Text("${(layerDensity * 100).toInt()}%", color = Magenta, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    Slider(
                        value = layerDensity,
                        onValueChange = { layerDensity = it },
                        modifier = Modifier.height(30.dp),
                        colors = SliderDefaults.colors(thumbColor = Magenta, activeTrackColor = Magenta)
                    )

                    if (selectedTool == VocalToolType.SA_CHOIR) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("South African Choir Preset", color = SoftWhite, fontSize = 12.sp)
                            OutlinedButton(
                                onClick = { showChoirDialog = true },
                                modifier = Modifier.height(30.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp)
                            ) {
                                Text(selectedChoirStyle.label, fontSize = 10.sp, color = GoldenYellow)
                            }
                        }
                    }
                }
            }
        }

        // Multitrack Vocal Timeline Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "VOCAL TIMELINE LANES",
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "${currentProject.tracks.filter { it.stemType.category == "Vocal" }.size} Active Vocal Lanes",
                    color = NeonViolet,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        // Timeline Waveform Lanes
        val vocalTracks = currentProject.tracks.filter { it.stemType.category == "Vocal" }
        if (vocalTracks.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.MicNone, contentDescription = null, tint = MutedText, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No vocal layers generated yet.", color = MutedText, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.generateVocalLayer(VocalToolType.CHORUS) },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonViolet)
                        ) {
                            Text("Generate First Chorus Layer", fontSize = 12.sp)
                        }
                    }
                }
            }
        } else {
            items(vocalTracks) { track ->
                WaveformLane(
                    track = track,
                    currentPositionSeconds = playbackState.currentPositionSeconds,
                    totalDurationSeconds = currentProject.durationSeconds,
                    onMuteToggle = { viewModel.toggleTrackMute(track.id) },
                    onSoloToggle = { viewModel.toggleTrackSolo(track.id) },
                    onSeek = { viewModel.audioEngine.seekTo(it) },
                    accentColor = when (track.stemType) {
                        StemType.LEAD_VOCAL -> CyanBlue
                        StemType.CHOIR -> GoldenYellow
                        StemType.HARMONY_HIGH, StemType.HARMONY_LOW -> NeonViolet
                        StemType.CHORUS -> Magenta
                        else -> ElectricBlue
                    }
                )
            }
        }
    }

    // South African Choir Configuration Modal Dialog
    if (showChoirDialog) {
        AlertDialog(
            onDismissRequest = { showChoirDialog = false },
            title = {
                Text("South African Choir Arranger", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Configure ensemble size, harmonic density, and authentic rhythmic chanting styles:",
                        color = MutedText,
                        fontSize = 12.sp
                    )

                    ChoirStyle.values().forEach { style ->
                        val isChosen = style == selectedChoirStyle
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isChosen) NeonViolet.copy(alpha = 0.25f) else DarkIndigo,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isChosen) NeonViolet else DarkMuted),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedChoirStyle = style }
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(style.label, color = if (isChosen) GoldenYellow else SoftWhite, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Text(style.description, color = MutedText, fontSize = 10.sp)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Choir Voices Size: $choirSize", color = SoftWhite, fontSize = 12.sp)
                        Slider(
                            value = choirSize.toFloat(),
                            onValueChange = { choirSize = it.toInt() },
                            valueRange = 4f..32f,
                            modifier = Modifier.width(140.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showChoirDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = NeonViolet)
                ) {
                    Text("Apply Choir Settings")
                }
            },
            dismissButton = {
                TextButton(onClick = { showChoirDialog = false }) {
                    Text("Cancel", color = MutedText)
                }
            },
            containerColor = Color(0xFF1B1638)
        )
    }
}
