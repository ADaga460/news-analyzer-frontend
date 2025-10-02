import React, { useState } from "react";
// Import from gesture-handler is fine for the components it needs
import { TextInput, Text, TouchableOpacity, ScrollView } from "react-native-gesture-handler"; 
import { withTiming, useSharedValue, useAnimatedStyle } from "react-native-reanimated";
// Combined imports from react-native
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

  async function pollJob(jobId: string, timeoutMs = 120000, intervalMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`${BACKEND}/api/job/${jobId}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Job poll failed: ${res.status} ${text}`);
      }
      const j = await res.json();
      if (j.status === "done") return j.result;
      if (j.status === "failed") throw new Error(j.result || "Job failed");
      // still processing
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Job timed out");
  }

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    translateY.value = withTiming(-150, { duration: 800 });

    try {
      // Step 1: request extraction
      const res1 = await fetch(`${BACKEND}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j1 = await res1.json();
      if (!j1.job_id) {
        setResult(j1.error || "Failed to start extraction");
        setLoading(false);
        return;
      }
      // poll extraction job
      const articleText = await pollJob(j1.job_id, 180000, 1500); // 3 min timeout
      // Step 2: submit text for analysis (background job)
      const res2 = await fetch(`${BACKEND}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: articleText }),
      });
      const j2 = await res2.json();
      if (!j2.job_id) {
        setResult(j2.error || "Failed to start analysis");
        setLoading(false);
        return;
      }
      // poll analysis job
      const analysis = await pollJob(j2.job_id, 240000, 1500); // 4 min timeout
      setResult(analysis);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Error analyzing article";
      setResult(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const animatedBoxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white items-center justify-center"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View style={[animatedBoxStyle, { width: "90%" }]}>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="Paste article URL..."
          className="border border-gray-400 rounded-xl px-4 py-3 mb-4"
        />
        <TouchableOpacity
          onPress={handleAnalyze}
          className="bg-blue-600 rounded-xl py-3"
        >
          <Text className="text-white text-center font-semibold">Send for Analysis</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView className="mt-6 w-11/12">
        {loading && <ActivityIndicator size="large" color="blue" />}
        {result && (
          <Text className="text-gray-800 text-base leading-6">{result}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}