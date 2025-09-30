import { useState } from "react";
import { _ScrollView } from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";


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

}
