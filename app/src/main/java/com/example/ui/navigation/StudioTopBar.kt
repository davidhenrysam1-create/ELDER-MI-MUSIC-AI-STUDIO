package com.example.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.Project
import com.example.theme.*
import com.example.ui.components.GradientText
import com.example.viewmodel.ElderMiViewModel
import com.example.viewmodel.StudioDestination

@Composable
fun StudioTopBar(
    viewModel: ElderMiViewModel,
    modifier: Modifier = Modifier
) {
    val currentProject = viewModel.currentProject.value
    val currentDest = viewModel.currentDestination.value

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, GlassBorder, androidx.compose.ui.graphics.RectangleShape),
        color = DeepMidnight.copy(alpha = 0.95f),
        tonalElevation = 6.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left: Logo & Branding
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(StudioCardBg)
                            .border(1.dp, NeonViolet, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.MusicNote,
                            contentDescription = "Elder Mi Logo",
                            tint = CyanBlue,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(10.dp))

                    Column {
                        GradientText(
                            text = "Elder Mi Music AI Studio",
                            brush = BrandGradient,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Text(
                            text = "“Your Sound. Your Culture. Your Studio.”",
                            color = MutedText,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Right: Session Save Status & Action
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (currentProject.hasUnsavedChanges) {
                        Button(
                            onClick = { viewModel.saveCurrentProject() },
                            colors = ButtonDefaults.buttonColors(containerColor = WarmOrange, contentColor = DeepMidnight),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(13.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Save", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(DarkIndigo)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(SubtleLime)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Saved",
                                color = SubtleLime,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Studio Navigation Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                StudioNavChip(
                    label = "Dashboard",
                    isSelected = currentDest == StudioDestination.DASHBOARD,
                    activeColor = SoftWhite,
                    onClick = { viewModel.navigateTo(StudioDestination.DASHBOARD) },
                    modifier = Modifier.weight(1f)
                )

                StudioNavChip(
                    label = "Sam Vocal",
                    isSelected = currentDest == StudioDestination.VOCAL_STUDIO,
                    activeColor = NeonViolet,
                    onClick = { viewModel.navigateTo(StudioDestination.VOCAL_STUDIO) },
                    modifier = Modifier.weight(1f)
                )

                StudioNavChip(
                    label = "Sam Mix",
                    isSelected = currentDest == StudioDestination.MIX_STUDIO,
                    activeColor = CyanBlue,
                    onClick = { viewModel.navigateTo(StudioDestination.MIX_STUDIO) },
                    modifier = Modifier.weight(1f)
                )

                StudioNavChip(
                    label = "Sam Master",
                    isSelected = currentDest == StudioDestination.MASTERING_STUDIO,
                    activeColor = GoldenYellow,
                    onClick = { viewModel.navigateTo(StudioDestination.MASTERING_STUDIO) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun StudioNavChip(
    label: String,
    isSelected: Boolean,
    activeColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(30.dp),
        shape = RoundedCornerShape(6.dp),
        color = if (isSelected) activeColor.copy(alpha = 0.25f) else DarkIndigo,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) activeColor else Color.Transparent)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                color = if (isSelected) activeColor else MutedText,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1
            )
        }
    }
}
