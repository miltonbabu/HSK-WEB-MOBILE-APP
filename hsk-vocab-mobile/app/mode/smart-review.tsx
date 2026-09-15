import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brain, CheckCircle, XCircle, RotateCcw } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { gradeSRS } from "@/utils/srs";
import type { Word, HSKLevel } from "@/types";

export default function SmartReviewScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [reviewWords, setReviewWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);

  const userId = user?.id || "guest";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const due = await ds.progress.getDueWords(userId, 15);
      let pool = due;
      if (pool.length < 5) {
        for (const lvl of [1, 2, 3, 4] as HSKLevel[]) {
          const words = await ds.vocab.getWordsByLevel(lvl);
          pool = [...pool, ...words.sort(() => Math.random() - 0.5).slice(0, 5)];
        }
      }
      setReviewWords(pool.sort(() => Math.random() - 0.5).slice(0, 15));
    } catch (e) {
      console.error("Smart review load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, ds]);

  useEffect(() => { load(); }, [load]);

  const grade = async (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    const word = reviewWords[current];
    if (!word) return;
    try {
      const existing = await ds.progress.getForUser(userId, word.id);
      const srsParams = existing
        ? { easinessFactor: existing.easiness_factor, interval: existing.interval, reviewCount: existing.review_count }
        : { easinessFactor: 2.5, interval: 0, reviewCount: 0 };
      const updated = gradeSRS(srsParams, existing?.correct_count ?? 0, quality);
      await ds.progress.upsert({
        user_id: userId, word_id: word.id, mastery_level: updated.mastery_level,
        last_reviewed: updated.last_reviewed, next_review: updated.next_review,
        review_count: updated.review_count, correct_count: updated.correct_count,
        easiness_factor: updated.easiness_factor, interval: updated.interval,
      });
    } catch (e) { console.error("Progress update failed:", e); }

    const isCorrect = quality >= 3;
    setResults((r) => ({ correct: r.correct + (isCorrect ? 1 : 0), total: r.total + 1 }));
    setShowAnswer(false);
    if (current + 1 >= reviewWords.length) setDone(true);
    else setCurrent((p) => p + 1);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="mt-3 text-sm text-ink-500">Finding your weak words...</Text>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <CheckCircle size={64} color="#10b981" />
        <Text className="text-2xl font-bold text-ink-900 dark:text-white mt-4">Review Complete!</Text>
        <Text className="text-lg text-ink-500 dark:text-ink-400 mt-2">
          {results.correct} / {results.total} correct
        </Text>
        <Pressable onPress={() => { setDone(false); setCurrent(0); setResults({ correct: 0, total: 0 }); load(); }}
          className="bg-brand-500 rounded-xl px-6 py-3 mt-6">
          <Text className="text-white font-semibold">Review Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const word = reviewWords[current];
  if (!word) return null;

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Brain size={20} color="#8b5cf6" />
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300">Smart Review</Text>
          </View>
          <Text className="text-sm text-ink-500">{current + 1} / {reviewWords.length}</Text>
        </View>
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-8 items-center mb-6">
          <Text className="text-5xl font-bold text-ink-900 dark:text-white mb-3">{word.chinese}</Text>
          {showAnswer ? (
            <View className="items-center">
              <Text className="text-xl text-brand-500 mb-1">{word.pinyin}</Text>
              <Text className="text-base text-ink-600 dark:text-ink-400">{word.english}</Text>
              <Text className="text-xs text-ink-400 mt-2">HSK {word.hsk_level}</Text>
            </View>
          ) : (
            <Text className="text-sm text-ink-400">Tap to reveal</Text>
          )}
        </View>
        {!showAnswer ? (
          <Pressable onPress={() => setShowAnswer(true)} className="bg-brand-500 rounded-xl py-4 items-center">
            <Text className="text-white text-lg font-bold">Show Answer</Text>
          </Pressable>
        ) : (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <Pressable onPress={() => grade(1)} className="flex-1 bg-red-500 rounded-xl py-4 items-center">
                <Text className="text-white font-semibold">Again</Text>
              </Pressable>
              <Pressable onPress={() => grade(3)} className="flex-1 bg-green-500 rounded-xl py-4 items-center">
                <Text className="text-white font-semibold">Good</Text>
              </Pressable>
              <Pressable onPress={() => grade(5)} className="flex-1 bg-brand-500 rounded-xl py-4 items-center">
                <Text className="text-white font-semibold">Easy</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}