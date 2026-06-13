import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Heart,
  BookCheck,
  Volume2,
  Shuffle,
  ArrowRight,
  RotateCcw,
} from "lucide-react-native";

import { useColorScheme } from "nativewind";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { speak } from "@/services/speech";
import { gradeSRS } from "@/utils/srs";
import type { Word, UserProgress, HSKLevel, MasteryLevel } from "@/types";

type FlashcardMode = "zh-en" | "en-zh" | "zh-py";

const MODE_OPTIONS: { id: FlashcardMode; label: string }[] = [
  { id: "zh-en", label: "ZH → EN" },
  { id: "en-zh", label: "EN → ZH" },
  { id: "zh-py", label: "ZH → PY" },
];

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

const MASTERY_COLORS = [
  "#d1d5db",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#8b5cf6",
];
const MASTERY_LABELS = ["New", "L1", "L2", "L3", "L4", "L5"];

export default function FlashcardMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { speechRate, hapticsEnabled } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [words, setWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<Map<string, UserProgress>>(
    new Map(),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [lovedWords, setLovedWords] = useState<Set<string>>(new Set());
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [cardMode, setCardMode] = useState<FlashcardMode>("zh-en");
  const [isRandom, setIsRandom] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const originalWords = useRef<Word[]>([]);
  const sessionStartRef = useRef(Date.now());

  const userId = user?.id || "guest";
  const levelColor = LEVEL_COLORS[selectedLevel] || "#8b5cf6";

  // Record session, streak, and leaderboard on unmount
  useEffect(() => {
    return () => {
      if (sessionStats.reviewed > 0) {
        const duration = Math.round(
          (Date.now() - sessionStartRef.current) / 1000,
        );
        const accuracy =
          sessionStats.reviewed > 0
            ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
            : 0;
        ds.sessions
          .record({
            user_id: userId,
            mode: "flashcard",
            words_studied: sessionStats.reviewed,
            accuracy,
            duration,
            date: new Date().toISOString(),
          })
          .catch(() => {});
        ds.profiles.updateStreak(userId).catch(() => {});
        const leaderboardScore = sessionStats.reviewed * 10 * (accuracy / 100);
        ds.leaderboard
          .addEntry({
            user_id: userId,
            username: user?.username || "Guest",
            score: Math.max(0, leaderboardScore),
            accuracy,
            mode: "flashcard",
          })
          .catch(() => {});
      }
    };
  }, [sessionStats.reviewed, sessionStats.correct, userId]);

  // Reset session timer on level change
  useEffect(() => {
    sessionStartRef.current = Date.now();
    setSessionStats({ reviewed: 0, correct: 0 });
  }, [selectedLevel]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setIsFlipped(false);
        const allWords = await ds.vocab.getWordsByLevel(selectedLevel);
        if (!mounted) return;
        originalWords.current = allWords;
        setWords(allWords);
        setCurrentIndex(0);
        setCardKey((k) => k + 1);

        // Load progress in background (non-blocking)
        const progressMap = new Map<string, UserProgress>();
        const learned = new Set<string>();
        setProgress(progressMap);
        setLearnedWords(learned);

        // Fetch progress for each word (but don't block rendering)
        for (const w of allWords) {
          try {
            const p = await ds.progress.getForUser(userId, w.id);
            if (p && mounted) {
              progressMap.set(w.id, p);
              if (p.mastery_level >= 3) learned.add(w.id);
            }
          } catch {
            /* skip */
          }
        }
        if (mounted) {
          setProgress(new Map(progressMap));
          setLearnedWords(new Set(learned));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedLevel, userId]);

  const toggleRandom = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRandom) {
      setWords([...originalWords.current]);
    } else {
      const shuffled = [...words];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setWords(shuffled);
    }
    setIsRandom(!isRandom);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardKey((k) => k + 1);
  };

  const currentWord = words[currentIndex];
  const currentProgress = currentWord
    ? (progress.get(currentWord.id) ?? null)
    : null;

  const handleFlip = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    setIsFlipped(!isFlipped);
  };

  const handleSpeak = useCallback(
    (chinese: string, wordId: string) => {
      setSpeakingId(wordId);
      speak(chinese, { rate: speechRate })
        .catch(() => {})
        .finally(() => setSpeakingId(null));
    },
    [speechRate],
  );

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      if (hapticsEnabled) Haptics.selectionAsync();
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setCardKey((k) => k + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      if (hapticsEnabled) Haptics.selectionAsync();
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setCardKey((k) => k + 1);
    }
  };

  const toggleLove = () => {
    if (!currentWord) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLovedWords((prev) => {
      const next = new Set(prev);
      if (next.has(currentWord.id)) next.delete(currentWord.id);
      else next.add(currentWord.id);
      return next;
    });
  };

  const toggleLearned = () => {
    if (!currentWord) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLearnedWords((prev) => {
      const next = new Set(prev);
      if (next.has(currentWord.id)) next.delete(currentWord.id);
      else next.add(currentWord.id);
      return next;
    });
  };

  const handleAnswer = async (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!currentWord) return;
    if (hapticsEnabled) {
      if (quality < 3)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const prevP = currentProgress;
    const srsResult = gradeSRS(
      {
        easinessFactor: prevP?.easiness_factor ?? 2.5,
        interval: prevP?.interval ?? 1,
        reviewCount: prevP?.review_count ?? 0,
      },
      prevP?.correct_count ?? 0,
      quality,
    );

    const newProgress: Omit<UserProgress, "id"> = {
      user_id: userId,
      word_id: currentWord.id,
      mastery_level: srsResult.mastery_level,
      easiness_factor: srsResult.easiness_factor,
      interval: srsResult.interval,
      next_review: srsResult.next_review,
      review_count: srsResult.review_count,
      correct_count: srsResult.correct_count,
      last_reviewed: srsResult.last_reviewed,
    };

    try {
      const saved = await ds.progress.upsert(newProgress);
      const newProgressMap = new Map(progress);
      newProgressMap.set(currentWord.id, saved);
      setProgress(newProgressMap);

      if (srsResult.mastery_level >= 3) {
        setLearnedWords((prev) => new Set(prev).add(currentWord.id));
      }
    } catch (e) {
      console.error("Failed to save progress:", e);
    }

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: quality >= 3 ? prev.correct + 1 : prev.correct,
    }));

    setIsFlipped(false);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCardKey((k) => k + 1);
    }
  };

  const answerButtons = [
    { quality: 1 as const, label: "Again", sublabel: "< 1 min", bg: "#ef4444" },
    { quality: 2 as const, label: "Hard", sublabel: "6 min", bg: "#f59e0b" },
    { quality: 3 as const, label: "Good", sublabel: "1 day", bg: "#10b981" },
    { quality: 4 as const, label: "Easy", sublabel: "3 days", bg: "#8b5cf6" },
  ];

  const posText = currentWord
    ? Array.isArray(currentWord.pos)
      ? currentWord.pos.join(" · ")
      : String(currentWord.pos || "")
    : "";

  // ── Loading / empty states ──

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ActivityIndicator size="large" color={levelColor} />
        <Text className="mt-3 text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500">
          Loading HSK {selectedLevel}...
        </Text>
      </SafeAreaView>
    );
  }

  if (words.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
        edges={["bottom"]}
      >
        <Layers size={48} color="#9ca3af" />
        <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
          No Words Available
        </Text>
        <Text className="text-ink-500 dark:text-ink-400 dark:text-ink-500 mt-2 text-center">
          No words found for HSK {selectedLevel}. Try a different level.
        </Text>
      </SafeAreaView>
    );
  }

  const isLoved = currentWord ? lovedWords.has(currentWord.id) : false;
  const isLearned = currentWord ? learnedWords.has(currentWord.id) : false;
  const progressPercent = ((currentIndex + 1) / words.length) * 100;
  const accuracy =
    sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0;

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Level picker ── */}
        <View className="flex-row items-center justify-center gap-2 px-4 pt-3 pb-1">
          {HSK_LEVELS.map((lvl) => (
            <Pressable
              key={lvl}
              onPress={() => {
                if (hapticsEnabled) Haptics.selectionAsync();
                setSelectedLevel(lvl);
              }}
              className="px-4 py-2 rounded-2xl active:opacity-80"
              style={{
                backgroundColor:
                  selectedLevel === lvl
                    ? LEVEL_COLORS[lvl]
                    : isDark
                      ? "#1f2937"
                      : "rgba(0,0,0,0.05)",
                shadowColor:
                  selectedLevel === lvl ? LEVEL_COLORS[lvl] : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: selectedLevel === lvl ? 0.35 : 0,
                shadowRadius: 6,
                elevation: selectedLevel === lvl ? 4 : 0,
              }}
            >
              <Text
                className="text-xs font-bold"
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

        <View className="px-4 flex-1">
          {/* ── Header ── */}
          <View className="flex-row items-center justify-between mt-3">
            <View>
              <Text className="text-xl font-bold text-ink-900 dark:text-white">
                Flashcards
              </Text>
              <Text className="text-sm text-ink-500 dark:text-ink-400 dark:text-ink-500">
                HSK {selectedLevel} · Card {currentIndex + 1}/{words.length}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-ink-400 dark:text-ink-500 dark:text-ink-500">
                Accuracy
              </Text>
              <Text className="text-lg font-bold" style={{ color: levelColor }}>
                {accuracy}%
              </Text>
            </View>
          </View>

          {/* ── Mode pills + Random ── */}
          <View className="flex-row items-center justify-center gap-2 mt-4">
            {MODE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => {
                  if (hapticsEnabled) Haptics.selectionAsync();
                  setCardMode(opt.id);
                  setIsFlipped(false);
                }}
                className="px-3 py-1.5 rounded-xl active:opacity-80"
                style={{
                  backgroundColor:
                    cardMode === opt.id
                      ? levelColor
                      : isDark
                        ? "#1f2937"
                        : "rgba(0,0,0,0.05)",
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color:
                      cardMode === opt.id
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
            <View className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
            <Pressable
              onPress={toggleRandom}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:opacity-80"
              style={{
                backgroundColor: isRandom
                  ? levelColor
                  : isDark
                    ? "#1f2937"
                    : "rgba(0,0,0,0.05)",
              }}
            >
              {isRandom ? (
                <Shuffle size={14} color="#fff" />
              ) : (
                <ArrowRight size={14} color={isDark ? "#d1d5db" : "#6b7280"} />
              )}
              <Text
                className="text-xs font-semibold"
                style={{
                  color: isRandom ? "#fff" : isDark ? "#d1d5db" : "#6b7280",
                }}
              >
                Shuffle
              </Text>
            </Pressable>
          </View>

          {/* ── Progress bar ── */}
          <View className="h-2 bg-ink-200/50 dark:bg-ink-700/50 rounded-full overflow-hidden mt-4">
            <MotiView
              from={{ width: "0%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "timing", duration: 300 }}
              className="h-full rounded-full"
              style={{ backgroundColor: levelColor }}
            />
          </View>

          {/* ── Card ── */}
          <MotiView
            key={cardKey}
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 250 }}
            className="mt-5"
          >
            <Pressable onPress={handleFlip} className="active:opacity-90">
              <View
                className="rounded-3xl items-center justify-center px-6 py-10 min-h-[260px]"
                style={{
                  backgroundColor: isFlipped
                    ? isDark
                      ? "#111827"
                      : "#fff"
                    : isDark
                      ? "#1a1025"
                      : "#faf5ff",
                  shadowColor: levelColor,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 6,
                  borderWidth: 1,
                  borderColor: isFlipped
                    ? isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)"
                    : levelColor + "33",
                }}
              >
                {!isFlipped ? (
                  // ── FRONT ──
                  <View className="items-center justify-center">
                    {cardMode === "zh-en" && (
                      <>
                        <Text className="text-6xl font-bold text-ink-900 dark:text-white tracking-wider">
                          {currentWord.chinese}
                        </Text>
                        <Text className="mt-4 text-ink-400 dark:text-ink-500 text-sm">
                          Tap to reveal English
                        </Text>
                      </>
                    )}
                    {cardMode === "en-zh" && (
                      <>
                        <Text className="text-2xl font-semibold text-ink-900 dark:text-white text-center px-4">
                          {currentWord.english}
                        </Text>
                        <Text className="mt-4 text-ink-400 dark:text-ink-500 text-sm">
                          Tap to reveal Chinese
                        </Text>
                      </>
                    )}
                    {cardMode === "zh-py" && (
                      <>
                        <Text className="text-6xl font-bold text-ink-900 dark:text-white tracking-wider">
                          {currentWord.chinese}
                        </Text>
                        <Text className="mt-4 text-ink-400 dark:text-ink-500 text-sm">
                          Tap to reveal Pinyin
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  // ── BACK ──
                  <View className="items-center justify-center">
                    {cardMode === "zh-en" && (
                      <>
                        <Text className="text-2xl font-semibold text-ink-600 dark:text-ink-300 mb-3">
                          {currentWord.pinyin}
                        </Text>
                        <Text className="text-xl font-bold text-ink-900 dark:text-white text-center">
                          {currentWord.english}
                        </Text>
                        {posText ? (
                          <Text className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                            {posText}
                          </Text>
                        ) : null}
                      </>
                    )}
                    {cardMode === "en-zh" && (
                      <>
                        <Text className="text-5xl font-bold text-ink-900 dark:text-white tracking-wider">
                          {currentWord.chinese}
                        </Text>
                        <Text className="text-xl font-semibold mt-3 text-ink-600 dark:text-ink-300">
                          {currentWord.pinyin}
                        </Text>
                        {posText ? (
                          <Text className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                            {posText}
                          </Text>
                        ) : null}
                      </>
                    )}
                    {cardMode === "zh-py" && (
                      <>
                        <Text className="text-3xl font-bold text-ink-600 dark:text-ink-300 mb-3">
                          {currentWord.pinyin}
                        </Text>
                        <Text className="text-lg font-semibold text-ink-900 dark:text-white text-center">
                          {currentWord.english}
                        </Text>
                        {posText ? (
                          <Text className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                            {posText}
                          </Text>
                        ) : null}
                      </>
                    )}

                    {/* Speak button */}
                    <Pressable
                      onPress={() =>
                        handleSpeak(currentWord.chinese, currentWord.id)
                      }
                      className="mt-4 p-3 rounded-2xl active:opacity-70"
                      style={{
                        backgroundColor:
                          speakingId === currentWord.id
                            ? levelColor + "22"
                            : isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.04)",
                      }}
                    >
                      <Volume2
                        size={22}
                        color={
                          speakingId === currentWord.id ? levelColor : "#9ca3af"
                        }
                      />
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          </MotiView>

          {/* ── Nav + action buttons ── */}
          <View className="flex-row items-center justify-between mt-4">
            <Pressable
              onPress={goPrev}
              disabled={currentIndex === 0}
              className="p-3 rounded-xl active:opacity-70"
            >
              <ChevronLeft
                size={24}
                color={
                  currentIndex === 0
                    ? "#d1d5db"
                    : isDark
                      ? "#d1d5db"
                      : "#6b7280"
                }
              />
            </Pressable>

            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={toggleLove}
                className="p-2.5 rounded-xl active:opacity-70"
              >
                <Heart
                  size={24}
                  color={isLoved ? "#ef4444" : "#9ca3af"}
                  fill={isLoved ? "#ef4444" : "transparent"}
                />
              </Pressable>
              <Pressable
                onPress={toggleLearned}
                className="p-2.5 rounded-xl active:opacity-70"
              >
                <BookCheck
                  size={24}
                  color={isLearned ? "#10b981" : "#9ca3af"}
                  fill={isLearned ? "#10b981" : "transparent"}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={goNext}
              disabled={currentIndex === words.length - 1}
              className="p-3 rounded-xl active:opacity-70"
            >
              <ChevronRight
                size={24}
                color={
                  currentIndex === words.length - 1
                    ? "#d1d5db"
                    : isDark
                      ? "#d1d5db"
                      : "#6b7280"
                }
              />
            </Pressable>
          </View>

          {/* ── SRS answer buttons (only when flipped) ── */}
          {isFlipped && (
            <MotiView
              from={{ opacity: 0, translateY: 15 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 200 }}
              className="flex-row gap-2 mt-4"
            >
              {answerButtons.map((btn) => (
                <Pressable
                  key={btn.quality}
                  onPress={() => handleAnswer(btn.quality)}
                  className="flex-1 py-3.5 px-2 rounded-2xl items-center active:opacity-80"
                  style={{
                    backgroundColor: btn.bg,
                    shadowColor: btn.bg,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text className="font-bold text-sm text-white">
                    {btn.label}
                  </Text>
                  <Text className="text-[10px] text-white/70 mt-0.5">
                    {btn.sublabel}
                  </Text>
                </Pressable>
              ))}
            </MotiView>
          )}

          {/* ── Mastery level dots ── */}
          <View className="flex-row justify-center gap-4 mt-5 mb-6">
            {[0, 1, 2, 3, 4, 5].map((level) => {
              const count = Array.from(progress.values()).filter(
                (p) => p.mastery_level === (level as MasteryLevel),
              ).length;
              return (
                <View key={level} className="items-center gap-1">
                  <View
                    className="w-3.5 h-3.5 rounded-full"
                    style={{
                      backgroundColor: MASTERY_COLORS[level],
                      shadowColor: MASTERY_COLORS[level],
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                  />
                  <Text className="text-[9px] text-ink-400 dark:text-ink-500 dark:text-ink-500">
                    {MASTERY_LABELS[level]}
                  </Text>
                  <Text className="text-[10px] font-semibold text-ink-600 dark:text-ink-300 dark:text-ink-300">
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
