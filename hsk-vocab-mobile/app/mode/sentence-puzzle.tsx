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
  Puzzle,
  RotateCcw,
  Trophy,
  CheckCircle,
  XCircle,
  Delete,
} from "lucide-react-native";

import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import type { Word, HSKLevel } from "@/types";

type Phase = "setup" | "quiz" | "results";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const QUESTION_COUNTS = [5, 10, 15, 20];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

interface PuzzleData {
  word: Word;
  sentence: string;
  shuffledChars: string[];
  moves: number;
  quality: number;
}

export default function SentencePuzzleMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [questionCount, setQuestionCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [availableTiles, setAvailableTiles] = useState<string[]>([]);
  const [answerTiles, setAnswerTiles] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [puzzleResults, setPuzzleResults] = useState<PuzzleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const sessionStartRef = useRef(Date.now());
  const targetSentenceRef = useRef("");

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

  const getSentenceForWord = (word: Word): string => {
    const sentences = word.example_sentences;
    if (sentences && sentences.length > 0 && sentences[0].trim()) {
      return sentences[0].trim();
    }
    return word.chinese;
  };

  const getChars = (s: string): string[] => {
    return [...s].filter((c) => c.trim().length > 0);
  };

  const setupPuzzle = (word: Word) => {
    const sentence = getSentenceForWord(word);
    targetSentenceRef.current = sentence;
    const chars = getChars(sentence);
    let shuffled = shuffleArray(chars);
    // Ensure it's not accidentally in the same order
    if (shuffled.join("") === sentence && shuffled.length > 1) {
      shuffled = shuffleArray(shuffled);
    }
    setAvailableTiles(shuffled);
    setAnswerTiles([]);
    setMoves(0);
    setIsComplete(false);
    setValidating(false);
  };

  const startQuiz = () => {
    const shuffled = shuffleArray(words);
    const selected = shuffled.slice(0, Math.min(questionCount, words.length));
    setQuizWords(selected);
    setCurrentIndex(0);
    setPuzzleResults([]);
    sessionStartRef.current = Date.now();
    setupPuzzle(selected[0]);
    setPhase("quiz");
    triggerHaptic("light");
  };

  const handleTileTap = (tileIndex: number) => {
    if (isComplete) return;
    triggerHaptic("light");
    const char = availableTiles[tileIndex];
    setAvailableTiles((prev) => prev.filter((_, i) => i !== tileIndex));
    setAnswerTiles((prev) => [...prev, char]);
    setMoves((prev) => prev + 1);
  };

  const handleAnswerTileTap = (tileIndex: number) => {
    if (isComplete) return;
    triggerHaptic("light");
    const char = answerTiles[tileIndex];
    setAnswerTiles((prev) => prev.filter((_, i) => i !== tileIndex));
    setAvailableTiles((prev) => [...prev, char]);
    setMoves((prev) => prev + 1);
  };

  // Auto-check when answerTiles length matches target sentence length
  useEffect(() => {
    if (
      phase !== "quiz" ||
      isComplete ||
      validating ||
      answerTiles.length === 0
    )
      return;

    const target = targetSentenceRef.current;
    if (answerTiles.length !== getChars(target).length) return;

    const answerSentence = answerTiles.join("");

    if (answerSentence === target) {
      // Correct!
      setValidating(true);
      triggerHaptic("success");
      setTimeout(() => handleCorrect(), 400);
    }
  }, [answerTiles, isComplete, phase]);

  const handleCorrect = async () => {
    if (!currentWord || isComplete) return;
    setIsComplete(true);

    const targetChars = getChars(targetSentenceRef.current);
    const minMoves = targetChars.length;
    const extraMoves = Math.max(0, moves - minMoves);
    const quality: 0 | 1 | 2 | 3 | 4 | 5 = extraMoves === 0
      ? 5
      : extraMoves <= 2
        ? 4
        : extraMoves <= 5
          ? 3
          : 2;

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

    const result: PuzzleData = {
      word: currentWord,
      sentence: targetSentenceRef.current,
      shuffledChars: [...availableTiles, ...answerTiles],
      moves,
      quality,
    };

    const newResults = [...puzzleResults, result];
    setPuzzleResults(newResults);

    setTimeout(() => {
      if (currentIndex + 1 >= quizWords.length) {
        endQuiz(newResults);
      } else {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setupPuzzle(quizWords[nextIdx]);
      }
    }, 1200);
  };

  const endQuiz = async (finalResults: PuzzleData[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const duration = Math.round(
      (Date.now() - sessionStartRef.current) / 1000,
    );
    const correctCount = finalResults.filter(
      (r) => r.quality >= 3,
    ).length;
    const accuracy =
      finalResults.length > 0
        ? Math.round((correctCount / finalResults.length) * 100)
        : 0;

    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "sentence-puzzle",
        words_studied: finalResults.length,
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
        mode: "sentence-puzzle",
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
        <Puzzle size={48} color="#9ca3af" />
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
                <Puzzle size={32} color="white" />
              </View>
            </MotiView>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Sentence Puzzle
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Rearrange character tiles to form the correct Chinese sentence
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
              Number of Puzzles
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
            <Text className="text-white text-lg font-bold">Start Puzzle</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Results Phase ──
  if (phase === "results") {
    const correctCount = puzzleResults.filter((r) => r.quality >= 3).length;
    const accuracy =
      puzzleResults.length > 0
        ? Math.round((correctCount / puzzleResults.length) * 100)
        : 0;
    const totalMoves = puzzleResults.reduce((sum, r) => sum + r.moves, 0);
    const avgMoves =
      puzzleResults.length > 0
        ? (totalMoves / puzzleResults.length).toFixed(1)
        : "0";

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
              Puzzles Complete!
            </Text>

            <View className="flex-row justify-center gap-8 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-brand-500">
                  {correctCount}/{puzzleResults.length}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Solved
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
                  {avgMoves}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Avg Moves
                </Text>
              </View>
            </View>
          </View>

          {/* Puzzle Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Puzzle Review
            </Text>
            {puzzleResults.map((r, i) => (
              <View
                key={i}
                className={`p-3 rounded-xl mb-2 ${
                  r.quality >= 4
                    ? "bg-green-50 dark:bg-green-900/10"
                    : r.quality >= 3
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : "bg-red-50 dark:bg-red-900/10"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-1">
                  {r.quality >= 3 ? (
                    <CheckCircle size={14} color="#22c55e" />
                  ) : (
                    <XCircle size={14} color="#ef4444" />
                  )}
                  <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                    {r.word.chinese}
                  </Text>
                  <Text className="text-xs text-ink-400 dark:text-ink-500">
                    {r.moves} moves
                  </Text>
                </View>
                <Text
                  className="text-xs text-ink-500 dark:text-ink-400 pl-6"
                  numberOfLines={2}
                >
                  {r.sentence}
                </Text>
              </View>
            ))}
          </View>

          {/* Try Again */}
          <Pressable
            onPress={() => {
              setPhase("setup");
              setPuzzleResults([]);
              triggerHaptic("light");
            }}
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl active:opacity-60"
          >
            <RotateCcw size={16} color="#6b7280" />
            <Text className="text-sm font-semibold text-ink-500 dark:text-ink-400">
              New Puzzle Set
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
              Sentence Puzzle
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              Puzzle {currentIndex + 1} / {quizWords.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Moves
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {moves}
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

        {/* Word Context Card */}
        <MotiView
          key={currentWord?.id}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl p-5 items-center mb-5 shadow-sm"
        >
          <Text className="text-xs text-ink-400 dark:text-ink-500 mb-2">
            Arrange the sentence for:
          </Text>
          <Text className="text-4xl font-bold text-ink-900 dark:text-white tracking-wider mb-2">
            {currentWord?.chinese}
          </Text>
          <Text className="text-lg text-ink-500 dark:text-ink-400 mb-1">
            {currentWord?.pinyin}
          </Text>
          <Text className="text-base text-ink-600 dark:text-ink-300 text-center">
            {currentWord?.english}
          </Text>
          {posText ? (
            <Text className="text-xs text-ink-400 dark:text-ink-500 mt-1">
              {posText}
            </Text>
          ) : null}
        </MotiView>

        {/* Answer Area */}
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm min-h-[80px]">
          <Text className="text-xs text-ink-400 dark:text-ink-500 mb-3">
            Your answer (tap to remove):
          </Text>
          <View className="flex-row flex-wrap gap-2 justify-center">
            {answerTiles.length === 0 && !isComplete && (
              <Text className="text-sm text-ink-300 dark:text-ink-600 italic py-2">
                Tap characters below to build the sentence
              </Text>
            )}
            {answerTiles.map((char, i) => (
              <MotiView
                key={`ans-${i}`}
                from={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 200 }}
              >
                <Pressable
                  onPress={() => handleAnswerTileTap(i)}
                  className="w-11 h-11 rounded-xl items-center justify-center active:opacity-70"
                  style={{
                    backgroundColor: isComplete
                      ? "#22c55e"
                      : levelColor + "20",
                    borderWidth: 1,
                    borderColor: isComplete ? "#22c55e" : levelColor,
                  }}
                >
                  <Text
                    className="text-lg font-bold"
                    style={{
                      color: isComplete ? "#fff" : levelColor,
                    }}
                  >
                    {char}
                  </Text>
                </Pressable>
              </MotiView>
            ))}
          </View>
        </View>

        {/* Available Tiles */}
        {!isComplete && (
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-xs text-ink-400 dark:text-ink-500 mb-3">
              Available characters:
            </Text>
            <View className="flex-row flex-wrap gap-2 justify-center">
              {availableTiles.map((char, i) => (
                <MotiView
                  key={`avail-${i}-${char}`}
                  from={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 200, delay: i * 30 }}
                >
                  <Pressable
                    onPress={() => handleTileTap(i)}
                    className="w-11 h-11 rounded-xl items-center justify-center active:opacity-70"
                    style={{
                      backgroundColor: levelColor,
                      shadowColor: levelColor,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-lg font-bold text-white">
                      {char}
                    </Text>
                  </Pressable>
                </MotiView>
              ))}
            </View>
          </View>
        )}

        {/* Complete State */}
        {isComplete && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
            className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 items-center mb-4 border border-green-200 dark:border-green-800"
          >
            <CheckCircle size={40} color="#22c55e" />
            <Text className="text-lg font-bold text-green-700 dark:text-green-400 mt-2">
              Correct!
            </Text>
            <Text className="text-sm text-green-600 dark:text-green-400 text-center mt-1">
              You solved it in {moves} moves!
            </Text>
          </MotiView>
        )}

        {/* Undo All Button */}
        {!isComplete && answerTiles.length > 0 && (
          <Pressable
            onPress={() => {
              triggerHaptic("medium");
              setAvailableTiles((prev) => [...prev, ...answerTiles]);
              setAnswerTiles([]);
              setMoves((prev) => prev + answerTiles.length);
            }}
            className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-ink-100 dark:bg-ink-800 active:opacity-70"
          >
            <Delete size={16} color="#6b7280" />
            <Text className="text-sm font-semibold text-ink-500 dark:text-ink-400">
              Clear All
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}