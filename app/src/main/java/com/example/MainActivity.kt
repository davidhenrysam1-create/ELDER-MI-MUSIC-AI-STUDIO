package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
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
import com.example.ui.components.GlobalAudioPlayerBar
import com.example.ui.navigation.StudioTopBar
import com.example.ui.screens.*
import com.example.viewmodel.ElderMiViewModel
import com.example.viewmodel.StudioDestination

class MainActivity : ComponentActivity() {

    private val viewModel: ElderMiViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ElderMiMusicTheme {
                MainAppScreen(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun MainAppScreen(viewModel: ElderMiViewModel) {
    val currentDestination by viewModel.currentDestination.collectAsState()
    val playbackState by viewModel.playbackState.collectAsState()
    val currentProject by viewModel.currentProject.collectAsState()
    val notification by viewModel.notification.collectAsState()
    val showNewProjectDialog by viewModel.showNewProjectDialog.collectAsState()

    var newProjectName by remember { mutableStateOf("") }
    var newProjectGenre by remember { mutableStateOf("Afrobeats") }
    var newProjectBpm by remember { mutableIntStateOf(106) }

    // Intercept back navigation to return to Dashboard if on a sub-screen
    BackHandler(enabled = currentDestination != StudioDestination.DASHBOARD) {
        viewModel.navigateTo(StudioDestination.DASHBOARD)
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = DeepMidnight,
        topBar = {
            StudioTopBar(viewModel = viewModel)
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
            ) {
                // Persistent Global Audio Player Bar
                GlobalAudioPlayerBar(
                    playbackState = playbackState,
                    projectName = currentProject.name,
                    onTogglePlay = { viewModel.audioEngine.togglePlayPause() },
                    onSeek = { viewModel.audioEngine.seekTo(it) },
                    onVolumeChange = { viewModel.audioEngine.setMasterVolume(it) },
                    onToggleLoop = { viewModel.audioEngine.toggleLoop() }
                )

                // Bottom Navigation Bar
                NavigationBar(
                    containerColor = DeepMidnight,
                    contentColor = SoftWhite,
                    tonalElevation = 8.dp,
                    modifier = Modifier.height(60.dp)
                ) {
                    NavigationBarItem(
                        selected = currentDestination == StudioDestination.DASHBOARD,
                        onClick = { viewModel.navigateTo(StudioDestination.DASHBOARD) },
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                        label = { Text("Dashboard", fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SoftWhite,
                            selectedTextColor = SoftWhite,
                            indicatorColor = DarkIndigo
                        )
                    )

                    NavigationBarItem(
                        selected = currentDestination == StudioDestination.VOCAL_STUDIO,
                        onClick = { viewModel.navigateTo(StudioDestination.VOCAL_STUDIO) },
                        icon = { Icon(Icons.Default.Mic, contentDescription = "Sam Vocal Studio") },
                        label = { Text("Vocal", fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = NeonViolet,
                            selectedTextColor = NeonViolet,
                            indicatorColor = NeonViolet.copy(alpha = 0.2f)
                        )
                    )

                    NavigationBarItem(
                        selected = currentDestination == StudioDestination.MIX_STUDIO,
                        onClick = { viewModel.navigateTo(StudioDestination.MIX_STUDIO) },
                        icon = { Icon(Icons.Default.Tune, contentDescription = "Sam Mix Studio") },
                        label = { Text("Mix", fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = CyanBlue,
                            selectedTextColor = CyanBlue,
                            indicatorColor = CyanBlue.copy(alpha = 0.2f)
                        )
                    )

                    NavigationBarItem(
                        selected = currentDestination == StudioDestination.MASTERING_STUDIO,
                        onClick = { viewModel.navigateTo(StudioDestination.MASTERING_STUDIO) },
                        icon = { Icon(Icons.Default.Equalizer, contentDescription = "Sam Mastering Studio") },
                        label = { Text("Master", fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = GoldenYellow,
                            selectedTextColor = GoldenYellow,
                            indicatorColor = WarmOrange.copy(alpha = 0.2f)
                        )
                    )

                    NavigationBarItem(
                        selected = currentDestination == StudioDestination.SETTINGS,
                        onClick = { viewModel.navigateTo(StudioDestination.SETTINGS) },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                        label = { Text("Settings", fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SoftWhite,
                            selectedTextColor = SoftWhite,
                            indicatorColor = DarkIndigo
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Main workspace view switcher
            when (currentDestination) {
                StudioDestination.DASHBOARD -> DashboardScreen(viewModel = viewModel)
                StudioDestination.VOCAL_STUDIO -> SamVocalStudioScreen(viewModel = viewModel)
                StudioDestination.MIX_STUDIO -> SamMixStudioScreen(viewModel = viewModel)
                StudioDestination.MASTERING_STUDIO -> SamMasteringStudioScreen(viewModel = viewModel)
                StudioDestination.PROJECTS -> ProjectsScreen(viewModel = viewModel)
                StudioDestination.VOICE_PROFILES -> VoiceProfilesScreen(viewModel = viewModel)
                StudioDestination.EXPORTS -> ExportHistoryScreen(viewModel = viewModel)
                StudioDestination.SETTINGS -> SettingsScreen(viewModel = viewModel)
            }

            // Floating Toast Notification
            AnimatedVisibility(
                visible = notification != null,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 12.dp)
            ) {
                notification?.let { notif ->
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = if (notif.isError) HotPink else Color(0xEE1E1742),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (notif.isError) HotPink else CyanBlue),
                        shadowElevation = 8.dp,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (notif.isError) Icons.Default.Warning else Icons.Default.Info,
                                contentDescription = null,
                                tint = SoftWhite,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(notif.message, color = SoftWhite, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }

    // New Project Dialog Modal
    if (showNewProjectDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.setShowNewProjectDialog(false) },
            title = {
                Text("Create New Afrobeats Session", color = SoftWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Enter project details to initialize stems and timeline:", color = MutedText, fontSize = 12.sp)

                    OutlinedTextField(
                        value = newProjectName,
                        onValueChange = { newProjectName = it },
                        label = { Text("Project Title") },
                        placeholder = { Text("e.g. Lagos Groove Vol 1") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonViolet)
                    )

                    OutlinedTextField(
                        value = newProjectGenre,
                        onValueChange = { newProjectGenre = it },
                        label = { Text("Sub-Genre (Afrobeats, Amapiano, Afro-Fusion)") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = CyanBlue)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Tempo: $newProjectBpm BPM", color = GoldenYellow, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                        Slider(
                            value = newProjectBpm.toFloat(),
                            onValueChange = { newProjectBpm = it.toInt() },
                            valueRange = 80f..140f,
                            modifier = Modifier.width(140.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val title = newProjectName.ifBlank { "Untitled Afrobeats" }
                        viewModel.createProject(title, newProjectGenre, newProjectBpm)
                        newProjectName = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NeonViolet)
                ) {
                    Text("Create Session")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setShowNewProjectDialog(false) }) {
                    Text("Cancel", color = MutedText)
                }
            },
            containerColor = Color(0xFF1B1638)
        )
    }
}
