import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  PenTool,
  CheckCircle,
  RotateCcw,
  Trophy,
  Target,
  Clock,
  RefreshCw,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import type { Word, HSKLevel } from "@/types";

type Phase = "setup" | "practice" | "results";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const WORD_COUNTS = [5, 10, 15, 20];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

interface PracticeRecord {
  word: Word;
  quality: 1 | 5;
  label: string;
}

export default function HandwritingMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [wordCount, setWordCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [inputFeedback, setInputFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [records, setRecords] = useState<PracticeRecord[]>([]);

  const sessionStartRef = useRef(Date.now());

  const levelColor = LEVEL_COLORS[selectedLevel] || "#8b5cf6";

  const triggerHaptic = useCallback(
    (type: "light" | "medium" | "success" | "error" | "heavy") => {
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

  const startPractice = () => {
    const shuffled = shuffleArray(words);
    const selected = shuffled.slice(0, Math.min(wordCount, words.length));
    setPracticeWords(selected);
    setCurrentIndex(0);
    setRecords([]);
    setIsRevealed(false);
    setUserInput("");
    setInputFeedback(null);
    sessionStartRef.current = Date.now();
    setPhase("practice");
    triggerHaptic("light");
  };

  const currentWord = practiceWords[currentIndex];

  const checkInput = () => {
    if (!currentWord || !userInput.trim()) return;
    const isCorrect = userInput.trim() === currentWord.chinese;
    if (isCorrect) {
      setInputFeedback("correct");
      triggerHaptic("success");
    } else {
      setInputFeedback("incorrect");
      triggerHaptic("error");
    }
    setIsRevealed(true);
  };

  const handleAssess = async (quality: 1 | 5) => {
    if (!currentWord) return;

    triggerHaptic(quality === 5 ? "success" : "heavy");

    const label = quality === 5 ? "Looks Good" : "Try Again";
    const record: PracticeRecord = {
      word: currentWord,
      quality,
      label,
    };

    const newRecords = [...records, record];
    setRecords(newRecords);

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

    // Advance after a short delay
    if (currentIndex < practiceWords.length - 1) {
      setTimeout(() => {
        triggerHaptic("light");
        setCurrentIndex(currentIndex + 1);
        setIsRevealed(false);
        setUserInput("");
        setInputFeedback(null);
      }, 600);
    } else {
      setTimeout(() => finishPractice(newRecords), 600);
    }
  };

  const finishPractice = async (finalRecords: PracticeRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const userId = user?.id || "guest";
    const goodCount = finalRecords.filter((r) => r.quality === 5).length;
    const accuracy =
      finalRecords.length > 0
        ? Math.round((goodCount / finalRecords.length) * 100)
        : 0;
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // Record session
    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "handwriting",
        words_studied: finalRecords.length,
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
      finalRecords.length * 10 * (accuracy / 100) +
      Math.max(0, Math.round((30 - duration) * 0.5));
    try {
      await ds.leaderboard.addEntry({
        user_id: userId,
        username: user?.username || "Guest",
        score: Math.max(0, leaderboardScore),
        accuracy,
        mode: "handwriting",
      });
    } catch (e) {
      console.error("Failed to add leaderboard entry:", e);
    }
  };

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
                <PenTool size={32} color="white" />
              </MotiView>
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Handwriting
            </Text>
            <Text className="text-ink-500 dark:text-ink-400 mt-2 text-center px-4">
              Practice writing Chinese characters. Study the character, then
              mentally write it and self-assess.
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

          {/* Word Count */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Number of Words
            </Text>
            <View className="flex-row justify-center gap-2">
              {WORD_COUNTS.map((count) => (
                <Pressable
                  key={count}
                  onPress={() => {
                    setWordCount(count);
                    triggerHaptic("light");
                  }}
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor:
                      wordCount === count
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
                        wordCount === count
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
                {wordCount} characters
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <PenTool size={16} color="#6b7280" />
              <Text className="text-sm text-ink-500 dark:text-ink-400">
                HSK {selectedLevel}
              </Text>
            </View>
          </View>

          {/* Start */}
          <Pressable
            onPress={startPractice}
            className="rounded-2xl py-3.5 items-center justify-center active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white text-lg font-bold">Start Practice</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Results Phase ────────────────────────────────────────
  if (phase === "results") {
    const goodCount = records.filter((r) => r.quality === 5).length;
    const tryAgainCount = records.filter((r) => r.quality === 1).length;
    const accuracy =
      records.length > 0 ? Math.round((goodCount / records.length) * 100) : 0;

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
              Handwriting Complete!
            </Text>

            <View className="flex-row justify-center gap-6 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-green-500">
                  {goodCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Looks Good
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-500">
                  {tryAgainCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Try Again
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
                  {records.length} characters practiced
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Clock size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  {Math.round((Date.now() - sessionStartRef.current) / 1000)}s
                </Text>
              </View>
            </View>
          </View>

          {/* Word Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Character Review
            </Text>
            {records.map((record, i) => {
              const bgColor =
                record.quality === 5
                  ? "bg-green-50 dark:bg-green-900/10"
                  : "bg-red-50 dark:bg-red-900/10";

              return (
                <View
                  key={i}
                  className={`flex-row items-center gap-3 p-3 rounded-xl mb-2 ${bgColor}`}
                >
                  <Text className="text-3xl font-bold text-ink-900 dark:text-white w-16 text-center">
                    {record.word.chinese}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-sm text-ink-600 dark:text-ink-300">
                      {record.word.pinyin}
                    </Text>
                    <Text className="text-xs text-ink-400 dark:text-ink-500">
                      {record.word.english}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor:
                        record.quality === 5 ? "#22c55e20" : "#ef444420",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: record.quality === 5 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {record.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Actions */}
          <Pressable
            onPress={() => {
              setPhase("practice");
              setRecords([]);
              setCurrentIndex(0);
              setIsRevealed(false);
              setUserInput("");
              setInputFeedback(null);
              sessionStartRef.current = Date.now();
              const shuffled = shuffleArray(words);
              const selected = shuffled.slice(
                0,
                Math.min(wordCount, words.length),
              );
              setPracticeWords(selected);
              triggerHaptic("light");
            }}
            className="rounded-2xl py-3.5 items-center justify-center mb-3 active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white font-semibold">Practice Again</Text>
          </Pressable>

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
              Back to Setup
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Practice Phase ───────────────────────────────────────
  const progressPct = ((currentIndex + 1) / practiceWords.length) * 100;
  const goodCount = records.filter((r) => r.quality === 5).length;

  if (!currentWord) return null;

  const hasRadical = !!currentWord.radical && currentWord.radical.length > 0;
  const hasStrokes = currentWord.stroke_count > 0;

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              Handwriting
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              HSK {selectedLevel} · {currentIndex + 1}/{practiceWords.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Accuracy
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {records.length > 0
                ? Math.round(
                    (records.filter((r) => r.quality === 5).length /
                      records.length) *
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

        {/* Character Card */}
        <MotiView
          key={currentWord.id}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-5 shadow-sm"
        >
          {/* Character prominently displayed */}
          <Text className="text-6xl font-bold text-ink-900 dark:text-white mb-3">
            {currentWord.chinese}
          </Text>
          <Text className="text-2xl text-ink-500 dark:text-ink-400 mb-4">
            {currentWord.pinyin}
          </Text>

          {/* Stroke / Radical info */}
          {(hasRadical || hasStrokes) && (
            <View className="flex-row items-center gap-3 mb-4">
              {hasRadical && (
                <View
                  className="px-3 py-1.5 rounded-xl"
                  style={{
                    backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
                  }}
                >
                  <Text className="text-xs font-medium text-ink-500 dark:text-ink-400">
                    Radical: {currentWord.radical}
                  </Text>
                </View>
              )}
              {hasStrokes && (
                <View
                  className="px-3 py-1.5 rounded-xl"
                  style={{
                    backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
                  }}
                >
                  <Text className="text-xs font-medium text-ink-500 dark:text-ink-400">
                    {currentWord.stroke_count} strokes
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Writing Area with TextInput */}
          <View
            className="w-full py-6 px-4 rounded-2xl border-2 border-dashed mb-4 items-center justify-center"
            style={{
              borderColor:
                inputFeedback === "correct"
                  ? "#22c55e"
                  : inputFeedback === "incorrect"
                    ? "#ef4444"
                    : isDark
                      ? "#374151"
                      : "#d1d5db",
              backgroundColor:
                inputFeedback === "correct"
                  ? "rgba(34,197,94,0.08)"
                  : inputFeedback === "incorrect"
                    ? "rgba(239,68,68,0.08)"
                    : isDark
                      ? "#0f172a"
                      : "#f9fafb",
            }}
          >
            {!isRevealed ? (
              <>
                <TextInput
                  className="text-center w-full text-3xl font-bold text-ink-900 dark:text-white"
                  placeholder="Write the character..."
                  placeholderTextColor={isDark ? "#4b5563" : "#d1d5db"}
                  value={userInput}
                  onChangeText={setUserInput}
                  onSubmitEditing={checkInput}
                  returnKeyType="done"
                  autoFocus={false}
                  style={{
                    minHeight: 48,
                    fontFamily: "NotoSansSC_400Regular",
                  }}
                />
                <Pressable
                  onPress={checkInput}
                  disabled={!userInput.trim()}
                  className="mt-4 px-6 py-2.5 rounded-xl active:opacity-70"
                  style={{
                    backgroundColor: userInput.trim()
                      ? levelColor
                      : isDark
                        ? "#374151"
                        : "#e5e7eb",
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color: userInput.trim()
                        ? "#fff"
                        : isDark
                          ? "#6b7280"
                          : "#9ca3af",
                    }}
                  >
                    Check Answer
                  </Text>
                </Pressable>
              </>
            ) : (
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 300 }}
                className="items-center"
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <Text className="text-sm text-ink-500 dark:text-ink-400">
                    You wrote:
                  </Text>
                  <Text className="text-2xl font-bold text-ink-700 dark:text-ink-300">
                    {userInput || "(empty)"}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Text className="text-sm text-ink-500 dark:text-ink-400">
                    Correct:
                  </Text>
                  <Text className="text-4xl font-bold text-ink-900 dark:text-white">
                    {currentWord.chinese}
                  </Text>
                </View>
                {inputFeedback === "correct" ? (
                  <View className="flex-row items-center gap-1.5 mt-3">
                    <CheckCircle size={18} color="#22c55e" />
                    <Text className="text-sm font-semibold text-green-500">
                      Correct!
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5 mt-3">
                    <RotateCcw size={18} color="#ef4444" />
                    <Text className="text-sm font-semibold text-red-500">
                      Incorrect - the correct character is shown above
                    </Text>
                  </View>
                )}
              </MotiView>
            )}
          </View>

          {/* Try Again / Reveal Button */}
          {isRevealed ? (
            <Pressable
              onPress={() => {
                triggerHaptic("light");
                setIsRevealed(false);
                setUserInput("");
                setInputFeedback(null);
              }}
              className="flex-row items-center gap-2 px-5 py-2.5 rounded-xl active:opacity-70 mb-3"
              style={{
                backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
              }}
            >
              <RefreshCw size={16} color={isDark ? "#d1d5db" : "#6b7280"} />
              <Text
                className="text-sm font-semibold"
                style={{ color: isDark ? "#d1d5db" : "#6b7280" }}
              >
                Try Again
              </Text>
            </Pressable>
          ) : null}
        </MotiView>

        {/* English meaning + POS */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 250, delay: 100 }}
          className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-5 shadow-sm"
        >
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">
            Meaning
          </Text>
          <Text className="text-lg text-ink-900 dark:text-white">
            {currentWord.english}
          </Text>
          {currentWord.pos.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 mt-2">
              {currentWord.pos.map((p, idx) => (
                <View
                  key={idx}
                  className="px-2 py-0.5 rounded-lg"
                  style={{
                    backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
                  }}
                >
                  <Text className="text-xs text-ink-500 dark:text-ink-400">
                    {p}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </MotiView>

        {/* Self-Assessment Buttons */}
        <View className="flex-row gap-3 mb-5">
          <Pressable
            onPress={() => handleAssess(5)}
            className="flex-1 py-4 rounded-2xl items-center active:opacity-80"
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
              Looks Good
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleAssess(1)}
            className="flex-1 py-4 rounded-2xl items-center active:opacity-80"
            style={{
              backgroundColor: "#ef4444",
              shadowColor: "#ef4444",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <RefreshCw size={22} color="white" />
            <Text className="text-white font-bold text-sm mt-1">Try Again</Text>
          </Pressable>
        </View>

        {/* Session Stats */}
        <View className="p-4 rounded-2xl bg-ink-50/50 dark:bg-ink-800/50">
          <Text className="text-xs font-medium text-ink-400 dark:text-ink-500 mb-2">
            Session Stats
          </Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-lg font-bold text-ink-900 dark:text-white">
                {records.length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Done
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-green-500">
                {goodCount}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Looks Good
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-red-500">
                {records.filter((r) => r.quality === 1).length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Try Again
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-ink-900 dark:text-white">
                {records.length > 0
                  ? Math.round(
                      (records.filter((r) => r.quality === 5).length /
                        records.length) *
                        100,
                    )
                  : 0}
                %
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Accuracy
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
