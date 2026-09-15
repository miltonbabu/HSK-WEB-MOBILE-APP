import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookOpen, Sparkles } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { generateResponse } from "@/services/ai-chat";
import type { HSKLevel } from "@/types";

export default function StoryScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [level, setLevel] = useState<HSKLevel>(3);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");

  const generate = useCallback(async () => {
    try {
      setLoading(true);
      setStory("");
      const prompt = topic
        ? `Write a short story in Chinese about ${topic}. Use HSK ${level} vocabulary. Include pinyin and English translation for each sentence. Keep it 5-8 sentences.`
        : `Write a short story in Chinese using HSK ${level} vocabulary. Include pinyin and English translation for each sentence. Keep it 5-8 sentences. Make it engaging.`;
      let content = "";
      await generateResponse(
        ds,
        [{ role: "user", content: prompt }],
        (chunk) => { content = chunk; setStory(chunk); },
        { hskLevel: level, dailyGoal: 20, learningReason: "hsk_exam", onboardingCompleted: true, userName: user?.username },
      );
      setStory(content || "Failed to generate story. Please try again.");
    } catch (e) {
      setStory("Failed to generate story. Please try again.");
      console.error("Story generation failed:", e);
    } finally {
      setLoading(false);
    }
  }, [ds, level, topic, user]);

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
        <View className="items-center mb-6 mt-4">
          <View className="w-14 h-14 rounded-2xl bg-brand-500 items-center justify-center mb-3">
            <BookOpen size={28} color="white" />
          </View>
          <Text className="text-2xl font-bold text-ink-900 dark:text-white">AI Story</Text>
          <Text className="text-sm text-ink-500 dark:text-ink-400 mt-1">Read stories made from your HSK vocabulary</Text>
        </View>

        <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4">
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">HSK Level</Text>
          <View className="flex-row gap-2">
            {([1, 2, 3, 4] as HSKLevel[]).map((l) => (
              <Pressable key={l} onPress={() => setLevel(l)}
                className={`px-4 py-2 rounded-xl ${level === l ? "bg-brand-500" : "bg-ink-100 dark:bg-ink-800"}`}>
                <Text className={`text-sm font-semibold ${level === l ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>HSK {l}</Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mt-4 mb-2">Topic (optional)</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. travel, friendship, food..."
            className="bg-ink-100 dark:bg-ink-800 rounded-xl px-4 py-3 text-ink-900 dark:text-white"
          />
        </View>

        <Pressable onPress={generate} disabled={loading}
          className="bg-brand-500 rounded-2xl py-4 items-center flex-row justify-center gap-2">
          {loading ? <ActivityIndicator color="white" /> : <Sparkles size={20} color="white" />}
          <Text className="text-white text-lg font-bold">{loading ? "Generating..." : "Generate Story"}</Text>
        </Pressable>

        {story ? (
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mt-4">
            <Text className="text-base text-ink-900 dark:text-white leading-6">{story}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}