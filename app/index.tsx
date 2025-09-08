import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";


export default function HomeScreen() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Animation state
  const translateY = useSharedValue(0);

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);

    // animate textbox upwards
    translateY.value = withTiming(-150, { duration: 800 });

    try {
      const res = await fetch(`https://news-analyzer-backend-23es.onrender.com/api/analyze`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url }),
                        })
      const data = await res.json();
      setResult(data.result || data.error || "No result");
    } catch (err) {
      setResult("Error connecting to backend");
      console.log(err);
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
