import { useState, useCallback, useRef } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PenLine, CheckCircle, XCircle } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import type { Word, HSKLevel } from "@/types";

type Direction = "pinyin" | "en" | "zh";
type Phase = "setup" | "quiz" | "results";

export default function WritingScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [level, setLevel] = useState<HSKLevel>(3);
  const [direction, setDirection] = useState<Direction>("pinyin");
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const sessionStart = useRef(Date.now());
  const sessionId = useRef("");

  const userId = user?.id || "guest";

  const start = useCallback(async () => {
    try {
      setLoading(true);
      const levelWords = await ds.vocab.getWordsByLevel(level);
      const shuffled = [...levelWords].sort(() => Math.random() - 0.5).slice(0, count);
      setWords(shuffled);
      setCurrent(0);
      setInput("");
      setResults({ correct: 0, total: 0 });
      sessionStart.current = Date.now();
      sessionId.current = `ws_${Date.now()}`;
      setPhase("quiz");
    } catch (e) {
      console.error("Writing start failed:", e);
    } finally {
      setLoading(false);
    }
  }, [ds.vocab, level, count]);

  const submit = async () => {
    const word = words[current];
    if (!word) return;
    const expected = direction === "pinyin" ? word.chinese : direction === "en" ? word.chinese : word.pinyin;
    const isCorrect = input.trim() === expected;
    const newResults = { correct: results.correct + (isCorrect ? 1 : 0), total: results.total + 1 };
    setResults(newResults);

    try {
      await ds.writing.saveAttempt({
        id: `wa_${Date.now()}`,
        session_id: sessionId.current,
        user_id: userId,
        word_id: word.id,
        question_type: direction,
        expected_answer: expected,
        user_answer: input.trim(),
        is_correct: isCorrect,
        accuracy: isCorrect ? 100 : 0,
        time_taken: 0,
        created_at: new Date().toISOString(),
      });
    } catch (e) { console.error("Writing attempt save failed:", e); }

    setInput("");
    if (current + 1 >= words.length) {
      try {
        await ds.writing.saveSession({
          id: sessionId.current,
          user_id: userId,
          hsk_level: level,
          scope: "level",
          practice_mode: direction,
          order_type: "random",
          question_count: words.length,
          correct_count: newResults.correct,
          accuracy: Math.round((newResults.correct / words.length) * 100),
          started_at: new Date(sessionStart.current).toISOString(),
          completed_at: new Date().toISOString(),
        });
      } catch (e) { console.error("Writing session save failed:", e); }
      setPhase("results");
    } else {
      setCurrent((p) => p + 1);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#a855f7" />
      </SafeAreaView>
    );
  }

  if (phase === "setup") {
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
          <View className="items-center mb-6 mt-8">
            <View className="w-16 h-16 rounded-2xl bg-brand-500 items-center justify-center mb-4">
              <PenLine size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">Writing Practice</Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Pinyin IME, vocabulary & AI sentence writing
            </Text>
          </View>
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">HSK Level</Text>
            <View className="flex-row gap-2 mb-4">
              {([1, 2, 3, 4] as HSKLevel[]).map((l) => (
                <Pressable key={l} onPress={() => setLevel(l)}
                  className={`px-4 py-2 rounded-xl ${level === l ? "bg-brand-500" : "bg-ink-100 dark:bg-ink-800"}`}>
                  <Text className={`text-sm font-semibold ${level === l ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>HSK {l}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">Direction</Text>
            <View className="flex-row gap-2 mb-4">
              {([["pinyin", "Pinyin → 汉"], ["en", "English → 汉"], ["zh", "汉字 → Pinyin"]] as const).map(([d, label]) => (
                <Pressable key={d} onPress={() => setDirection(d)}
                  className={`px-3 py-2 rounded-xl ${direction === d ? "bg-brand-500" : "bg-ink-100 dark:bg-ink-800"}`}>
                  <Text className={`text-xs font-semibold ${direction === d ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">Questions: {count}</Text>
            <View className="flex-row gap-2">
              {[5, 10, 15, 20].map((c) => (
                <Pressable key={c} onPress={() => setCount(c)}
                  className={`px-4 py-2 rounded-xl ${count === c ? "bg-brand-500" : "bg-ink-100 dark:bg-ink-800"}`}>
                  <Text className={`text-sm font-semibold ${count === c ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable onPress={start} className="bg-brand-500 rounded-2xl py-4 items-center">
            <Text className="text-white text-lg font-bold">Start Writing</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "results") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <CheckCircle size={64} color="#10b981" />
        <Text className="text-3xl font-bold text-ink-900 dark:text-white mt-4">
          {Math.round((results.correct / results.total) * 100)}%
        </Text>
        <Text className="text-lg text-ink-500 mt-2">{results.correct} / {results.total} correct</Text>
        <Pressable onPress={() => setPhase("setup")} className="bg-brand-500 rounded-xl px-6 py-3 mt-6">
          <Text className="text-white font-semibold">Done</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const word = words[current];
  if (!word) return null;
  const prompt = direction === "pinyin" ? word.pinyin : direction === "en" ? word.english : word.chinese;
  const expected = direction === "zh" ? word.pinyin : word.chinese;

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <View className="p-4">
        <Text className="text-sm text-ink-500 mb-4">Question {current + 1} / {words.length}</Text>
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-8 items-center mb-6">
          <Text className="text-3xl font-bold text-ink-900 dark:text-white mb-2">{prompt}</Text>
          <Text className="text-sm text-ink-400">
            {direction === "pinyin" ? "Write the Chinese characters" : direction === "en" ? "Write the Chinese characters" : "Write the pinyin"}
          </Text>
        </View>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type your answer..."
          autoFocus
          className="bg-white dark:bg-ink-900 rounded-xl px-4 py-4 text-lg text-ink-900 dark:text-white mb-4"
          onSubmitEditing={submit}
        />
        <Pressable onPress={submit} className="bg-brand-500 rounded-xl py-4 items-center">
          <Text className="text-white text-lg font-bold">Submit</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}