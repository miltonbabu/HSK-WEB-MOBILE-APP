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
  Mic,
  Volume2,
  Play,
  RotateCcw,
  Trophy,
  Target,
  Clock,
  Star,
  ThumbsUp,
  Meh,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { speak, stopSpeaking } from "@/services/speech";
import { gradeSRS } from "@/utils/srs";
import type { Word, HSKLevel } from "@/types";

type Phase = "setup" | "practice" | "results";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const WORD_COUNTS = [5, 10, 15, 20];
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

interface PracticeRecord {
  word: Word;
  quality: 1 | 3 | 5;
  label: string;
}

export default function ShadowingMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { speechRate, hapticsEnabled, setSpeechRate } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [wordCount, setWordCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [localSpeechRate, setLocalSpeechRate] = useState(speechRate);

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
      stopSpeaking();
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
    setShowMeaning(false);
    setIsPlaying(false);
    sessionStartRef.current = Date.now();
    setPhase("practice");
    triggerHaptic("light");
    // Auto-play first word
    setTimeout(() => playWord(selected[0]), 400);
  };

  const playWord = useCallback(
    async (word: Word) => {
      if (!word) return;
      setIsPlaying(true);
      try {
        await speak(word.chinese, {
          rate: localSpeechRate,
          language: "zh-CN",
        });
      } catch {
        // ignore
      } finally {
        setTimeout(
          () => setIsPlaying(false),
          Math.max(800, word.chinese.length * 400),
        );
      }
    },
    [localSpeechRate],
  );

  const currentWord = practiceWords[currentIndex];

  const handleReplay = () => {
    if (!currentWord) return;
    triggerHaptic("light");
    playWord(currentWord);
  };

  const handleAssess = async (quality: 1 | 3 | 5) => {
    if (!currentWord) return;

    const label =
      quality === 5 ? "Perfect" : quality === 3 ? "Good" : "Needs Work";

    triggerHaptic(
      quality === 5 ? "success" : quality === 3 ? "medium" : "heavy",
    );

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

    // Show meaning after assessment
    setShowMeaning(true);
  };

  const goNext = () => {
    if (currentIndex < practiceWords.length - 1) {
      triggerHaptic("light");
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setShowMeaning(false);
      setIsPlaying(false);
      setTimeout(() => playWord(practiceWords[nextIdx]), 300);
    } else {
      finishPractice(records);
    }
  };

  const finishPractice = async (finalRecords: PracticeRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const userId = user?.id || "guest";
    const perfectCount = finalRecords.filter((r) => r.quality === 5).length;
    const accuracy =
      finalRecords.length > 0
        ? Math.round((perfectCount / finalRecords.length) * 100)
        : 0;
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // Record session
    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "shadowing",
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
        mode: "shadowing",
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
                <Mic size={32} color="white" />
              </MotiView>
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Shadowing
            </Text>
            <Text className="text-ink-500 dark:text-ink-400 mt-2 text-center px-4">
              Listen to native pronunciation and repeat aloud. Self-assess your
              speaking accuracy.
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

          {/* Playback Speed */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Playback Speed
            </Text>
            <View className="flex-row justify-center gap-2">
              {PLAYBACK_SPEEDS.map((speed) => (
                <Pressable
                  key={speed}
                  onPress={() => {
                    setLocalSpeechRate(speed);
                    setSpeechRate(speed);
                    triggerHaptic("light");
                  }}
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor:
                      localSpeechRate === speed
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
                        localSpeechRate === speed
                          ? "#fff"
                          : isDark
                            ? "#d1d5db"
                            : "#6b7280",
                    }}
                  >
                    {speed}x
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
                {wordCount} words
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Volume2 size={16} color="#6b7280" />
              <Text className="text-sm text-ink-500 dark:text-ink-400">
                {localSpeechRate}x speed
              </Text>
            </View>
          </View>

          {/* Start */}
          <Pressable
            onPress={startPractice}
            className="rounded-2xl py-3.5 items-center justify-center active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white text-lg font-bold">
              Start Shadowing
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Results Phase ────────────────────────────────────────
  if (phase === "results") {
    const perfectCount = records.filter((r) => r.quality === 5).length;
    const goodCount = records.filter((r) => r.quality === 3).length;
    const needsWorkCount = records.filter((r) => r.quality === 1).length;
    const accuracy =
      records.length > 0
        ? Math.round((perfectCount / records.length) * 100)
        : 0;

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
              Shadowing Complete!
            </Text>

            <View className="flex-row justify-center gap-6 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-green-500">
                  {perfectCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Perfect
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-amber-500">
                  {goodCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Good
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-500">
                  {needsWorkCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Needs Work
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
                  {records.length} words practiced
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

          {/* Word Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Word Review
            </Text>
            {records.map((record, i) => {
              const bgColor =
                record.quality === 5
                  ? "bg-green-50 dark:bg-green-900/10"
                  : record.quality === 3
                    ? "bg-amber-50 dark:bg-amber-900/10"
                    : "bg-red-50 dark:bg-red-900/10";

              const Icon =
                record.quality === 5
                  ? Star
                  : record.quality === 3
                    ? ThumbsUp
                    : Meh;
              const iconColor =
                record.quality === 5
                  ? "#22c55e"
                  : record.quality === 3
                    ? "#f59e0b"
                    : "#ef4444";

              return (
                <View
                  key={i}
                  className={`flex-row items-center gap-3 p-3 rounded-xl mb-2 ${bgColor}`}
                >
                  <Icon size={18} color={iconColor} />
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink-900 dark:text-white">
                      {record.word.chinese}
                    </Text>
                    <Text className="text-sm text-ink-500 dark:text-ink-400">
                      {record.word.pinyin} · {record.word.english}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: `${iconColor}20`,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: iconColor }}
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
              setShowMeaning(false);
              setIsPlaying(false);
              sessionStartRef.current = Date.now();
              const shuffled = shuffleArray(words);
              const selected = shuffled.slice(
                0,
                Math.min(wordCount, words.length),
              );
              setPracticeWords(selected);
              triggerHaptic("light");
              setTimeout(() => playWord(selected[0]), 400);
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
  const perfectCount = records.filter((r) => r.quality === 5).length;

  if (!currentWord) return null;

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
              Shadowing
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

        {/* Word Card */}
        <MotiView
          key={currentWord.id}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl py-10 px-4 items-center mb-5 shadow-sm"
        >
          <Text className="text-5xl font-bold text-ink-900 dark:text-white mb-3">
            {currentWord.chinese}
          </Text>
          <Text className="text-2xl text-ink-500 dark:text-ink-400 mb-6">
            {currentWord.pinyin}
          </Text>

          {/* Play / Replay button */}
          <Pressable
            onPress={handleReplay}
            disabled={isPlaying}
            className={`w-20 h-20 rounded-full items-center justify-center active:opacity-80 ${
              isPlaying ? "opacity-60" : ""
            }`}
            style={{
              backgroundColor: levelColor,
              shadowColor: levelColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {isPlaying ? (
              <Volume2 size={32} color="white" />
            ) : (
              <Play size={32} color="white" style={{ marginLeft: 3 }} />
            )}
          </Pressable>

          <Text className="mt-3 text-sm text-ink-400 dark:text-ink-500">
            {isPlaying ? "Speaking..." : "Tap to listen again"}
          </Text>

          {/* English meaning (shown after assessment) */}
          {showMeaning && (
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 200 }}
              className="mt-4 py-3 px-6 rounded-xl"
              style={{
                backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
              }}
            >
              <Text className="text-lg font-semibold text-ink-700 dark:text-ink-300 text-center">
                {currentWord.english}
              </Text>
              {currentWord.pos.length > 0 && (
                <Text className="text-xs text-ink-400 dark:text-ink-500 mt-1 text-center">
                  {currentWord.pos.join(" · ")}
                </Text>
              )}
            </MotiView>
          )}
        </MotiView>

        {/* Assessment Buttons */}
        {!showMeaning ? (
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
              <Star size={22} color="white" />
              <Text className="text-white font-bold text-sm mt-1">Perfect</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAssess(3)}
              className="flex-1 py-4 rounded-2xl items-center active:opacity-80"
              style={{
                backgroundColor: "#f59e0b",
                shadowColor: "#f59e0b",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <ThumbsUp size={22} color="white" />
              <Text className="text-white font-bold text-sm mt-1">Good</Text>
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
              <Meh size={22} color="white" />
              <Text className="text-white font-bold text-sm mt-1">
                Needs Work
              </Text>
            </Pressable>
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200 }}
          >
            <Pressable
              onPress={goNext}
              className="rounded-2xl py-3.5 items-center justify-center mb-5 active:opacity-80"
              style={{ backgroundColor: levelColor }}
            >
              <Text className="text-white font-semibold text-base">
                {currentIndex < practiceWords.length - 1
                  ? "Next Word"
                  : "See Results"}
              </Text>
            </Pressable>
          </MotiView>
        )}

        {/* Speed Indicator */}
        <View className="flex-row justify-center gap-2 mb-5">
          <View
            className="px-3 py-1 rounded-lg"
            style={{
              backgroundColor: isDark ? "#1f2937" : "rgba(0,0,0,0.05)",
            }}
          >
            <Text className="text-xs text-ink-500 dark:text-ink-400">
              Speed: {localSpeechRate}x
            </Text>
          </View>
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
                {perfectCount}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Perfect
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-amber-500">
                {records.filter((r) => r.quality === 3).length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Good
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-red-500">
                {records.filter((r) => r.quality === 1).length}
              </Text>
              <Text className="text-xs text-ink-400 dark:text-ink-500">
                Needs Work
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}