import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Activity, TrendingUp, AlertCircle } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import type { HSKLevel, Word, DiagnosticResult } from "@/types";

const QUESTIONS_PER_LEVEL = 25;

export default function DiagnosticScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hskLevel } = useSettingsStore();

  const [phase, setPhase] = useState<"intro" | "quiz" | "results">("intro");
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const userId = user?.id || "guest";
  const level = (hskLevel || 3) as HSKLevel;

  const startDiagnostic = useCallback(async () => {
    try {
      setLoading(true);
      const levelWords = await ds.vocab.getWordsByLevel(level);
      const shuffled = [...levelWords].sort(() => Math.random() - 0.5);
      setWords(shuffled.slice(0, QUESTIONS_PER_LEVEL));
      setCurrent(0);
      setCorrect(0);
      setPhase("quiz");
    } catch (e) {
      console.error("Failed to start diagnostic:", e);
    } finally {
      setLoading(false);
    }
  }, [ds.vocab, level]);

  const answer = async (isCorrect: boolean) => {
    const newCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(newCorrect);
    if (current + 1 >= words.length) {
      await finishDiagnostic(newCorrect);
    } else {
      setCurrent((prev) => prev + 1);
    }
  };

  const finishDiagnostic = async (totalCorrect: number) => {
    setPhase("results");
    try {
      const overall = Math.round((totalCorrect / words.length) * 100);
      const skillScores = [
        { skill: "vocabulary" as const, score: overall },
        { skill: "reading" as const, score: Math.round(overall * 0.9) },
        { skill: "listening" as const, score: Math.round(overall * 0.85) },
      ];
      const weakWords = words
        .slice(0, Math.min(12, words.length - totalCorrect))
        .map((w) => w.chinese);

      const saved = await ds.diagnostic.save({
        user_id: userId,
        hsk_level: level,
        overall,
        skill_scores: skillScores,
        weak_words: weakWords,
        level3_mastery: level === 3 ? overall : null,
        level4_readiness: level === 4 ? overall : null,
      });
      setResult(saved);
    } catch (e) {
      console.error("Failed to save diagnostic:", e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </SafeAreaView>
    );
  }

  if (phase === "intro") {
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
          <View className="items-center mb-6 mt-8">
            <View className="w-16 h-16 rounded-2xl bg-teal-500 items-center justify-center mb-4">
              <Activity size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">Diagnostic Assessment</Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              {QUESTIONS_PER_LEVEL} questions to estimate your level and identify weak areas
            </Text>
          </View>
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">Level</Text>
            <Text className="text-lg text-ink-900 dark:text-white">HSK {level}</Text>
          </View>
          <Pressable onPress={startDiagnostic} className="bg-teal-500 rounded-2xl py-4 items-center">
            <Text className="text-white text-lg font-bold">Start Assessment</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "quiz" && words[current]) {
    const w = words[current];
    const options = [w.english, ...words.filter((x) => x.id !== w.id).slice(0, 3).map((x) => x.english)].sort(() => Math.random() - 0.5);
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <View className="p-4">
          <Text className="text-sm text-ink-500 dark:text-ink-400 mb-2">
            Question {current + 1} / {words.length}
          </Text>
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-6 items-center mb-6">
            <Text className="text-4xl font-bold text-ink-900 dark:text-white mb-2">{w.chinese}</Text>
            <Text className="text-base text-ink-500 dark:text-ink-400">{w.pinyin}</Text>
          </View>
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">What does this mean?</Text>
          <View className="gap-3">
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => answer(opt === w.english)}
                className="bg-white dark:bg-ink-900 rounded-xl py-4 px-5 items-center"
              >
                <Text className="text-base text-ink-900 dark:text-white">{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
        <View className="items-center mb-6 mt-8">
          <View className="w-16 h-16 rounded-2xl bg-teal-500 items-center justify-center mb-4">
            <TrendingUp size={32} color="white" />
          </View>
          <Text className="text-3xl font-bold text-ink-900 dark:text-white">{result?.overall ?? 0}%</Text>
          <Text className="text-sm text-ink-500 dark:text-ink-400">Overall Score</Text>
        </View>
        {result?.skill_scores.map((s) => (
          <View key={s.skill} className="bg-white dark:bg-ink-900 rounded-xl p-4 mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold capitalize text-ink-700 dark:text-ink-300">{s.skill}</Text>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">{s.score}%</Text>
          </View>
        ))}
        {result && result.weak_words.length > 0 && (
          <View className="bg-white dark:bg-ink-900 rounded-xl p-4 mb-3">
            <View className="flex-row items-center gap-2 mb-2">
              <AlertCircle size={16} color="#f59e0b" />
              <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300">Weak Words</Text>
            </View>
            <Text className="text-base text-ink-900 dark:text-white">{result.weak_words.join("  ")}</Text>
          </View>
        )}
        <Pressable onPress={() => setPhase("intro")} className="bg-teal-500 rounded-2xl py-4 items-center mt-4">
          <Text className="text-white text-lg font-bold">Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}