import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Languages,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Trophy,
  Target,
  Clock,
  ChevronRight,
  ChevronDown,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import type { Word, UserProgress, HSKLevel } from "@/types";

type Phase = "setup" | "quiz" | "results";
type Direction = "zh-en" | "en-zh";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const QUESTION_COUNTS = [5, 10, 15, 20];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

const DIRECTION_OPTIONS: { id: Direction; label: string; icon: string }[] = [
  { id: "zh-en", label: "Chinese → English", icon: "🇨🇳→🇬🇧" },
  { id: "en-zh", label: "English → Chinese", icon: "🇬🇧→🇨🇳" },
];

interface AnswerRecord {
  word: Word;
  userAnswer: string;
  quality: 1 | 3 | 5;
  label: "Wrong" | "Close" | "Correct";
}

export default function TranslationMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [direction, setDirection] = useState<Direction>("zh-en");
  const [questionCount, setQuestionCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [showReview, setShowReview] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const answerInputRef = useRef<TextInput>(null);

  const levelColor = LEVEL_COLORS[selectedLevel] || "#8b5cf6";

  const triggerHaptic = useCallback(
    (type: "light" | "medium" | "success" | "error") => {
      if (!hapticsEnabled) return;
      switch (type) {
        case "light":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case "medium":
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    async function loadData() {
      try {
        setLoading(true);
        const levelWords = await ds.vocab.getWordsByLevel(selectedLevel);
        if (mounted) setWords(levelWords);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
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
    setUserAnswer("");
    setShowAnswer(false);
    setAnswers([]);
    sessionStartRef.current = Date.now();
    setPhase("quiz");
    triggerHaptic("light");
    setTimeout(() => answerInputRef.current?.focus(), 300);
  };

  const currentWord = quizWords[currentIndex];

  const handleSubmit = () => {
    if (!userAnswer.trim() || !currentWord) return;
    triggerHaptic("medium");
    setShowAnswer(true);
  };

  const handleSelfAssess = async (quality: 1 | 3 | 5) => {
    if (!currentWord) return;

    const label = quality === 5 ? "Correct" : quality === 3 ? "Close" : "Wrong";
    triggerHaptic(quality === 5 ? "success" : quality === 3 ? "light" : "error");

    const record: AnswerRecord = {
      word: currentWord,
      userAnswer: userAnswer.trim(),
      quality,
      label,
    };

    const newAnswers = [...answers, record];
    setAnswers(newAnswers);

    // Update SRS progress
    try {
      const userId = user?.id || "guest";
      const existing = await ds.progress.getForUser(userId, currentWord.id);
      const srsParams = existing
        ? {
            easinessFactor: existing.easiness_factor,
            interval: existing.interval,
            reviewCount: existing.review_count,
          }
        : { easinessFactor: 2.5, interval: 0, reviewCount: 0 };
      const correctCount = existing?.correct_count ?? 0;
      const update = gradeSRS(srsParams, correctCount, quality);
      await ds.progress.upsert({
        user_id: userId,
        word_id: currentWord.id,
        mastery_level: update.mastery_level,
        next_review: update.next_review,
        easiness_factor: update.easiness_factor,
        interval: update.interval,
        review_count: update.review_count,
        correct_count: update.correct_count,
        last_reviewed: update.last_reviewed,
      });
    } catch (e) {
      console.error("Failed to update progress:", e);
    }

    // Advance
    if (currentIndex < quizWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
      setShowAnswer(false);
      setTimeout(() => answerInputRef.current?.focus(), 200);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers: AnswerRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const userId = user?.id || "guest";
    const totalCorrect = finalAnswers.filter((a) => a.quality === 5).length;
    const accuracy =
      finalAnswers.length > 0
        ? Math.round((totalCorrect / finalAnswers.length) * 100)
        : 0;
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // Record session
    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "translation",
        words_studied: finalAnswers.length,
        accuracy,
        duration,
        date: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to save session:", e);
    }

    // Update streak
    try {
      await ds.profiles.updateStreak(userId);
    } catch (e) {
      console.error("Failed to update streak:", e);
    }

    // Add leaderboard entry
    const leaderboardScore =
      finalAnswers.length * 10 * (accuracy / 100) +
      Math.max(0, Math.round((30 - duration) * 0.5));
    try {
      await ds.leaderboard.addEntry({
        user_id: userId,
        username: user?.username || "Guest",
        avatar_url: user?.email ? undefined : undefined,
        score: Math.max(0, leaderboardScore),
        accuracy,
        mode: "translation",
      });
    } catch (e) {
      console.error("Failed to add leaderboard entry:", e);
    }
  };

  const checkCorrect = (record: AnswerRecord): boolean => {
    if (direction === "zh-en") {
      return (
        record.userAnswer.toLowerCase().trim() ===
        record.word.english.toLowerCase().trim()
      );
    } else {
      return record.userAnswer.trim() === record.word.chinese.trim();
    }
  };

  const totalCorrect = answers.filter((a) => a.quality === 5).length;
  const totalClose = answers.filter((a) => a.quality === 3).length;
  const totalWrong = answers.filter((a) => a.quality === 1).length;
  const accuracy =
    answers.length > 0
      ? Math.round((totalCorrect / answers.length) * 100)
      : 0;

  // ─── Loading ──────────────────────────────────────────────
  if (loading && phase === "setup") {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ActivityIndicator size="large" color={levelColor} />
        <Text className="mt-3 text-sm text-ink-500 dark:text-ink-400">
          Loading words...
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Setup Phase ──────────────────────────────────────────
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
          {/* Header */}
          <View className="items-center mb-6 mt-4">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: levelColor }}
            >
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 500 }}
              >
                <Languages size={32} color="white" />
              </MotiView>
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Translation
            </Text>
            <Text className="text-ink-500 dark:text-ink-400 mt-2 text-center px-4">
              Translate words between Chinese and English. Self-assess your
              answers.
            </Text>
          </View>

          {/* HSK Level */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              HSK Level
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {HSK_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => {
                    setSelectedLevel(lvl);
                    triggerHaptic("light");
                  }}
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor:
                      selectedLevel === lvl
                        ? LEVEL_COLORS[lvl]
                        : isDark
                          ? "#1f2937"
                          : "rgba(0,0,0,0.05)",
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color:
                        selectedLevel === lvl
                          ? "#fff"
                          : isDark
                            ? "#d1d5db"
                            : "#6b7280",
                    }}
                  >
                    HSK {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Direction */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Translation Direction
            </Text>
            <View className="flex-row justify-center gap-3">
              {DIRECTION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setDirection(opt.id);
                    triggerHaptic("light");
                  }}
                  className="flex-1 py-3 px-4 rounded-xl items-center active:opacity-80"
                  style={{
                    backgroundColor:
                      direction === opt.id
                        ? levelColor
                        : isDark
                          ? "#1f2937"
                          : "rgba(0,0,0,0.05)",
                  }}
                >
                  <Text className="text-lg mb-1">{opt.icon}</Text>
                  <Text
                    className="text-xs font-semibold text-center"
                    style={{
                      color:
                        direction === opt.id
                          ? "#fff"
                          : isDark
                            ? "#d1d5db"
                            : "#6b7280",
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Question Count */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Number of Questions
            </Text>
            <View className="flex-row justify-center gap-2">
              {QUESTION_COUNTS.map((count) => (
                <Pressable
                  key={count}
                  onPress={() => {
                    setQuestionCount(count);
                    triggerHaptic("light");
                  }}
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor:
                      questionCount === count
                        ? levelColor
                        : isDark
                          ? "#1f2937"
                          : "rgba(0,0,0,0.05)",
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color:
                        questionCount === count
                          ? "#fff"
                          : isDark
                            ? "#d1d5db"
                            : "#6b7280",
                    }}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View className="flex-row items-center justify-center gap-4 mb-4">
            <View className="flex-row items-center gap-1.5">
              <Target size={16} color="#6b7280" />
              <Text className="text-sm text-ink-500 dark:text-ink-400">
                {questionCount} questions
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <ArrowLeftRight size={16} color="#6b7280" />
              <Text className="text-sm text-ink-500 dark:text-ink-400">
                {direction === "zh-en" ? "ZH → EN" : "EN → ZH"}
              </Text>
            </View>
          </View>

          {/* Start */}
          <Pressable
            onPress={startQuiz}
            className="rounded-2xl py-3.5 items-center justify-center active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white text-lg font-bold">Start Quiz</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Results Phase ────────────────────────────────────────
  if (phase === "results") {
    return (
      <SafeAreaView
        className="flex-1 bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Score Card */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-4 shadow-sm">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: levelColor }}
            >
              <Trophy size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-4">
              Translation Complete!
            </Text>

            <View className="flex-row justify-center gap-6 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-green-500">
                  {totalCorrect}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Correct
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-amber-500">
                  {totalClose}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Close
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-500">
                  {totalWrong}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Wrong
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-ink-900 dark:text-white">
                  {accuracy}%
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Accuracy
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <Target size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  {answers.length} words
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Clock size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  {Math.round(
                    (Date.now() - sessionStartRef.current) / 1000,
                  )}
                  s
                </Text>
              </View>
            </View>
          </View>

          {/* Review Answers */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Pressable
              onPress={() => {
                triggerHaptic("light");
                setShowReview(!showReview);
              }}
              className="flex-row items-center justify-between"
            >
              <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300">
                Review Answers ({answers.length})
              </Text>
              <MotiView
                animate={{ rotate: showReview ? "180deg" : "0deg" }}
                transition={{ type: "timing", duration: 200 }}
              >
                <ChevronDown size={18} color="#6b7280" />
              </MotiView>
            </Pressable>

            {showReview && (
              <MotiView
                from={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ type: "timing", duration: 200 }}
                style={{ overflow: "hidden" }}
              >
                <View className="mt-3">
                  {answers.map((record, i) => {
                    const isActuallyCorrect = checkCorrect(record);
                    const bgColor =
                      record.quality === 5
                        ? "bg-green-50 dark:bg-green-900/10"
                        : record.quality === 3
                          ? "bg-amber-50 dark:bg-amber-900/10"
                          : "bg-red-50 dark:bg-red-900/10";

                    return (
                      <View
                        key={i}
                        className={`flex-row items-center gap-3 p-3 rounded-xl mb-2 ${bgColor}`}
                      >
                        {record.quality === 5 ? (
                          <CheckCircle size={16} color="#22c55e" />
                        ) : record.quality === 3 ? (
                          <HelpCircle size={16} color="#f59e0b" />
                        ) : (
                          <XCircle size={16} color="#ef4444" />
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                            {direction === "zh-en"
                              ? record.word.chinese
                              : record.word.english}
                          </Text>
                          <Text className="text-xs text-ink-500 dark:text-ink-400">
                            You: {record.userAnswer}
                          </Text>
                          <Text className="text-xs text-ink-400 dark:text-ink-500">
                            Answer:{" "}
                            {direction === "zh-en"
                              ? record.word.english
                              : `${record.word.chinese} (${record.word.pinyin})`}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-0.5 rounded-lg"
                          style={{
                            backgroundColor:
                              record.quality === 5
                                ? "#22c55e20"
                                : record.quality === 3
                                  ? "#f59e0b20"
                                  : "#ef444420",
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color:
                                record.quality === 5
                                  ? "#16a34a"
                                  : record.quality === 3
                                    ? "#d97706"
                                    : "#dc2626",
                            }}
                          >
                            {record.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </MotiView>
            )}
          </View>

          {/* Actions */}
          <Pressable
            onPress={() => {
              setPhase("quiz");
              setAnswers([]);
              setCurrentIndex(0);
              setUserAnswer("");
              setShowAnswer(false);
              sessionStartRef.current = Date.now();
              const shuffled = shuffleArray(words);
              setQuizWords(
                shuffled.slice(0, Math.min(questionCount, words.length)),
              );
              triggerHaptic("light");
            }}
            className="rounded-2xl py-3.5 items-center justify-center mb-3 active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPhase("setup");
              setAnswers([]);
              triggerHaptic("light");
            }}
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl active:opacity-60"
          >
            <RotateCcw size={16} color="#6b7280" />
            <Text className="text-sm font-semibold text-ink-500 dark:text-ink-400">
              Back to Setup
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Quiz Phase ───────────────────────────────────────────
  const progressPct = ((currentIndex + 1) / quizWords.length) * 100;
  const promptText =
    direction === "zh-en"
      ? `Translate to English`
      : `Translate to Chinese`;
  const displayWord =
    direction === "zh-en" ? currentWord.chinese : currentWord.english;
  const correctAnswer =
    direction === "zh-en"
      ? currentWord.english
      : `${currentWord.chinese} (${currentWord.pinyin})`;

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              Translation
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              HSK {selectedLevel} · {currentIndex + 1}/{quizWords.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Accuracy
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {answers.length > 0
                ? Math.round(
                    (answers.filter((a) => a.quality === 5).length /
                      answers.length) *
                      100,
                  )
                : 0}
              %
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-ink-200/50 dark:bg-ink-700/50 rounded-full overflow-hidden mb-5">
          <MotiView
            from={{ width: "0%" }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "timing", duration: 300 }}
            className="h-full rounded-full"
            style={{ backgroundColor: levelColor }}
          />
        </View>

        {/* Prompt Card */}
        <MotiView
          key={currentWord.id}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-5 shadow-sm"
        >
          <Text className="text-sm text-ink-400 dark:text-ink-500 mb-2">
            {promptText}
          </Text>
          <Text
            className={`text-center font-bold text-ink-900 dark:text-white ${
              direction === "en-zh" ? "text-2xl" : "text-5xl"
            }`}
          >
            {displayWord}
          </Text>
          {direction === "zh-en" && currentWord.pinyin && (
            <Text className="mt-2 text-ink-400 dark:text-ink-500 text-sm">
              {currentWord.pinyin}
            </Text>
          )}
        </MotiView>

        {/* Answer Input */}
        {!showAnswer ? (
          <View className="mb-5">
            <TextInput
              ref={answerInputRef}
              value={userAnswer}
              onChangeText={setUserAnswer}
              onSubmitEditing={handleSubmit}
              placeholder={
                direction === "zh-en"
                  ? "Type English translation..."
                  : "Type Chinese characters..."
              }
              placeholderTextColor="#9ca3af"
              className="text-base px-5 py-4 rounded-2xl bg-white dark:bg-ink-900 text-ink-900 dark:text-white border border-ink-200 dark:border-ink-700"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Pressable
              onPress={handleSubmit}
              disabled={!userAnswer.trim()}
              className={`rounded-2xl py-3.5 items-center justify-center mt-3 active:opacity-80 ${
                userAnswer.trim() ? "" : "opacity-50"
              }`}
              style={{
                backgroundColor: userAnswer.trim()
                  ? levelColor
                  : isDark
                    ? "#374151"
                    : "#d1d5db",
              }}
            >
              <Text className="text-white font-semibold">Submit</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Revealed Answer */}
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 200 }}
              className="bg-white dark:bg-ink-900 rounded-2xl py-6 px-4 items-center mb-5 shadow-sm"
            >
              <Text className="text-xs text-ink-400 dark:text-ink-500 mb-1">
                Correct Answer
              </Text>
              <Text className="text-xl font-bold text-ink-900 dark:text-white text-center">
                {correctAnswer}
              </Text>
              <View className="mt-3 py-2 px-4 rounded-xl bg-ink-50 dark:bg-ink-800">
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  Your answer:{" "}
                  <Text className="font-semibold text-ink-900 dark:text-white">
                    {userAnswer.trim()}
                  </Text>
                </Text>
              </View>
            </MotiView>

            {/* Self-Assess Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => handleSelfAssess(1)}
                className="flex-1 py-3.5 rounded-2xl items-center active:opacity-80"
                style={{
                  backgroundColor: "#ef4444",
                  shadowColor: "#ef4444",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <XCircle size={22} color="white" />
                <Text className="text-white font-bold text-sm mt-1">Wrong</Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelfAssess(3)}
                className="flex-1 py-3.5 rounded-2xl items-center active:opacity-80"
                style={{
                  backgroundColor: "#f59e0b",
                  shadowColor: "#f59e0b",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <HelpCircle size={22} color="white" />
                <Text className="text-white font-bold text-sm mt-1">Close</Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelfAssess(5)}
                className="flex-1 py-3.5 rounded-2xl items-center active:opacity-80"
                style={{
                  backgroundColor: "#22c55e",
                  shadowColor: "#22c55e",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <CheckCircle size={22} color="white" />
                <Text className="text-white font-bold text-sm mt-1">
                  Correct
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Session stats */}
        <View className="mt-6 p-4 rounded-2xl bg-ink-50/50 dark:bg-ink-800/50">
          <Text className="text-xs font-medium text-ink-400 dark:text-ink-500 mb-2">
            Session Stats
          </Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-lg font-bold text-ink-900 dark:text-white">
                {answers.length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Answered
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-green-500">
                {totalCorrect}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Correct
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-amber-500">
                {totalClose}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Close
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-red-500">
                {totalWrong}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Wrong
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}