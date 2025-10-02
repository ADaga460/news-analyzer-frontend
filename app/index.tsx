import React, { useState } from "react";
// Removed ScrollView from here as it's from 'react-native'
import { TextInput, Text, TouchableOpacity, ScrollView } from "react-native-gesture-handler"; 
import { withTiming, useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { 
  Animated, 
  ActivityIndicator, 
  Platform, 
  KeyboardAvoidingView, 
  View
} from "react-native"; 


export default function HomeScreen() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Animation state
  const translateY = useSharedValue(0);

  // inside your HomeScreen component
  const BACKEND = "https://news-analyzer-backend-23es.onrender.com";
  
  // LOG ADDITION: Added logs to track polling state
  async function pollJob(jobId: string, timeoutMs = 120000, intervalMs = 1500) {
    console.log(`[Frontend Poll] Starting poll for job ID: ${jobId}`);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${BACKEND}/api/job/${jobId}`);
      if (!res.ok) {
        const text = await res.text();
        console.error(`[Frontend Poll] HTTP Error for job ${jobId}: ${res.status} ${text}`);
        throw new Error(`Job poll failed: ${res.status} ${text}`);
      }
      const j = await res.json();
      console.log(`[Frontend Poll] Job ${jobId} Status: ${j.status}. Time elapsed: ${(Date.now() - start) / 1000}s`);

      if (j.status === "done") return j.result;
      if (j.status === "failed") throw new Error(j.result || "Job failed");
      
      // Still processing
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    console.error(`[Frontend Poll] Job ${jobId} TIMED OUT after ${timeoutMs / 1000}s`);
    throw new Error("Job timed out");
  }

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    translateY.value = withTiming(-150, { duration: 800 });
    console.log(`[Frontend] Starting analysis for URL: ${url}`);

    try {
      // Step 1: request extraction
      console.log("[Frontend] Step 1: Requesting extraction...");
      const res1 = await fetch(`${BACKEND}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      
      if (!res1.ok) {
         throw new Error(`Extraction start failed: ${res1.statusText}`);
      }
      
      const j1 = await res1.json();
      if (!j1.job_id) {
        const errorMsg = j1.error || "Failed to start extraction (no job_id)";
        console.error(`[Frontend] Extraction start failed: ${errorMsg}`);
        setResult(errorMsg);
        setLoading(false);
        return;
      }
      console.log(`[Frontend] Extraction Job ID: ${j1.job_id}`);

      // poll extraction job
      const articleText = await pollJob(j1.job_id, 180000, 1500); // 3 min timeout
      console.log(`[Frontend] Extraction complete. Article text length: ${articleText.length}`);

      // Step 2: submit text for analysis (background job)
      console.log("[Frontend] Step 2: Submitting text for analysis...");
      const res2 = await fetch(`${BACKEND}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: articleText }),
      });

      if (!res2.ok) {
         throw new Error(`Analysis start failed: ${res2.statusText}`);
      }

      const j2 = await res2.json();
      if (!j2.job_id) {
        const errorMsg = j2.error || "Failed to start analysis (no job_id)";
        console.error(`[Frontend] Analysis start failed: ${errorMsg}`);
        setResult(errorMsg);
        setLoading(false);
        return;
      }
      console.log(`[Frontend] Analysis Job ID: ${j2.job_id}`);
      
      // poll analysis job
      const analysis = await pollJob(j2.job_id, 240000, 1500); // 4 min timeout
      console.log("[Frontend] Analysis complete. Setting result.");
      setResult(analysis);

    } catch (err) {
      console.error("[Frontend] Error in analysis process:", err);
      const errorMessage = err instanceof Error ? err.message : "Error analyzing article";
      setResult(errorMessage);
    } finally {
      console.log("[Frontend] Analysis process finished. Setting loading=false.");
      setLoading(false);
    }
  };

  const animatedBoxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[animatedBoxStyle, { width: "90%" }]}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Paste article URL..."
            style={{ borderWidth: 1, borderColor: "gray", borderRadius: 10, padding: 12, marginBottom: 16 }}
          />
          <TouchableOpacity
            onPress={handleAnalyze}
            style={{ backgroundColor: "blue", borderRadius: 10, paddingVertical: 12 }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "600" }}>
              Send for Analysis
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView style={{ marginTop: 24, width: "90%" }}>
          {loading && <ActivityIndicator size="large" color="blue" />}
          {result && (
            <Text style={{ color: "black", fontSize: 16, lineHeight: 22 }}>
              {result}
            </Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>

  );
}