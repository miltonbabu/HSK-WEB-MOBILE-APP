import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, CheckCircle } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import type { Word, HSKLevel } from "@/types";

type QType = "mcq" | "cloze" | "match";
interface ReadingQuestion {
  id: string;
  type: QType;
  passage: string;
  question: string;
  options: string[];
  answer: string;
}

export default function ReadingScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [level, setLevel] = useState<HSKLevel>(3);
  const [phase, setPhase] = useState<"setup" | "quiz" | "results">("setup");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<ReadingQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const userId = user?.id || "guest";

  const start = useCallback(async () => {
    try {
      setLoading(true);
      const words = await ds.vocab.getWordsByLevel(level);
      const pool = words.filter((w) => w.chinese && w.english && w.example_sentences?.length > 0);
      const fallback = words.filter((w) => w.chinese && w.english);
      const source = pool.length >= 5 ? pool : fallback;
      const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 8);
      const qs: ReadingQuestion[] = shuffled.map((w, i) => {
        const distractors = shuffled.filter((x) => x.id !== w.id).slice(0, 3).map((x) => x.english);
        const options = [w.english, ...distractors].sort(() => Math.random() - 0.5);
        const passage = w.example_sentences?.[0]
          ? `${w.example_sentences[0]}`
          : `${w.chinese} is a common HSK ${level} word.`;
        const type: QType = i % 3 === 0 ? "mcq" : i % 3 === 1 ? "cloze" : "match";
        return {
          id: `r_${i}`, type,
          passage,
          question: type === "cloze" ? `Fill in the blank: The word "${w.pinyin}" means ___` : `What does "${w.chinese}" mean in this passage?`,
          options, answer: w.english,
        };
      });
      setQuestions(qs);
      setCurrent(0);
      setAnswers({});
      setPhase("quiz");
    } catch (e) {
      console.error("Reading start failed:", e);
    } finally {
      setLoading(false);
    }
  }, [ds.vocab, level]);

  const answer = (qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    if (current + 1 < questions.length) setCurrent((p) => p + 1);
    else {
      const correct = questions.filter((q) => (qId === q.id ? value : answers[q.id]) === q.answer).length;
      ds.sessions.record({
        user_id: userId, mode: "reading", words_studied: questions.length,
        accuracy: Math.round((correct / questions.length) * 100), duration: 0,
        date: new Date().toISOString(),
      }).catch(() => {});
      setPhase("results");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </SafeAreaView>
    );
  }

  if (phase === "setup") {
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
          <View className="items-center mb-6 mt-8">
            <View className="w-16 h-16 rounded-2xl bg-sky-500 items-center justify-center mb-4">
              <FileText size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">Reading Practice</Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Passage MCQ, cloze, matching & ordering
            </Text>
          </View>
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">HSK Level</Text>
            <View className="flex-row gap-2">
              {([1, 2, 3, 4] as HSKLevel[]).map((l) => (
                <Pressable key={l} onPress={() => setLevel(l)}
                  className={`px-4 py-2 rounded-xl ${level === l ? "bg-sky-500" : "bg-ink-100 dark:bg-ink-800"}`}>
                  <Text className={`text-sm font-semibold ${level === l ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>HSK {l}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable onPress={start} className="bg-sky-500 rounded-2xl py-4 items-center">
            <Text className="text-white text-lg font-bold">Start Reading</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "results") {
    const correct = questions.filter((q) => answers[q.id] === q.answer).length;
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <CheckCircle size={64} color="#10b981" />
        <Text className="text-3xl font-bold text-ink-900 dark:text-white mt-4">
          {Math.round((correct / questions.length) * 100)}%
        </Text>
        <Text className="text-lg text-ink-500 mt-2">{correct} / {questions.length} correct</Text>
        <Pressable onPress={() => setPhase("setup")} className="bg-sky-500 rounded-xl px-6 py-3 mt-6">
          <Text className="text-white font-semibold">Done</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <View className="p-4">
        <Text className="text-sm text-ink-500 mb-3">Question {current + 1} / {questions.length}</Text>
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4">
          <Text className="text-xs font-semibold uppercase text-sky-500 mb-2">{q.type}</Text>
          <Text className="text-base text-ink-900 dark:text-white mb-3 leading-6">{q.passage}</Text>
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300">{q.question}</Text>
        </View>
        <View className="gap-3">
          {q.options.map((opt) => (
            <Pressable key={opt} onPress={() => answer(q.id, opt)}
              className="bg-white dark:bg-ink-900 rounded-xl py-4 px-5 items-center">
              <Text className="text-base text-ink-900 dark:text-white">{opt}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}