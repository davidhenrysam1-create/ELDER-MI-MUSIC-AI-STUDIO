package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.theme.*

@Composable
fun PromptEditorCard(
    title: String,
    prompt: String,
    onPromptChange: (String) -> Unit,
    onImprovePrompt: () -> Unit,
    isImproving: Boolean,
    primaryActionLabel: String,
    onPrimaryAction: () -> Unit,
    modifier: Modifier = Modifier,
    accentBrush: Brush = BrandGradient,
    accentColor: Color = NeonViolet,
    helperText: String? = null
) {
    GlassCard(
        modifier = modifier.fillMaxWidth(),
        borderBrush = accentBrush,
        backgroundColor = Color(0xEE161230)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(accentColor.copy(alpha = 0.2f))
                            .border(1.dp, accentColor, RoundedCornerShape(6.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = "AI Assistant",
                            tint = accentColor,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = title,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = SoftWhite
                    )
                }

                // Improve My Prompt Action Button
                Button(
                    onClick = onImprovePrompt,
                    enabled = !isImproving && prompt.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF2B1F54),
                        contentColor = CyanBlue
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    if (isImproving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = CyanBlue,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Improving...", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    } else {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = GoldenYellow
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "Improve My Prompt",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SoftWhite
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Text input area
            OutlinedTextField(
                value = prompt,
                onValueChange = onPromptChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 80.dp),
                placeholder = {
                    Text(
                        "Describe your desired Afrobeats vocal arrangement, mix balance, or master target...",
                        color = MutedText,
                        fontSize = 12.sp
                    )
                },
                textStyle = LocalTextStyle.current.copy(
                    color = SoftWhite,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = accentColor,
                    unfocusedBorderColor = DarkMuted.copy(alpha = 0.5f),
                    focusedContainerColor = DarkIndigo.copy(alpha = 0.6f),
                    unfocusedContainerColor = DarkIndigo.copy(alpha = 0.6f)
                ),
                shape = RoundedCornerShape(10.dp)
            )

            if (helperText != null) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = helperText,
                    color = MutedText,
                    fontSize = 11.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Primary Action Button
            Button(
                onClick = onPrimaryAction,
                colors = ButtonDefaults.buttonColors(
                    containerColor = accentColor,
                    contentColor = SoftWhite
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(42.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = primaryActionLabel,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
