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
import com.example.theme.*
import com.example.ui.components.GlassCard
import com.example.ui.components.GradientText
import com.example.viewmodel.ElderMiViewModel
import com.example.viewmodel.StudioDestination

@Composable
fun ProjectsScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val projects = viewModel.projects.value
    val currentProject = viewModel.currentProject.value

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                GradientText(
                    text = "My Studio Sessions",
                    brush = BrandGradient,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )

                Button(
                    onClick = { viewModel.setShowNewProjectDialog(true) },
                    colors = ButtonDefaults.buttonColors(containerColor = NeonViolet),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("New Project", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        items(projects) { proj ->
            val isCurrent = proj.id == currentProject.id
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = if (isCurrent) Color(0xEE241B4E) else Color(0xDD15112B),
                borderBrush = if (isCurrent) AccentCardBorder else GlassBorder,
                onClick = { viewModel.selectProject(proj.id) }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(proj.name, color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            if (isCurrent) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("ACTIVE", color = CyanBlue, fontSize = 9.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            "${proj.genre} • ${proj.bpm} BPM • Key: ${proj.keySignature}",
                            color = MutedText,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            "${proj.tracks.size} Stems • Created: ${proj.createdAt}",
                            color = DarkMuted,
                            fontSize = 10.sp
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedButton(
                            onClick = {
                                viewModel.selectProject(proj.id)
                                viewModel.navigateTo(StudioDestination.VOCAL_STUDIO)
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Vocal", fontSize = 10.sp, color = NeonViolet)
                        }

                        OutlinedButton(
                            onClick = {
                                viewModel.selectProject(proj.id)
                                viewModel.navigateTo(StudioDestination.MIX_STUDIO)
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Mix", fontSize = 10.sp, color = CyanBlue)
                        }

                        OutlinedButton(
                            onClick = {
                                viewModel.selectProject(proj.id)
                                viewModel.navigateTo(StudioDestination.MASTERING_STUDIO)
                            },
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Master", fontSize = 10.sp, color = WarmOrange)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun VoiceProfilesScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val profiles = viewModel.voiceProfiles.value

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            GradientText(
                text = "Authorized Voice Profiles",
                brush = VocalStudioGradient,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "Authorized African vocal references used for harmonic timbres and backing vocal character modeling with strict performer consent.",
                color = MutedText,
                fontSize = 12.sp
            )
        }

        items(profiles) { profile ->
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(profile.name, color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(SubtleLime.copy(alpha = 0.2f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("CONSENT CONFIRMED", color = SubtleLime, fontSize = 8.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(profile.timbreDescription, color = GoldenYellow, fontSize = 11.sp)
                        Text("Suitability: ${profile.genreSuitability}", color = MutedText, fontSize = 10.sp)
                    }

                    Icon(Icons.Default.Verified, contentDescription = "Verified", tint = CyanBlue, modifier = Modifier.size(24.dp))
                }
            }
        }
    }
}

@Composable
fun ExportHistoryScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val history = viewModel.exportHistory.value

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            GradientText(
                text = "Export History & Delivery",
                brush = MasteringStudioGradient,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text("Release-ready masters rendered non-destructively with acoustic measurement logs.", color = MutedText, fontSize = 12.sp)
        }

        if (history.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("No exports yet. Open Sam Mastering Studio to render release audio.", color = MutedText, fontSize = 12.sp)
                }
            }
        } else {
            items(history) { exp ->
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(exp.fileName, color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                "${exp.format.spec} • Target: ${exp.lufsAchieved} LUFS",
                                color = GoldenYellow,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                "Duration: ${(exp.durationSeconds / 60).toInt()}m ${(exp.durationSeconds % 60).toInt()}s • ${exp.sizeMb} MB • ${exp.exportedAt}",
                                color = MutedText,
                                fontSize = 10.sp
                            )
                        }

                        IconButton(onClick = { /* Download trigger */ }) {
                            Icon(Icons.Default.Download, contentDescription = "Download Master", tint = CyanBlue)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    var bufferSize by remember { mutableStateOf("512 Samples (Low Latency)") }
    var sampleRate by remember { mutableStateOf("48.0 kHz (Studio Standard)") }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            GradientText(
                text = "Studio Configuration & Preferences",
                brush = BrandGradient,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text("Manage audio engine buffer sizes, Gemini AI co-producer keys, and storage.", color = MutedText, fontSize = 12.sp)
        }

        item {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("AUDIO ENGINE HARDWARE", color = CyanBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Audio Buffer Size", color = SoftWhite, fontSize = 13.sp)
                        Text(bufferSize, color = GoldenYellow, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Internal Sample Rate", color = SoftWhite, fontSize = 13.sp)
                        Text(sampleRate, color = GoldenYellow, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Non-Destructive Editing", color = SoftWhite, fontSize = 13.sp)
                        Text("Enabled (Always Preserved)", color = SubtleLime, fontSize = 11.sp)
                    }
                }
            }
        }

        item {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("GEMINI AI CO-PRODUCER", color = NeonViolet, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)

                    Text(
                        "Elder Mi uses Gemini 3.5 Flash for natural language prompt improvement and Afrobeats arrangement recommendations.",
                        color = MutedText,
                        fontSize = 12.sp
                    )

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = DarkIndigo,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("API Key Status", color = SoftWhite, fontSize = 12.sp)
                            Text("Managed via Secrets Panel", color = CyanBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }

        item {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("ABOUT ELDER MI MUSIC AI STUDIO", color = GoldenYellow, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    Text("Platform: Elder Mi Music AI Studio", color = SoftWhite, fontSize = 12.sp)
                    Text("Slogan: “Your Sound. Your Culture. Your Studio.”", color = GoldenYellow, fontSize = 12.sp)
                    Text("Version: 1.0.0 (Afrobeats Native DAW)", color = MutedText, fontSize = 11.sp)
                }
            }
        }
    }
}
