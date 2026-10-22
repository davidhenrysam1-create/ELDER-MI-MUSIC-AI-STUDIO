package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.Project
import com.example.theme.*
import com.example.ui.components.GlassCard
import com.example.ui.components.GradientText
import com.example.viewmodel.ElderMiViewModel
import com.example.viewmodel.StudioDestination

@Composable
fun DashboardScreen(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val currentProject = viewModel.currentProject.value
    val projects = viewModel.projects.value
    val exportHistory = viewModel.exportHistory.value
    val processingJobs = viewModel.processingJobs.value

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DeepMidnight)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Hero Welcome Section
        item {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderBrush = AccentCardBorder,
                backgroundColor = Color(0xEE161230)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = NeonViolet.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, NeonViolet.copy(alpha = 0.5f))
                        ) {
                            Text(
                                text = "AFROBEATS PRODUCTION PLATFORM",
                                color = CyanBlue,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }

                        Text(
                            text = "v1.0 Ready",
                            color = SubtleLime,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    GradientText(
                        text = "Welcome to Elder Mi Music AI Studio",
                        brush = BrandGradient,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Create powerful vocal arrangements, refine your mix, and master your sound with AI-assisted music production tools designed for Afrobeats.",
                        color = MutedText,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "“Your Sound. Your Culture. Your Studio.”",
                        color = GoldenYellow,
                        fontSize = 12.sp,
                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                        fontWeight = FontWeight.Medium
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { viewModel.setShowNewProjectDialog(true) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = NeonViolet,
                                contentColor = SoftWhite
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).height(44.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Create New Project", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        OutlinedButton(
                            onClick = { viewModel.navigateTo(StudioDestination.PROJECTS) },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = SoftWhite),
                            border = androidx.compose.foundation.BorderStroke(1.dp, CyanBlue.copy(alpha = 0.6f)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.height(44.dp)
                        ) {
                            Icon(Icons.Default.FolderOpen, contentDescription = null, tint = CyanBlue, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("My Sessions", fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Active Session Quick Stats Card
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CURRENT SESSION",
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "${currentProject.tracks.size} Stems Loaded",
                    color = CyanBlue,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = Color(0xDD1B1738)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentProject.name,
                            color = SoftWhite,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${currentProject.genre} • ${currentProject.bpm} BPM • Key: ${currentProject.keySignature}",
                            color = MutedText,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        IconButton(
                            onClick = { viewModel.audioEngine.togglePlayPause() },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(NeonViolet)
                        ) {
                            Icon(
                                imageVector = if (viewModel.playbackState.value.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = "Play",
                                tint = SoftWhite,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }

        // 3 Master Studio Workspaces Selection Section
        item {
            Text(
                text = "PRODUCTION STUDIOS",
                color = MutedText,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }

        // Card 1: Sam Vocal Studio
        item {
            StudioCard(
                title = "Sam Vocal Studio",
                badge = "VOCAL ARRANGEMENTS",
                description = "Create AI-assisted choruses, harmonies, ad-libs, vocal doubles, and powerful backing-vocal arrangements.",
                actionLabel = "Open Vocal Studio",
                gradient = VocalStudioGradient,
                accentColor = NeonViolet,
                icon = Icons.Default.Mic,
                featureTags = listOf("AI Chorus", "Zulu Choir", "Harmonies", "Doubling"),
                onClick = { viewModel.navigateTo(StudioDestination.VOCAL_STUDIO) }
            )
        }

        // Card 2: Sam Mix Studio
        item {
            StudioCard(
                title = "Sam Mix Studio",
                badge = "STEM BALANCING & DSP",
                description = "Analyse your tracks, improve the balance of your song, and refine your mix with AI-assisted production tools.",
                actionLabel = "Open Mix Studio",
                gradient = MixStudioGradient,
                accentColor = CyanBlue,
                icon = Icons.Default.Tune,
                featureTags = listOf("Stem Console", "EQ & Dynamics", "FL Studio Import", "AI Balance"),
                onClick = { viewModel.navigateTo(StudioDestination.MIX_STUDIO) }
            )
        }

        // Card 3: Sam Mastering Studio
        item {
            StudioCard(
                title = "Sam Mastering Studio",
                badge = "LUFS & TRUE PEAK",
                description = "Polish your final mix with tonal balancing, dynamics control, loudness analysis, and mastering tools.",
                actionLabel = "Open Mastering Studio",
                gradient = MasteringStudioGradient,
                accentColor = WarmOrange,
                icon = Icons.Default.Equalizer,
                featureTags = listOf("7 Afrobeats Profiles", "LUFS Audit", "A/B Compare", "WAV/MP3 Export"),
                onClick = { viewModel.navigateTo(StudioDestination.MASTERING_STUDIO) }
            )
        }

        // Recent Projects Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "RECENT PROJECTS",
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                TextButton(onClick = { viewModel.navigateTo(StudioDestination.PROJECTS) }) {
                    Text("View All", color = CyanBlue, fontSize = 12.sp)
                }
            }
        }

        items(projects) { proj ->
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = if (proj.id == currentProject.id) Color(0xDD221B48) else Color(0xDD15112B),
                onClick = { viewModel.selectProject(proj.id) }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (proj.id == currentProject.id) NeonViolet else DarkIndigo),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.MusicNote, contentDescription = null, tint = SoftWhite, modifier = Modifier.size(18.dp))
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Text(
                                text = proj.name,
                                color = SoftWhite,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${proj.genre} • ${proj.tracks.size} tracks • ${proj.bpm} BPM",
                                color = MutedText,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    if (proj.id == currentProject.id) {
                        Text(
                            text = "ACTIVE",
                            color = CyanBlue,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    } else {
                        OutlinedButton(
                            onClick = { viewModel.selectProject(proj.id) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Load", fontSize = 11.sp, color = SoftWhite)
                        }
                    }
                }
            }
        }

        // Recent Exports History
        if (exportHistory.isNotEmpty()) {
            item {
                Text(
                    text = "RECENT EXPORTS",
                    color = MutedText,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            items(exportHistory) { exp ->
                GlassCard(modifier = Modifier.fillMaxWidth(), backgroundColor = Color(0xDD141126)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = exp.fileName, color = SoftWhite, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "${exp.format.spec} • ${exp.lufsAchieved} LUFS • ${exp.sizeMb} MB",
                                color = SubtleLime,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Icon(Icons.Default.DownloadDone, contentDescription = "Exported", tint = SubtleLime, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioCard(
    title: String,
    badge: String,
    description: String,
    actionLabel: String,
    gradient: Brush,
    accentColor: Color,
    icon: ImageVector,
    featureTags: List<String>,
    onClick: () -> Unit
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        borderBrush = gradient,
        backgroundColor = Color(0xEE181434),
        onClick = onClick
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = accentColor.copy(alpha = 0.15f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, accentColor.copy(alpha = 0.4f))
                ) {
                    Text(
                        text = badge,
                        color = accentColor,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(accentColor.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(18.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            GradientText(
                text = title,
                brush = gradient,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = description,
                color = MutedText,
                fontSize = 12.sp,
                lineHeight = 17.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                featureTags.forEach { tag ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(DarkIndigo)
                            .padding(horizontal = 6.dp, vertical = 3.dp)
                    ) {
                        Text(tag, color = SoftWhite.copy(alpha = 0.8f), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = accentColor,
                    contentColor = if (accentColor == WarmOrange || accentColor == GoldenYellow) DeepMidnight else SoftWhite
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().height(38.dp)
            ) {
                Text(actionLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(6.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
            }
        }
    }
}
