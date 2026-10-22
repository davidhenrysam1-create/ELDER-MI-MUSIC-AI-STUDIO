package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
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
import com.example.model.ExportAudioFormat
import com.example.model.MasterProfileType
import com.example.theme.*
import com.example.ui.components.GlassCard
import com.example.ui.components.GradientText
import com.example.ui.components.PromptEditorCard
import com.example.viewmodel.ElderMiViewModel

@Composable
fun SamMasteringStudioScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val currentProject = viewModel.currentProject.value
    val masteringPrompt = viewModel.masteringPrompt.value
    val isImproving = viewModel.isImprovingPrompt.value
    val activeProfile = currentProject.activeMasterProfile
    val controls = currentProject.masteringControls
    val analysis = currentProject.analysis
    val isAbMode = viewModel.isMasterAbCompareMode.value
    val isLoudnessMatched = viewModel.isLoudnessMatched.value
    val showExportDialog = viewModel.showExportDialog.value

    var showAdvancedDsp by remember { mutableStateOf(false) }
    var selectedExportFormat by remember { mutableStateOf(ExportAudioFormat.WAV_24) }

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
                borderBrush = MasteringStudioGradient,
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
                            color = WarmOrange.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, WarmOrange)
                        ) {
                            Text(
                                text = "WORKSPACE 3",
                                color = WarmOrange,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }

                        Button(
                            onClick = { viewModel.setShowExportDialog(true) },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldenYellow, contentColor = DeepMidnight),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Export Release Master", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    GradientText(
                        text = "Sam Mastering Studio",
                        brush = MasteringStudioGradient,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "AI-assisted professional mastering, loudness analysis, tonal balancing, dynamic control, and release-ready export preparation.",
                        color = MutedText,
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }
        }

        // Acoustic Analysis Meters Card (LUFS, True Peak, Dynamic Range)
        item {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = Color(0xEE1A153A),
                borderBrush = androidx.compose.ui.graphics.Brush.linearGradient(listOf(GoldenYellow.copy(alpha = 0.6f), WarmOrange.copy(alpha = 0.3f)))
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ACOUSTIC MEASUREMENTS (EBU R128)",
                            color = GoldenYellow,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "${analysis.sampleRate} / ${analysis.bitDepth}",
                            color = MutedText,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // 4 Metric Readouts Grid
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        MetricBox(
                            title = "INTEGRATED",
                            value = "${analysis.integratedLufs} LUFS",
                            status = if (analysis.integratedLufs <= -13.5f) "Compliant" else "Hot",
                            modifier = Modifier.weight(1f),
                            color = GoldenYellow
                        )

                        MetricBox(
                            title = "TRUE PEAK",
                            value = "${analysis.truePeakDb} dBTP",
                            status = if (analysis.truePeakDb <= -1.0f) "Safe Headroom" else "Near Ceiling",
                            modifier = Modifier.weight(1f),
                            color = WarmOrange
                        )

                        MetricBox(
                            title = "STEREO WIDTH",
                            value = "${(analysis.stereoWidth * 100).toInt()}%",
                            status = "Monocompatible",
                            modifier = Modifier.weight(1f),
                            color = CyanBlue
                        )

                        MetricBox(
                            title = "DYNAMIC RANGE",
                            value = "${analysis.dynamicRangeLu} LU",
                            status = "Punchy",
                            modifier = Modifier.weight(1f),
                            color = NeonViolet
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Tonal Balance: ${analysis.tonalBalance} • Low Frequency: ${analysis.lowFrequencyBalance}",
                        color = MutedText,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // A/B Master Comparison Bar
        item {
            GlassCard(modifier = Modifier.fillMaxWidth(), backgroundColor = Color(0xDD181434)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Master A/B Comparison", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(
                            text = if (isAbMode) "Listening to: MASTERED AUDIO (Chain Active)" else "Listening to: ORIGINAL UNMASTERED MIX",
                            color = if (isAbMode) GoldenYellow else CyanBlue,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = isLoudnessMatched,
                            onClick = { viewModel.toggleLoudnessMatched() },
                            label = { Text("Match Loudness", fontSize = 10.sp) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Color(0xFF281E48), selectedLabelColor = CyanBlue)
                        )

                        Button(
                            onClick = { viewModel.toggleMasterAbCompare() },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isAbMode) GoldenYellow else DarkIndigo,
                                contentColor = if (isAbMode) DeepMidnight else SoftWhite
                            ),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(if (isAbMode) "A / B: MASTER" else "A / B: ORIGINAL", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // 7 Selectable Mastering Profiles
        item {
            Text(
                text = "SELECT AFROBEATS MASTERING PROFILE",
                color = MutedText,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }

        items(MasterProfileType.values()) { profile ->
            val isSelected = profile == activeProfile
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = if (isSelected) Color(0xEE2A1E4A) else Color(0xDD15112B),
                borderBrush = if (isSelected) MasteringStudioGradient else GlassBorder,
                onClick = { viewModel.selectMasterProfile(profile) }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = profile.title,
                                color = if (isSelected) GoldenYellow else SoftWhite,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(WarmOrange.copy(alpha = 0.2f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    "${profile.targetLufs} LUFS • ${profile.truePeakCeiling} dBTP",
                                    color = GoldenYellow,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(profile.shortDesc, color = MutedText, fontSize = 11.sp)
                        Text("Sonic Character: ${profile.character}", color = CyanBlue, fontSize = 10.sp)
                    }

                    RadioButton(
                        selected = isSelected,
                        onClick = { viewModel.selectMasterProfile(profile) },
                        colors = RadioButtonDefaults.colors(selectedColor = GoldenYellow, unselectedColor = DarkMuted)
                    )
                }
            }
        }

        // Mastering Prompt Assistant
        item {
            PromptEditorCard(
                title = "Mastering Prompt Assistant",
                prompt = masteringPrompt,
                onPromptChange = { viewModel.setMasteringPrompt(it) },
                onImprovePrompt = { viewModel.improvePrompt("Sam Mastering Studio") },
                isImproving = isImproving,
                primaryActionLabel = "Apply Master Settings",
                onPrimaryAction = {
                    viewModel.updateMasteringControls(
                        activeProfile.targetLufs,
                        activeProfile.truePeakCeiling,
                        controls.lowEndAdjustmentDb,
                        controls.stereoWidthFactor,
                        controls.saturationAmount
                    )
                },
                accentBrush = MasteringStudioGradient,
                accentColor = WarmOrange,
                helperText = "Direct the AI on target loudness, bass punch, transient snap, and high-frequency sparkle."
            )
        }

        // Expandable Advanced DSP Controls Toggle
        item {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = Color(0xDD181434),
                onClick = { showAdvancedDsp = !showAdvancedDsp }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Advanced Precision Controls", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Icon(
                        imageVector = if (showAdvancedDsp) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "Toggle",
                        tint = GoldenYellow
                    )
                }
            }
        }

        // Advanced DSP Sliders (Expandable)
        if (showAdvancedDsp) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth(), backgroundColor = Color(0xEE1E183E)) {
                    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        // Loudness Target Slider
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Target Loudness", color = SoftWhite, fontSize = 12.sp)
                            Text("${controls.targetLufs.toInt()} LUFS", color = GoldenYellow, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        Slider(
                            value = controls.targetLufs,
                            onValueChange = {
                                viewModel.updateMasteringControls(it, controls.truePeakCeiling, controls.lowEndAdjustmentDb, controls.stereoWidthFactor, controls.saturationAmount)
                            },
                            valueRange = -18f..-7f,
                            colors = SliderDefaults.colors(thumbColor = GoldenYellow, activeTrackColor = GoldenYellow)
                        )

                        // True Peak Ceiling Slider
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("True Peak Ceiling", color = SoftWhite, fontSize = 12.sp)
                            Text("${String.format("%.1f", controls.truePeakCeiling)} dBTP", color = WarmOrange, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        Slider(
                            value = controls.truePeakCeiling,
                            onValueChange = {
                                viewModel.updateMasteringControls(controls.targetLufs, it, controls.lowEndAdjustmentDb, controls.stereoWidthFactor, controls.saturationAmount)
                            },
                            valueRange = -2.0f..-0.1f,
                            colors = SliderDefaults.colors(thumbColor = WarmOrange, activeTrackColor = WarmOrange)
                        )

                        // Low End Adjustment
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Amapiano Sub & Low Punch", color = SoftWhite, fontSize = 12.sp)
                            Text("${String.format("+%.1f", controls.lowEndAdjustmentDb)} dB", color = CyanBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        Slider(
                            value = controls.lowEndAdjustmentDb,
                            onValueChange = {
                                viewModel.updateMasteringControls(controls.targetLufs, controls.truePeakCeiling, it, controls.stereoWidthFactor, controls.saturationAmount)
                            },
                            valueRange = -4f..4f,
                            colors = SliderDefaults.colors(thumbColor = CyanBlue, activeTrackColor = CyanBlue)
                        )
                    }
                }
            }
        }
    }

    // Export Master Dialog
    if (showExportDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.setShowExportDialog(false) },
            title = {
                Text("Export Master Audio", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Choose distribution format. The original mix remains untouched (non-destructive pipeline):",
                        color = MutedText,
                        fontSize = 12.sp
                    )

                    ExportAudioFormat.values().forEach { fmt ->
                        val isChosen = fmt == selectedExportFormat
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isChosen) WarmOrange.copy(alpha = 0.25f) else DarkIndigo,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isChosen) GoldenYellow else DarkMuted),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedExportFormat = fmt }
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(fmt.extension, color = if (isChosen) GoldenYellow else SoftWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(fmt.spec, color = MutedText, fontSize = 10.sp)
                                }
                                RadioButton(selected = isChosen, onClick = { selectedExportFormat = fmt })
                            }
                        }
                    }

                    Text(
                        "Technical Output: Target ${controls.targetLufs} LUFS • ${controls.truePeakCeiling} dBTP ceiling",
                        color = SubtleLime,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.exportMaster(selectedExportFormat) },
                    colors = ButtonDefaults.buttonColors(containerColor = GoldenYellow, contentColor = DeepMidnight)
                ) {
                    Text("Render & Save Master", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setShowExportDialog(false) }) {
                    Text("Cancel", color = MutedText)
                }
            },
            containerColor = Color(0xFF1B1638)
        )
    }
}

@Composable
private fun MetricBox(
    title: String,
    value: String,
    status: String,
    modifier: Modifier = Modifier,
    color: Color
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DarkIndigo)
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .padding(6.dp)
    ) {
        Column {
            Text(title, color = MutedText, fontSize = 8.sp, fontFamily = FontFamily.Monospace)
            Spacer(modifier = Modifier.height(2.dp))
            Text(value, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Text(status, color = SoftWhite.copy(alpha = 0.7f), fontSize = 8.sp, maxLines = 1)
        }
    }
}
