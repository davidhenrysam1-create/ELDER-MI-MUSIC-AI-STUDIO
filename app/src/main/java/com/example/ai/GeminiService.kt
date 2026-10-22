package com.example.ai

import com.example.BuildConfig
import com.example.model.GenrePreset
import com.example.model.MixRecommendation
import com.example.model.StemType
import com.example.model.VocalArrangementRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GeminiService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun improvePrompt(
        originalPrompt: String,
        workspaceName: String,
        genreContext: String = "Afrobeats"
    ): Result<String> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isNullOrBlank()) {
            return@withContext Result.success(getFallbackImprovedPrompt(originalPrompt, workspaceName, genreContext))
        }

        val systemInstruction = """
            You are Elder Mi, an expert Grammy-award winning Afrobeats music producer, vocal arranger, and audio mix engineer.
            Your task is to take an initial user prompt for '$workspaceName' and rewrite it into a highly detailed, professional music production instruction.
            Include specific African musical characteristics (e.g. syncopation, call-and-response, log drum pocket, high-end shaker air, vocal presence, warm saturation).
            Return ONLY the improved prompt text, with no introductory banter or quotes.
        """.trimIndent()

        val promptText = "Improve this $workspaceName instruction for an $genreContext project: '$originalPrompt'"

        try {
            val responseText = callGeminiApi(apiKey, systemInstruction, promptText)
            if (responseText.isNotBlank()) {
                Result.success(responseText.trim().removeSurrounding("\""))
            } else {
                Result.success(getFallbackImprovedPrompt(originalPrompt, workspaceName, genreContext))
            }
        } catch (_: Exception) {
            Result.success(getFallbackImprovedPrompt(originalPrompt, workspaceName, genreContext))
        }
    }

    suspend fun generateMixRecommendations(
        userPrompt: String,
        preset: GenrePreset
    ): Result<List<MixRecommendation>> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isNullOrBlank()) {
            return@withContext Result.success(getFallbackRecommendations(preset))
        }

        val systemPrompt = """
            You are a master Afrobeats mixing engineer. Analyze the project mix prompt: '$userPrompt' for genre '${preset.label}'.
            Provide 4 specific mixing actions formatted in JSON array.
            Format:
            [
              {
                "stage": "Vocal Pocket & Clarity",
                "stem": "LEAD_VOCAL",
                "summary": "High-pass 120Hz & add +2.5dB air at 12kHz",
                "detail": "Carve mud between 250-400Hz and apply 3:1 optical compression to sit above the beat."
              }
            ]
            Valid stems: LEAD_VOCAL, CHORUS, DRUMS, BASS, PERCUSSION, INSTRUMENTAL.
            Return ONLY valid JSON array.
        """.trimIndent()

        try {
            val response = callGeminiApi(apiKey, "You are a JSON-only audio engineer.", systemPrompt)
            val jsonArray = JSONArray(response.substringAfter("[").substringBeforeLast("]") .let { "[$it]" })
            val list = mutableListOf<MixRecommendation>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val stemStr = obj.optString("stem", "LEAD_VOCAL")
                val stem = try { StemType.valueOf(stemStr) } catch (_: Exception) { StemType.LEAD_VOCAL }
                list.add(
                    MixRecommendation(
                        id = "rec_${System.currentTimeMillis()}_$i",
                        stageName = obj.optString("stage", "EQ Polish"),
                        targetStem = stem,
                        summary = obj.optString("summary", "Dynamic balancing"),
                        actionDetail = obj.optString("detail", "Adjust frequency balance"),
                        isApplied = false
                    )
                )
            }
            if (list.isNotEmpty()) Result.success(list) else Result.success(getFallbackRecommendations(preset))
        } catch (_: Exception) {
            Result.success(getFallbackRecommendations(preset))
        }
    }

    private fun callGeminiApi(apiKey: String, systemInstruction: String, userText: String): String {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=$apiKey"

        val jsonBody = JSONObject().apply {
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply { put("text", systemInstruction) })
                })
            })
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", userText) })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.7)
                put("topP", 0.95)
            })
        }

        val request = Request.Builder()
            .url(url)
            .post(jsonBody.toString().toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                return ""
            }
            val responseBody = response.body?.string() ?: return ""
            val json = JSONObject(responseBody)
            val candidates = json.optJSONArray("candidates") ?: return ""
            if (candidates.length() == 0) return ""
            val first = candidates.getJSONObject(0)
            val content = first.optJSONObject("content") ?: return ""
            val parts = content.optJSONArray("parts") ?: return ""
            if (parts.length() == 0) return ""
            return parts.getJSONObject(0).optString("text", "")
        }
    }

    private fun getFallbackImprovedPrompt(original: String, studio: String, genre: String): String {
        return when (studio) {
            "Sam Vocal Studio" ->
                "Produce an energetic, multi-layered $genre vocal arrangement. Create 3 distinct vocal tiers: a crisp lead presence with subtle tape warmth, an uplifting 3-part harmonic chorus (3rds and 5ths) sitting in the stereo field, and dynamic Zulu/Afro call-and-response vocal stabs that punctuate the rhythmic downbeats while maintaining pristine lead clarity."
            "Sam Mix Studio" ->
                "Apply an authentic $genre balance: Carve the low frequencies to give the Amapiano log drum and kick punch separation at 60Hz vs 110Hz. Keep the polyrhythmic shakers and shekere wide in the stereo image with silky top-end air at 10kHz. Settle backing vocals 3dB below the lead with a warm plate reverb."
            "Sam Mastering Studio" ->
                "Master for international commercial release adhering to modern $genre standards (-14 LUFS integrated, -1.0 dB true peak ceiling). Preserve punchy percussive transients on the snare and log drums, inject subtle analog tape saturation across 150-300Hz, and widen the high-frequency air without phase cancellation."
            else -> original
        }
    }

    private fun getFallbackRecommendations(preset: GenrePreset): List<MixRecommendation> {
        return listOf(
            MixRecommendation(
                id = "rec_1",
                stageName = "Low-End Pocket & Separation",
                targetStem = StemType.BASS,
                summary = "Sidechain log drum and carve 65Hz pocket for the main kick",
                actionDetail = "Dip -2.2dB at 62Hz on Bass stem; add fast 35ms release compressor to let kick punch cleanly through.",
                isApplied = false
            ),
            MixRecommendation(
                id = "rec_2",
                stageName = "Vocal Lead Clarity & Air",
                targetStem = StemType.LEAD_VOCAL,
                summary = "High-pass filter at 110Hz and apply high-shelf air boost at 12kHz",
                actionDetail = "Clear sub rumble; boost +2.0dB at 12kHz for radio presence; apply gentle optical leveling.",
                isApplied = false
            ),
            MixRecommendation(
                id = "rec_3",
                stageName = "Polyrhythmic Percussion Stereo Spread",
                targetStem = StemType.PERCUSSION,
                summary = "Expand shakers and congas to 125% stereo width with high-pass at 350Hz",
                actionDetail = "Cleans muddy mid frequencies and creates an expansive African rhythmic landscape.",
                isApplied = false
            ),
            MixRecommendation(
                id = "rec_4",
                stageName = "Backing Choir & Harmony Depth",
                targetStem = StemType.CHOIR,
                summary = "Send 35% to warm Afro plate reverb and duck 2dB when lead vocal sings",
                actionDetail = "Envelopes backing choir naturally behind the lead vocal without cluttering the center channel.",
                isApplied = false
            )
        )
    }
}
