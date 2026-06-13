import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Image,
  RotateCcw,
  Trophy,
  CheckCircle,
  BookOpen,
} from "lucide-react-native";

import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import type { Word, UserProgress, HSKLevel } from "@/types";

type Phase = "setup" | "quiz" | "results";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const QUESTION_COUNTS = [5, 10, 15, 20];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

interface VisualRecord {
  word: Word;
  quality: number;
  label: string;
}

const ASSESSMENT_OPTIONS = [
  { quality: 1 as const, label: "Again", bg: "#ef4444", desc: "Forgot" },
  { quality: 2 as const, label: "Hard", bg: "#f59e0b", desc: "Difficult" },
  { quality: 3 as const, label: "Good", bg: "#10b981", desc: "Knew it" },
  { quality: 4 as const, label: "Easy", bg: "#8b5cf6", desc: "Mastered" },
];

export default function VisualMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [questionCount, setQuestionCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [records, setRecords] = useState<VisualRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardKey, setCardKey] = useState(0);
  const sessionStartRef = useRef(Date.now());

  const userId = user?.id || "guest";
  const levelColor = LEVEL_COLORS[selectedLevel] || "#8b5cf6";

  const triggerHaptic = useCallback(
    (type: "light" | "medium" | "heavy" | "success" | "error") => {
      if (!hapticsEnabled) return;
      switch (type) {
        case "light":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case "medium":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case "heavy":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case "success":
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case "error":
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    },
    [hapticsEnabled],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const levelWords = await ds.vocab.getWordsByLevel(selectedLevel);
        if (mounted) setWords(levelWords);
      } catch (e) {
        console.error("Failed to load words:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedLevel, ds.vocab]);

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startQuiz = () => {
    const shuffled = shuffleArray(words);
    const selected = shuffled.slice(0, Math.min(questionCount, words.length));
    setQuizWords(selected);
    setCurrentIndex(0);
    setRecords([]);
    setCardKey(0);
    sessionStartRef.current = Date.now();
    setPhase("quiz");
    triggerHaptic("light");
  };

  const handleAssessment = async (quality: 0 | 1 | 2 | 3 | 4 | 5, label: string) => {
    if (!currentWord) return;

    if (hapticsEnabled) {
      if (quality < 3) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    // Update SRS progress
    try {
      const existing = await ds.progress.getForUser(userId, currentWord.id);
      const srsParams = existing
        ? {
            easinessFactor: existing.easiness_factor,
            interval: existing.interval,
            reviewCount: existing.review_count,
          }
        : { easinessFactor: 2.5, interval: 0, reviewCount: 0 };
      const updated = gradeSRS(
        srsParams,
        existing?.correct_count ?? 0,
        quality,
      );
      await ds.progress.upsert({
        user_id: userId,
        word_id: currentWord.id,
        mastery_level: updated.mastery_level,
        last_reviewed: updated.last_reviewed,
        next_review: updated.next_review,
        review_count: updated.review_count,
        correct_count: updated.correct_count,
        easiness_factor: updated.easiness_factor,
        interval: updated.interval,
      });
    } catch (e) {
      console.error("Failed to update progress:", e);
    }

    const record: VisualRecord = {
      word: currentWord,
      quality,
      label,
    };

    const newRecords = [...records, record];
    setRecords(newRecords);

    if (currentIndex + 1 >= quizWords.length) {
      endQuiz(newRecords);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setCardKey((prev) => prev + 1);
    }
  };

  const endQuiz = async (finalRecords: VisualRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const duration = Math.round(
      (Date.now() - sessionStartRef.current) / 1000,
    );
    const correctCount = finalRecords.filter(
      (r) => r.quality >= 3,
    ).length;
    const accuracy =
      finalRecords.length > 0
        ? Math.round((correctCount / finalRecords.length) * 100)
        : 0;

    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "visual",
        words_studied: finalRecords.length,
        accuracy,
        duration,
        date: new Date().toISOString(),
      });

      await ds.profiles.updateStreak(userId);

      await ds.leaderboard.addEntry({
        user_id: userId,
        username: user?.username || "Learner",
        score: correctCount,
        accuracy,
        mode: "visual",
      });
    } catch (e) {
      console.error("Failed to record results:", e);
    }
  };

  const currentWord = quizWords[currentIndex];

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ActivityIndicator size="large" color={levelColor} />
        <Text className="mt-3 text-sm text-ink-500 dark:text-ink-400">
          Loading HSK {selectedLevel}...
        </Text>
      </SafeAreaView>
    );
  }

  // ── Not enough words ──
  if (words.length < 1) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
        edges={["bottom"]}
      >
        <Image size={48} color="#9ca3af" />
        <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
          No Words Available
        </Text>
        <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
          No words found for HSK {selectedLevel}. Try a different level.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Setup Phase ──
  if (phase === "setup") {
    return (
      <SafeAreaView
        className="flex-1 bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-6">
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 500 }}
            >
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: levelColor }}
              >
                <Image size={32} color="white" />
              </View>
            </MotiView>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Visual Learning
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Study words with full visual cards — all info shown at once.
            </Text>
          </View>

          {/* Level Picker */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              HSK Level
            </Text>
            <View className="flex-row justify-center gap-2">
              {HSK_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => {
                    setSelectedLevel(lvl);
                    triggerHaptic("light");
                  }}
                  className="px-4 py-2 rounded-xl"
                  style={{
                    backgroundColor:
                      selectedLevel === lvl ? LEVEL_COLORS[lvl] : undefined,
                  }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedLevel === lvl
                        ? "text-white"
                        : "text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-800 px-4 py-2 rounded-xl"
                    }`}
                    style={
                      selectedLevel === lvl ? { color: "#fff" } : undefined
                    }
                  >
                    HSK {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Question Count */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Number of Cards
            </Text>
            <View className="flex-row justify-center gap-2">
              {QUESTION_COUNTS.map((count) => (
                <Pressable
                  key={count}
                  onPress={() => {
                    setQuestionCount(count);
                    triggerHaptic("light");
                  }}
                  className={`px-4 py-2 rounded-xl ${
                    questionCount === count
                      ? "bg-brand-500"
                      : "bg-ink-100 dark:bg-ink-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      questionCount === count
                        ? "text-white"
                        : "text-ink-600 dark:text-ink-300"
                    }`}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Start */}
          <Pressable
            onPress={startQuiz}
            className="rounded-2xl py-4 items-center justify-center active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white text-lg font-bold">Start Learning</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Results Phase ──
  if (phase === "results") {
    const correctCount = records.filter((r) => r.quality >= 3).length;
    const accuracy =
      records.length > 0
        ? Math.round((correctCount / records.length) * 100)
        : 0;
    const againCount = records.filter((r) => r.quality === 1).length;
    const hardCount = records.filter((r) => r.quality === 2).length;
    const goodCount = records.filter((r) => r.quality === 3).length;
    const easyCount = records.filter((r) => r.quality === 4).length;

    return (
      <SafeAreaView
        className="flex-1 bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Result Header */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-4 shadow-sm">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: levelColor }}
            >
              <Trophy size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-4">
              Study Complete!
            </Text>

            <View className="flex-row justify-center gap-8 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-brand-500">
                  {records.length}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Studied
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: levelColor }}
                >
                  {accuracy}%
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Accuracy
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-ink-900 dark:text-white">
                  {correctCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Known
                </Text>
              </View>
            </View>
          </View>

          {/* Assessment Breakdown */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Assessment Breakdown
            </Text>
            <View className="flex-row gap-2">
              {ASSESSMENT_OPTIONS.map((opt) => {
                const count =
                  opt.quality === 1
                    ? againCount
                    : opt.quality === 2
                      ? hardCount
                      : opt.quality === 3
                        ? goodCount
                        : easyCount;
                return (
                  <View
                    key={opt.quality}
                    className="flex-1 rounded-xl py-3 items-center"
                    style={{ backgroundColor: opt.bg + "15" }}
                  >
                    <Text
                      className="text-lg font-bold"
                      style={{ color: opt.bg }}
                    >
                      {count}
                    </Text>
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: opt.bg }}
                    >
                      {opt.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Word Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Word Review
            </Text>
            {records.map((r, i) => {
              const opt = ASSESSMENT_OPTIONS.find(
                (o) => o.quality === r.quality,
              );
              return (
                <View
                  key={i}
                  className="flex-row items-center gap-3 p-2.5 rounded-xl mb-2"
                  style={{ backgroundColor: (opt?.bg || "#6b7280") + "10" }}
                >
                  <View
                    className="w-2 h-8 rounded-full"
                    style={{ backgroundColor: opt?.bg || "#6b7280" }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                      {r.word.chinese}
                    </Text>
                    <Text className="text-xs text-ink-400 dark:text-ink-500">
                      {r.word.pinyin} — {r.word.english}
                    </Text>
                  </View>
                  <View
                    className="px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: (opt?.bg || "#6b7280") + "20" }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: opt?.bg || "#6b7280" }}
                    >
                      {r.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Try Again */}
          <Pressable
            onPress={() => {
              setPhase("setup");
              setRecords([]);
              triggerHaptic("light");
            }}
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl active:opacity-60"
          >
            <RotateCcw size={16} color="#6b7280" />
            <Text className="text-sm font-semibold text-ink-500 dark:text-ink-400">
              New Study Session
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Quiz Phase ──
  const progressPercent =
    quizWords.length > 0
      ? ((currentIndex + 1) / quizWords.length) * 100
      : 0;

  const posText = currentWord
    ? Array.isArray(currentWord.pos)
      ? currentWord.pos.join(" · ")
      : String(currentWord.pos || "")
    : "";

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              Visual Learning
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              Card {currentIndex + 1} / {quizWords.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Known
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {records.filter((r) => r.quality >= 3).length}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-ink-200/50 dark:bg-ink-700/50 rounded-full overflow-hidden mb-5">
          <MotiView
            from={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "timing", duration: 300 }}
            className="h-full rounded-full"
            style={{ backgroundColor: levelColor }}
          />
        </View>

        {/* Visual Card */}
        <MotiView
          key={cardKey}
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 300 }}
          className="bg-white dark:bg-ink-900 rounded-3xl p-8 items-center mb-5 shadow-sm"
          style={{
            shadowColor: levelColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 6,
            borderWidth: 1,
            borderColor: levelColor + "22",
          }}
        >
          {/* Character Display */}
          <View className="mb-4">
            <Text className="text-6xl font-bold text-ink-900 dark:text-white tracking-widest text-center">
              {currentWord?.chinese}
            </Text>
          </View>

          {/* Pinyin */}
          <Text className="text-xl text-ink-500 dark:text-ink-400 mb-2">
            {currentWord?.pinyin}
          </Text>

          {/* English */}
          <Text className="text-lg font-semibold text-ink-700 dark:text-ink-200 text-center mb-3">
            {currentWord?.english}
          </Text>

          {/* Part of Speech */}
          {posText ? (
            <View className="flex-row items-center gap-1.5 mb-4">
              <BookOpen size={14} color="#9ca3af" />
              <Text className="text-sm text-ink-400 dark:text-ink-500">
                {posText}
              </Text>
            </View>
          ) : null}

          {/* Divider */}
          <View className="w-full h-px bg-ink-100 dark:bg-ink-700 my-2" />

          {/* Example Sentence */}
          {currentWord?.example_sentences &&
            currentWord.example_sentences.length > 0 &&
            currentWord.example_sentences[0].trim() && (
              <View className="mt-3 px-2">
                <Text className="text-xs text-ink-400 dark:text-ink-500 mb-1 text-center">
                  Example
                </Text>
                <Text className="text-sm text-ink-600 dark:text-ink-300 text-center leading-relaxed">
                  {currentWord.example_sentences[0]}
                </Text>
              </View>
            )}
        </MotiView>

        {/* Assessment Buttons */}
        <View className="flex-row gap-2">
          {ASSESSMENT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.quality}
              onPress={() => handleAssessment(opt.quality, opt.label)}
              className="flex-1 py-3.5 rounded-2xl items-center active:opacity-80"
              style={{
                backgroundColor: opt.bg,
                shadowColor: opt.bg,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text className="text-white font-bold text-sm">{opt.label}</Text>
              <Text className="text-white/60 text-[10px] mt-0.5">
                {opt.desc}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Session Stats */}
        <View className="mt-5 p-4 rounded-2xl bg-white dark:bg-ink-900 shadow-sm">
          <Text className="text-xs font-medium text-ink-400 dark:text-ink-500 mb-2">
            Session Stats
          </Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-lg font-bold text-ink-900 dark:text-white">
                {records.length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Reviewed
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-green-500">
                {records.filter((r) => r.quality >= 3).length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Known
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-red-500">
                {records.filter((r) => r.quality < 3).length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Review
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold" style={{ color: levelColor }}>
                {quizWords.length - currentIndex - 1}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Remaining
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}