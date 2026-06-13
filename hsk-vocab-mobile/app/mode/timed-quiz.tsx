import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  Timer,
  CheckCircle,
  XCircle,
  Share2,
  RotateCcw,
  Trophy,
  Clock,
  Target,
  Zap,
  ChevronRight,
} from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import { speak } from "@/services/speech";
import type { Word, UserProgress, HSKLevel } from "@/types";

const QUESTION_COUNTS = [10, 15, 20, 25, 30];
const TIMER_OPTIONS = [5, 10, 15, 30];

type QuizPhase = "setup" | "playing" | "result";
type QuizMode = "zh-en" | "en-zh" | "py-zh";

const QUIZ_MODE_OPTIONS: { id: QuizMode; label: string; prompt: string }[] = [
  { id: "zh-en", label: "ZH → EN", prompt: "What does this mean?" },
  { id: "en-zh", label: "EN → ZH", prompt: "Which character matches this?" },
  {
    id: "py-zh",
    label: "PY → ZH",
    prompt: "Which character sounds like this?",
  },
];

interface QuestionResult {
  word: Word;
  correct: boolean;
  timeTaken: number;
  userAnswer: string;
}

export default function TimedQuizMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();

  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [questionCount, setQuestionCount] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState(5);
  const [quizMode, setQuizMode] = useState<QuizMode>("zh-en");
  const [currentQuestion, setCurrentQuestion] = useState<Word | null>(null);
  const [options, setOptions] = useState<
    { text: string; isCorrect: boolean }[]
  >([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<Map<string, UserProgress>>(
    new Map(),
  );
  const questionStartTime = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const advanceQuestionRef = useRef<() => void>(() => {});

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

  // Load words for selected level
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const levelWords = await ds.vocab.getWordsByLevel(selectedLevel);
        if (mounted) setWords(levelWords);
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
  }, [selectedLevel, ds.vocab]);

  // Record session on unmount
  useEffect(() => {
    return () => {
      if (results.length > 0) {
        const duration = Math.round(
          (Date.now() - sessionStartRef.current) / 1000,
        );
        const accuracy =
          results.length > 0
            ? Math.round(
                (results.filter((r) => r.correct).length / results.length) *
                  100,
              )
            : 0;
        ds.sessions
          .record({
            user_id: user?.id || "guest",
            mode: "timed-quiz",
            words_studied: results.length,
            accuracy,
            duration,
            date: new Date().toISOString(),
          })
          .catch(() => {});
      }
    };
  }, []);

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateQuestion = useCallback(
    (qWords: Word[], qNum: number) => {
      if (qWords.length < 4 || qNum >= qWords.length) return;

      const correctWord = qWords[qNum];
      const otherWords = words.filter((w) => w.id !== correctWord.id);
      const wrongWords = shuffleArray(otherWords).slice(0, 3);

      let questionOptions: { text: string; isCorrect: boolean }[];

      if (quizMode === "en-zh") {
        questionOptions = shuffleArray([
          { text: correctWord.chinese, isCorrect: true },
          ...wrongWords.map((w) => ({ text: w.chinese, isCorrect: false })),
        ]);
      } else if (quizMode === "py-zh") {
        questionOptions = shuffleArray([
          { text: correctWord.chinese, isCorrect: true },
          ...wrongWords.map((w) => ({ text: w.chinese, isCorrect: false })),
        ]);
      } else {
        questionOptions = shuffleArray([
          { text: correctWord.english, isCorrect: true },
          ...wrongWords.map((w) => ({ text: w.english, isCorrect: false })),
        ]);
      }

      setCurrentQuestion(correctWord);
      setOptions(questionOptions);
      setTimeLeft(timerSeconds);
      setSelectedAnswer(null);
      setShowNext(false);
      questionStartTime.current = Date.now();
    },
    [words, timerSeconds, quizMode],
  );

  // Countdown timer
  useEffect(() => {
    if (phase === "playing" && timeLeft > 0 && selectedAnswer === null) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, timeLeft, selectedAnswer]);

  const handleTimeout = () => {
    if (!currentQuestion || selectedAnswer !== null) return;
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    setSelectedAnswer("__timeout__");
    triggerHaptic("error");
    setResults((prev) => [
      ...prev,
      {
        word: currentQuestion,
        correct: false,
        timeTaken,
        userAnswer: "(timeout)",
      },
    ]);
    setTimeout(() => setShowNext(true), 1500);
  };

  const handleAnswer = async (answer: string, correct: boolean) => {
    if (!currentQuestion || selectedAnswer !== null) return;

    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    setSelectedAnswer(answer);

    if (correct) {
      const timeBonus = Math.round((timeLeft / timerSeconds) * 10);
      setScore((prev) => prev + 10 + timeBonus);
      setCorrectCount((prev) => prev + 1);
      triggerHaptic("success");
    } else {
      triggerHaptic("error");
    }

    setResults((prev) => [
      ...prev,
      {
        word: currentQuestion,
        correct,
        timeTaken,
        userAnswer: answer || "(timeout)",
      },
    ]);

    // Update SRS progress
    if (currentQuestion) {
      const quality = correct ? 4 : 1;
      const existingProgress = progress.get(currentQuestion.id);
      const srsParams = existingProgress
        ? {
            easinessFactor: existingProgress.easiness_factor,
            interval: existingProgress.interval,
            reviewCount: existingProgress.review_count,
          }
        : { easinessFactor: 2.5, interval: 0, reviewCount: 0 };

      const updated = gradeSRS(
        srsParams,
        existingProgress?.correct_count ?? 0,
        quality as 0 | 1 | 2 | 3 | 4 | 5,
      );

      try {
        const upserted = await ds.progress.upsert({
          user_id: user?.id || "guest",
          word_id: currentQuestion.id,
          mastery_level: updated.mastery_level,
          last_reviewed: updated.last_reviewed,
          next_review: updated.next_review,
          review_count: updated.review_count,
          correct_count: updated.correct_count,
          easiness_factor: updated.easiness_factor,
          interval: updated.interval,
        });
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(currentQuestion.id, upserted);
          return next;
        });
      } catch (e) {
        console.error("Failed to update progress:", e);
      }
    }

    if (correct) {
      setTimeout(() => advanceQuestionRef.current(), 500);
    } else {
      setTimeout(() => setShowNext(true), 1500);
    }
  };

  const advanceQuestion = () => {
    const nextNum = questionNumber + 1;
    if (nextNum >= questionCount) {
      endGame();
    } else {
      setQuestionNumber(nextNum);
      generateQuestion(quizWords, nextNum);
    }
  };
  advanceQuestionRef.current = advanceQuestion;

  const startGame = () => {
    const shuffled = shuffleArray(words);
    const selected = shuffled.slice(0, Math.min(questionCount, words.length));
    setQuizWords(selected);
    setScore(0);
    setCorrectCount(0);
    setQuestionNumber(0);
    setResults([]);
    sessionStartRef.current = Date.now();
    setPhase("playing");
    generateQuestion(selected, 0);
    triggerHaptic("light");
  };

  const endGame = async () => {
    setPhase("result");
    triggerHaptic("medium");

    // Record study session
    try {
      const duration = Math.round(
        (Date.now() - sessionStartRef.current) / 1000,
      );
      const finalResults = results;
      const finalCorrect = finalResults.filter((r) => r.correct).length;
      const accuracy =
        finalResults.length > 0
          ? Math.round((finalCorrect / finalResults.length) * 100)
          : 0;
      const userId = user?.id || "guest";

      await ds.sessions.record({
        user_id: userId,
        mode: "timed-quiz",
        words_studied: finalResults.length,
        accuracy,
        duration,
        date: new Date().toISOString(),
      });

      await ds.profiles.updateStreak(userId);

      const leaderboardScore =
        finalResults.length * 10 * (accuracy / 100) +
        Math.max(0, Math.round((30 - duration / finalResults.length) * 0.5));
      await ds.leaderboard.addEntry({
        user_id: userId,
        username: user?.username || "Guest",
        score: Math.max(0, leaderboardScore),
        accuracy,
        mode: "timed-quiz",
      });
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  const shareResult = async () => {
    const accuracy =
      questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
    const avgTime =
      results.length > 0
        ? (
            results.reduce((sum, r) => sum + r.timeTaken, 0) / results.length
          ).toFixed(1)
        : "0";
    const shareText = `🎯 HSK ${selectedLevel} Timed Quiz\n✅ ${correctCount}/${questionCount} correct (${accuracy}%)\n⏱️ Avg: ${avgTime}s per question\n🏆 Score: ${score} pts\n\nTry it yourself!`;

    await Clipboard.setStringAsync(shareText);
    Alert.alert("Copied!", "Quiz result copied to clipboard.");
  };

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ActivityIndicator size="large" color="#a855f7" />
      </SafeAreaView>
    );
  }

  // ─── Not enough words ──────────────────────────────────────
  if (words.length < 4) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
        edges={["bottom"]}
      >
        <Timer size={64} color="#9ca3af" />
        <Text className="text-xl font-semibold text-ink-900 dark:text-white mt-4">
          Not Enough Words
        </Text>
        <Text className="text-ink-500 dark:text-ink-400 mt-2 text-center">
          Need at least 4 words for a quiz. Try a different HSK level.
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Setup Phase ───────────────────────────────────────────
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
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: "#8b5cf6" }}
            >
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 500 }}
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: "#8b5cf6" }}
              >
                <Timer size={32} color="white" />
              </MotiView>
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Timed Quiz
            </Text>
            <Text className="text-ink-500 dark:text-ink-400 mt-2 text-center">
              Answer questions as fast as you can! Faster answers earn bonus
              points.
            </Text>
          </View>

          {/* Level Picker */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              HSK Level
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {([1, 2, 3, 4] as HSKLevel[]).map((level) => (
                <Pressable
                  key={level}
                  onPress={() => {
                    setSelectedLevel(level);
                    triggerHaptic("light");
                  }}
                  className={`px-4 py-2 rounded-xl ${
                    selectedLevel === level
                      ? "bg-brand-500"
                      : "bg-ink-100 dark:bg-ink-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedLevel === level
                        ? "text-white"
                        : "text-ink-600 dark:text-ink-300"
                    }`}
                  >
                    HSK {level}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            {/* Quiz Mode */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
                Quiz Mode
              </Text>
              <View className="flex-row justify-center gap-2">
                {QUIZ_MODE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setQuizMode(opt.id);
                      triggerHaptic("light");
                    }}
                    className={`px-4 py-2 rounded-xl ${
                      quizMode === opt.id
                        ? "bg-brand-500"
                        : "bg-ink-100 dark:bg-ink-800"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        quizMode === opt.id
                          ? "text-white"
                          : "text-ink-600 dark:text-ink-300"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Question Count */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
                Number of Questions
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
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

            {/* Timer */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
                Time per Question
              </Text>
              <View className="flex-row justify-center gap-2">
                {TIMER_OPTIONS.map((seconds) => (
                  <Pressable
                    key={seconds}
                    onPress={() => {
                      setTimerSeconds(seconds);
                      triggerHaptic("light");
                    }}
                    className={`px-4 py-2 rounded-xl ${
                      timerSeconds === seconds
                        ? "bg-brand-500"
                        : "bg-ink-100 dark:bg-ink-800"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        timerSeconds === seconds
                          ? "text-white"
                          : "text-ink-600 dark:text-ink-300"
                      }`}
                    >
                      {seconds}s
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
                <Clock size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  {timerSeconds}s each
                </Text>
              </View>
            </View>

            {/* Start */}
            <Pressable
              onPress={startGame}
              className="bg-brand-500 rounded-2xl py-3.5 items-center justify-center active:opacity-80"
            >
              <Text className="text-white text-lg font-bold">Start Quiz</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Result Phase ──────────────────────────────────────────
  if (phase === "result") {
    const accuracy =
      questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
    const avgTime =
      results.length > 0
        ? (
            results.reduce((sum, r) => sum + r.timeTaken, 0) / results.length
          ).toFixed(1)
        : "0";
    const grade =
      accuracy >= 90
        ? "S"
        : accuracy >= 80
          ? "A"
          : accuracy >= 70
            ? "B"
            : accuracy >= 60
              ? "C"
              : accuracy >= 50
                ? "D"
                : "F";
    const gradeColors: Record<string, string> = {
      S: "#8b5cf6",
      A: "#10b981",
      B: "#3b82f6",
      C: "#f59e0b",
      D: "#f97316",
      F: "#ef4444",
    };
    const gradeColor = gradeColors[grade];

    return (
      <SafeAreaView
        className="flex-1 bg-brand-50 dark:bg-ink-950"
        edges={["bottom"]}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Result card */}
          <View
            className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-4 shadow-sm"
            style={{ backgroundColor: "rgba(139,92,246,0.04)" }}
          >
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: gradeColor }}
            >
              <Trophy size={32} color="white" />
            </View>

            <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-4">
              Quiz Complete!
            </Text>

            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: gradeColor }}
            >
              <Text className="text-3xl font-bold text-white">{grade}</Text>
            </View>

            <View className="flex-row justify-center gap-6 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-brand-500">
                  {score}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Score
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-ink-900 dark:text-white">
                  {correctCount}/{questionCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Correct
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
                <Clock size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  Avg {avgTime}s
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Zap size={16} color="#6b7280" />
                <Text className="text-sm text-ink-500 dark:text-ink-400">
                  HSK {selectedLevel}
                </Text>
              </View>
            </View>
          </View>

          {/* Question Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Question Review
            </Text>
            <View className="max-h-60">
              {results.map((r, i) => (
                <View
                  key={i}
                  className={`flex-row items-center gap-3 p-2.5 rounded-xl mb-2 ${
                    r.correct
                      ? "bg-green-50 dark:bg-green-900/10"
                      : "bg-red-50 dark:bg-red-900/10"
                  }`}
                >
                  {r.correct ? (
                    <CheckCircle size={16} color="#22c55e" />
                  ) : (
                    <XCircle size={16} color="#ef4444" />
                  )}
                  <Text className="text-sm font-medium text-ink-900 dark:text-white">
                    {r.word.chinese}
                  </Text>
                  <Text
                    className="text-xs text-ink-500 dark:text-ink-400 flex-1"
                    numberOfLines={1}
                  >
                    {r.word.english}
                  </Text>
                  <Text className="text-xs text-ink-400 dark:text-ink-500">
                    {r.timeTaken.toFixed(1)}s
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Actions */}
          <Pressable
            onPress={shareResult}
            className="bg-brand-500 rounded-2xl py-3.5 flex-row items-center justify-center gap-2 mb-3 active:opacity-80"
          >
            <Share2 size={16} color="white" />
            <Text className="text-white font-semibold">Share</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPhase("setup");
              setResults([]);
              triggerHaptic("light");
            }}
            className="flex-row items-center justify-center gap-2 py-3 rounded-2xl active:opacity-60"
          >
            <RotateCcw size={16} color="#6b7280" />
            <Text className="text-sm font-semibold text-ink-500 dark:text-ink-400">
              New Quiz
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Playing Phase ─────────────────────────────────────────
  const timerBarColor =
    timeLeft <= 3 ? "#ef4444" : timeLeft <= 7 ? "#f59e0b" : "#8b5cf6";

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: question number, score, timer */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              Question {questionNumber + 1}/{questionCount}
            </Text>
            <Text className="text-2xl font-bold text-brand-500">
              {score} pts
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              {correctCount} ✓
            </Text>
            <Text
              className={`text-3xl font-bold ${
                timeLeft <= 3
                  ? "text-red-500"
                  : timeLeft <= 7
                    ? "text-amber-500"
                    : "text-ink-900 dark:text-white"
              }`}
            >
              {timeLeft}s
            </Text>
          </View>
        </View>

        {/* Timer progress bar */}
        <View className="h-2 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden mb-2">
          <MotiView
            from={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
            animate={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
            transition={{ type: "timing", duration: 500 }}
            className="h-full rounded-full"
            style={{ backgroundColor: timerBarColor }}
          />
        </View>

        {/* Question progress bar */}
        <View className="h-1.5 bg-ink-100/50 dark:bg-ink-700/50 rounded-full overflow-hidden mb-5">
          <View
            className="h-full rounded-full bg-ink-300 dark:bg-ink-600"
            style={{
              width: `${((questionNumber + 1) / questionCount) * 100}%`,
            }}
          />
        </View>

        {/* Question card */}
        <MotiView
          key={currentQuestion?.id}
          from={{ opacity: 0, translateX: 30 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-5 shadow-sm"
        >
          {quizMode === "zh-en" && (
            <>
              <Text className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">
                What does this mean?
              </Text>
              <Pressable
                onPress={() =>
                  currentQuestion &&
                  speak(currentQuestion.chinese).catch(() => {})
                }
              >
                <Text className="text-center text-5xl font-bold text-ink-900 dark:text-white">
                  {currentQuestion?.chinese}
                </Text>
              </Pressable>
              <Text className="mt-3 text-center text-lg text-ink-500 dark:text-ink-400">
                {currentQuestion?.pinyin}
              </Text>
            </>
          )}
          {quizMode === "en-zh" && (
            <>
              <Text className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">
                Which character matches this?
              </Text>
              <Text className="text-center text-2xl font-semibold text-ink-900 dark:text-white px-6">
                {currentQuestion?.english}
              </Text>
            </>
          )}
          {quizMode === "py-zh" && (
            <>
              <Text className="text-center text-sm text-ink-400 dark:text-ink-500 mb-2">
                Which character sounds like this?
              </Text>
              <Text className="text-center text-3xl font-semibold text-ink-900 dark:text-white">
                {currentQuestion?.pinyin}
              </Text>
            </>
          )}
        </MotiView>

        {/* Options grid */}
        <View className="flex-row flex-wrap gap-3">
          {options.map((option, index) => {
            const isSelected = selectedAnswer === option.text;
            const showCorrect = selectedAnswer !== null && option.isCorrect;
            const showWrong = isSelected && !option.isCorrect;
            const isChineseOption =
              quizMode === "en-zh" || quizMode === "py-zh";

            let bgClass = "bg-white dark:bg-ink-900";
            let textClass = "text-ink-900 dark:text-white";
            let badgeBg = "bg-ink-100 dark:bg-ink-700";
            let badgeText = "text-ink-600 dark:text-ink-300";

            if (showCorrect) {
              bgClass = "bg-green-500";
              textClass = "text-white";
              badgeBg = "bg-white/25";
              badgeText = "text-white";
            } else if (showWrong) {
              bgClass = "bg-red-500";
              textClass = "text-white";
              badgeBg = "bg-white/25";
              badgeText = "text-white";
            }

            return (
              <MotiView
                key={`${currentQuestion?.id}-${index}`}
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: "timing",
                  duration: 200,
                  delay: index * 50,
                }}
                className="w-[48%]"
              >
                <Pressable
                  onPress={() => handleAnswer(option.text, option.isCorrect)}
                  disabled={selectedAnswer !== null}
                  className={`p-4 rounded-2xl flex-row items-start gap-3 ${bgClass} active:opacity-80`}
                >
                  <View
                    className={`w-6 h-6 rounded-lg items-center justify-center ${badgeBg}`}
                  >
                    <Text className={`text-xs font-bold ${badgeText}`}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text
                    className={`flex-1 font-medium text-sm pt-0.5 ${textClass} ${isChineseOption ? "text-lg" : ""}`}
                    numberOfLines={2}
                  >
                    {option.text}
                  </Text>
                </Pressable>
              </MotiView>
            );
          })}
        </View>

        {/* Next / See Results button */}
        {showNext && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 200 }}
          >
            <Pressable
              onPress={() => advanceQuestionRef.current()}
              className="bg-brand-500 rounded-2xl py-3.5 flex-row items-center justify-center gap-2 mt-5 active:opacity-80"
            >
              <Text className="text-white text-base font-semibold">
                {questionNumber + 1 >= questionCount ? "See Results" : "Next"}
              </Text>
              <ChevronRight size={20} color="white" />
            </Pressable>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
