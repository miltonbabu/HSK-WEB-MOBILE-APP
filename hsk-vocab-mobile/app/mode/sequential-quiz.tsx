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
  ListOrdered,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  HelpCircle,
} from "lucide-react-native";

import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { gradeSRS } from "@/utils/srs";
import type { Word, HSKLevel } from "@/types";

type Phase = "setup" | "quiz" | "results";
type QuizType = "mcq" | "pinyin" | "english" | "fillblank";

const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];
const QUESTION_COUNTS = [10, 15, 20, 25, 30];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6",
  2: "#ec4899",
  3: "#f59e0b",
  4: "#10b981",
};

const QUIZ_TYPES: QuizType[] = ["mcq", "pinyin", "english", "fillblank"];

const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  mcq: "Multiple Choice",
  pinyin: "Type Pinyin",
  english: "Type English",
  fillblank: "Fill Blank",
};

interface QuizQuestion {
  word: Word;
  type: QuizType;
  options?: { text: string; isCorrect: boolean }[];
}

interface AnswerRecord {
  word: Word;
  type: QuizType;
  userAnswer: string;
  isCorrect: boolean;
  quality: number;
}

export default function SequentialQuizMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [questionCount, setQuestionCount] = useState(10);
  const [words, setWords] = useState<Word[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedMcq, setSelectedMcq] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionKey, setQuestionKey] = useState(0);
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

  const generateQuestions = (selectedWords: Word[]): QuizQuestion[] => {
    return selectedWords.map((word, idx) => {
      // Cycle through quiz types
      const type = QUIZ_TYPES[idx % QUIZ_TYPES.length];

      const question: QuizQuestion = { word, type };

      if (type === "mcq") {
        const otherWords = words.filter((w) => w.id !== word.id);
        const wrongWords = shuffleArray(otherWords).slice(0, 3);
        question.options = shuffleArray([
          { text: word.english, isCorrect: true },
          ...wrongWords.map((w) => ({ text: w.english, isCorrect: false })),
        ]);
      }

      return question;
    });
  };

  const startQuiz = () => {
    const shuffled = shuffleArray(words);
    const selected = shuffled.slice(0, Math.min(questionCount, words.length));
    const questions = generateQuestions(selected);
    setQuizQuestions(questions);
    setCurrentIndex(0);
    setAnswers([]);
    setUserAnswer("");
    setSelectedMcq(null);
    setShowResult(false);
    setIsAnswerCorrect(false);
    setQuestionKey(0);
    sessionStartRef.current = Date.now();
    setPhase("quiz");
    triggerHaptic("light");
  };

  const normalizeAnswer = (s: string): string => {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
  };

  const checkAnswer = (
    type: QuizType,
    userInput: string,
    word: Word,
  ): boolean => {
    switch (type) {
      case "mcq":
        return normalizeAnswer(userInput) === normalizeAnswer(word.english);
      case "pinyin":
        return normalizeAnswer(userInput) === normalizeAnswer(word.pinyin);
      case "english":
        return normalizeAnswer(userInput) === normalizeAnswer(word.english);
      case "fillblank":
        return userInput.trim() === word.chinese;
      default:
        return false;
    }
  };

  const handleMcqSelect = (option: { text: string; isCorrect: boolean }) => {
    if (showResult) return;
    const correct = option.isCorrect;
    setSelectedMcq(option.text);
    setIsAnswerCorrect(correct);
    setShowResult(true);
    if (correct) {
      triggerHaptic("success");
    } else {
      triggerHaptic("error");
    }
  };

  const handleSubmit = () => {
    if (!userAnswer.trim() || showResult || !currentQuestion) return;
    const correct = checkAnswer(
      currentQuestion.type,
      userAnswer,
      currentQuestion.word,
    );
    setIsAnswerCorrect(correct);
    setShowResult(true);
    if (correct) {
      triggerHaptic("success");
    } else {
      triggerHaptic("error");
    }
  };

  const handleSelfAssessment = async (quality: number) => {
    if (!currentQuestion) return;

    const q = currentQuestion;
    const userInput =
      q.type === "mcq" ? selectedMcq || "" : userAnswer.trim();

    // Update SRS progress
    try {
      const existing = await ds.progress.getForUser(userId, q.word.id);
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
        quality as 0 | 1 | 2 | 3 | 4 | 5,
      );
      await ds.progress.upsert({
        user_id: userId,
        word_id: q.word.id,
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

    const record: AnswerRecord = {
      word: q.word,
      type: q.type,
      userAnswer: userInput,
      isCorrect: isAnswerCorrect,
      quality,
    };

    const newAnswers = [...answers, record];
    setAnswers(newAnswers);

    if (currentIndex + 1 >= quizQuestions.length) {
      endQuiz(newAnswers);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setUserAnswer("");
      setSelectedMcq(null);
      setShowResult(false);
      setIsAnswerCorrect(false);
      setQuestionKey((prev) => prev + 1);
    }
  };

  const endQuiz = async (finalAnswers: AnswerRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const duration = Math.round(
      (Date.now() - sessionStartRef.current) / 1000,
    );
    const correctCount = finalAnswers.filter(
      (a) => a.isCorrect || a.quality >= 3,
    ).length;
    const accuracy =
      finalAnswers.length > 0
        ? Math.round((correctCount / finalAnswers.length) * 100)
        : 0;

    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "sequential-quiz",
        words_studied: finalAnswers.length,
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
        mode: "sequential-quiz",
      });
    } catch (e) {
      console.error("Failed to record results:", e);
    }
  };

  const currentQuestion = quizQuestions[currentIndex];

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
  if (words.length < 4) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
        edges={["bottom"]}
      >
        <ListOrdered size={48} color="#9ca3af" />
        <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
          Not Enough Words
        </Text>
        <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
          Need at least 4 words for a quiz. Try a different HSK level.
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
                <ListOrdered size={32} color="white" />
              </View>
            </MotiView>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Sequential Quiz
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Mixed question types: MCQ, Pinyin, English, and Fill Blank. No
              timer — take your time!
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

          {/* Quiz Type Info */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Question Types
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {QUIZ_TYPES.map((type) => (
                <View
                  key={type}
                  className="px-3 py-1.5 rounded-lg bg-ink-100 dark:bg-ink-800"
                >
                  <Text className="text-xs font-medium text-ink-600 dark:text-ink-300">
                    {QUIZ_TYPE_LABELS[type]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Start */}
          <Pressable
            onPress={startQuiz}
            className="rounded-2xl py-4 items-center justify-center active:opacity-80"
            style={{ backgroundColor: levelColor }}
          >
            <Text className="text-white text-lg font-bold">Start Quiz</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Results Phase ──
  if (phase === "results") {
    const correctCount = answers.filter(
      (a) => a.isCorrect || a.quality >= 3,
    ).length;
    const accuracy =
      answers.length > 0
        ? Math.round((correctCount / answers.length) * 100)
        : 0;

    const byType: Record<QuizType, { total: number; correct: number }> = {
      mcq: { total: 0, correct: 0 },
      pinyin: { total: 0, correct: 0 },
      english: { total: 0, correct: 0 },
      fillblank: { total: 0, correct: 0 },
    };
    answers.forEach((a) => {
      byType[a.type].total++;
      if (a.isCorrect || a.quality >= 3) byType[a.type].correct++;
    });

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
          {/* Result Header */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl py-8 px-4 items-center mb-4 shadow-sm">
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

            <View className="flex-row justify-center gap-8 mb-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-brand-500">
                  {correctCount}/{answers.length}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Correct
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
                  {answers.length}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Questions
                </Text>
              </View>
            </View>
          </View>

          {/* By Type Breakdown */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              By Question Type
            </Text>
            {QUIZ_TYPES.map((type) => {
              const data = byType[type];
              if (data.total === 0) return null;
              const pct =
                data.total > 0
                  ? Math.round((data.correct / data.total) * 100)
                  : 0;
              return (
                <View
                  key={type}
                  className="flex-row items-center gap-3 mb-2 last:mb-0"
                >
                  <View className="w-20">
                    <Text className="text-xs font-medium text-ink-600 dark:text-ink-300">
                      {QUIZ_TYPE_LABELS[type]}
                    </Text>
                  </View>
                  <View className="flex-1 h-2 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: levelColor,
                      }}
                    />
                  </View>
                  <Text className="text-xs font-semibold text-ink-500 dark:text-ink-400 w-12 text-right">
                    {data.correct}/{data.total}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Answer Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Answer Review
            </Text>
            {answers.map((a, i) => (
              <View
                key={i}
                className={`p-3 rounded-xl mb-2 ${
                  a.isCorrect
                    ? "bg-green-50 dark:bg-green-900/10"
                    : "bg-red-50 dark:bg-red-900/10"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-1">
                  {a.isCorrect ? (
                    <CheckCircle size={14} color="#22c55e" />
                  ) : (
                    <XCircle size={14} color="#ef4444" />
                  )}
                  <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                    {a.word.chinese}
                  </Text>
                  <View className="bg-ink-100 dark:bg-ink-700 px-1.5 py-0.5 rounded-md">
                    <Text className="text-[10px] font-medium text-ink-500 dark:text-ink-400">
                      {QUIZ_TYPE_LABELS[a.type]}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2 pl-6">
                  <Text className="text-xs text-ink-400 dark:text-ink-500">
                    Expected:{" "}
                    {a.type === "pinyin"
                      ? a.word.pinyin
                      : a.type === "fillblank"
                        ? a.word.chinese
                        : a.word.english}
                  </Text>
                  {!a.isCorrect && (
                    <Text className="text-xs text-red-500">
                      You: {a.userAnswer}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Try Again */}
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
              New Quiz
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Quiz Phase ──
  const progressPercent =
    quizQuestions.length > 0
      ? ((currentIndex + 1) / quizQuestions.length) * 100
      : 0;

  const posText = currentQuestion?.word
    ? Array.isArray(currentQuestion.word.pos)
      ? currentQuestion.word.pos.join(" · ")
      : String(currentQuestion.word.pos || "")
    : "";

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
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              Sequential Quiz
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              Question {currentIndex + 1} / {quizQuestions.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Correct
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {answers.filter((a) => a.isCorrect).length}
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

        {/* Question Type Badge */}
        <View className="flex-row items-center justify-center mb-4">
          <View
            className="px-3 py-1 rounded-lg"
            style={{ backgroundColor: levelColor + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: levelColor }}
            >
              {QUIZ_TYPE_LABELS[currentQuestion?.type || "mcq"]}
            </Text>
          </View>
        </View>

        {/* Question Card */}
        <MotiView
          key={questionKey}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl p-6 items-center mb-5 shadow-sm"
        >
          {/* MCQ & English & Fill-blank: show Chinese */}
          {(currentQuestion?.type === "mcq" ||
            currentQuestion?.type === "english" ||
            currentQuestion?.type === "fillblank") && (
            <>
              <Text className="text-5xl font-bold text-ink-900 dark:text-white tracking-wider mb-2">
                {currentQuestion?.word.chinese}
              </Text>
              {currentQuestion?.type === "fillblank" && (
                <Text className="text-lg text-ink-500 dark:text-ink-400 mb-1">
                  {currentQuestion?.word.pinyin}
                </Text>
              )}
              {currentQuestion?.type === "mcq" && (
                <Text className="text-sm text-ink-400 dark:text-ink-500 mt-2">
                  Choose the correct English meaning
                </Text>
              )}
              {currentQuestion?.type === "english" && (
                <Text className="text-sm text-ink-400 dark:text-ink-500 mt-2">
                  Type the English meaning
                </Text>
              )}
              {currentQuestion?.type === "fillblank" && (
                <Text className="text-sm text-ink-400 dark:text-ink-500 mt-2">
                  Type the Chinese characters
                </Text>
              )}
            </>
          )}

          {/* Pinyin: show English */}
          {currentQuestion?.type === "pinyin" && (
            <>
              <Text className="text-2xl font-semibold text-ink-900 dark:text-white text-center mb-2">
                {currentQuestion?.word.english}
              </Text>
              <Text className="text-sm text-ink-400 dark:text-ink-500 mt-2">
                Type the correct pinyin
              </Text>
            </>
          )}
        </MotiView>

        {/* MCQ Options */}
        {currentQuestion?.type === "mcq" && !showResult && (
          <View className="gap-3">
            {currentQuestion.options?.map((option, idx) => {
              const isSelected = selectedMcq === option.text;
              return (
                <MotiView
                  key={`${currentQuestion.word.id}-${idx}`}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 200, delay: idx * 50 }}
                >
                  <Pressable
                    onPress={() => handleMcqSelect(option)}
                    className="p-4 rounded-2xl flex-row items-center gap-3 bg-white dark:bg-ink-900 active:opacity-80 shadow-sm"
                  >
                    <View
                      className="w-7 h-7 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor: isSelected
                          ? levelColor
                          : undefined,
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: isSelected
                          ? "transparent"
                          : "#d1d5db",
                      }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{
                          color: isSelected ? "#fff" : "#6b7280",
                        }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    </View>
                    <Text className="flex-1 text-sm font-medium text-ink-900 dark:text-white">
                      {option.text}
                    </Text>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>
        )}

        {/* MCQ Result */}
        {currentQuestion?.type === "mcq" && showResult && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 250 }}
          >
            {isAnswerCorrect ? (
              <View className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 items-center mb-4 border border-green-200 dark:border-green-800">
                <CheckCircle size={40} color="#22c55e" />
                <Text className="text-lg font-bold text-green-700 dark:text-green-400 mt-2">
                  Correct!
                </Text>
                <Text className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {currentQuestion.word.english}
                </Text>
              </View>
            ) : (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 items-center mb-4 border border-red-200 dark:border-red-800">
                <XCircle size={40} color="#ef4444" />
                <Text className="text-lg font-bold text-red-700 dark:text-red-400 mt-2">
                  Incorrect
                </Text>
                <Text className="text-sm text-red-600 dark:text-red-400 mt-1">
                  The correct answer is: {currentQuestion.word.english}
                </Text>
              </View>
            )}

            {/* Self-Assessment */}
            <View className="flex-row gap-3 mb-4">
              <Pressable
                onPress={() => handleSelfAssessment(1)}
                className="flex-1 py-3 rounded-xl bg-red-500 items-center active:opacity-80"
              >
                <Text className="text-white text-xs font-bold">Wrong</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSelfAssessment(isAnswerCorrect ? 4 : 3)}
                className="flex-1 py-3 rounded-xl bg-green-500 items-center active:opacity-80"
              >
                <Text className="text-white text-xs font-bold">
                  {isAnswerCorrect ? "Easy" : "Close"}
                </Text>
              </Pressable>
              {isAnswerCorrect && (
                <Pressable
                  onPress={() => handleSelfAssessment(4)}
                  className="flex-1 py-3 rounded-xl bg-brand-500 items-center active:opacity-80"
                >
                  <Text className="text-white text-xs font-bold">Easy</Text>
                </Pressable>
              )}
            </View>
          </MotiView>
        )}

        {/* Text Input for Pinyin / English / Fill-blank */}
        {(currentQuestion?.type === "pinyin" ||
          currentQuestion?.type === "english" ||
          currentQuestion?.type === "fillblank") &&
          !showResult && (
            <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
              <TextInput
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder={
                  currentQuestion.type === "pinyin"
                    ? "Type pinyin..."
                    : currentQuestion.type === "english"
                      ? "Type English..."
                      : "Type Chinese..."
                }
                placeholderTextColor="#9ca3af"
                className="text-base px-4 py-3 rounded-xl bg-ink-50 dark:bg-ink-800 text-ink-900 dark:text-white border border-ink-200 dark:border-ink-700 mb-4 text-center"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Pressable
                onPress={handleSubmit}
                disabled={!userAnswer.trim()}
                className={`rounded-xl py-3 items-center justify-center active:opacity-80 ${
                  userAnswer.trim()
                    ? "bg-brand-500"
                    : "bg-ink-200 dark:bg-ink-700"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    userAnswer.trim()
                      ? "text-white"
                      : "text-ink-400 dark:text-ink-500"
                  }`}
                >
                  Submit
                </Text>
              </Pressable>
            </View>
          )}

        {/* Text Input Result */}
        {(currentQuestion?.type === "pinyin" ||
          currentQuestion?.type === "english" ||
          currentQuestion?.type === "fillblank") &&
          showResult && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 250 }}
            >
              {isAnswerCorrect ? (
                <View className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 items-center mb-4 border border-green-200 dark:border-green-800">
                  <CheckCircle size={40} color="#22c55e" />
                  <Text className="text-lg font-bold text-green-700 dark:text-green-400 mt-2">
                    Correct!
                  </Text>
                  <Text className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {currentQuestion.type === "pinyin"
                      ? currentQuestion.word.pinyin
                      : currentQuestion.type === "fillblank"
                        ? currentQuestion.word.chinese
                        : currentQuestion.word.english}
                  </Text>
                </View>
              ) : (
                <View className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 items-center mb-4 border border-red-200 dark:border-red-800">
                  <XCircle size={40} color="#ef4444" />
                  <Text className="text-lg font-bold text-red-700 dark:text-red-400 mt-2">
                    Incorrect
                  </Text>
                  <Text className="text-sm text-red-600 dark:text-red-400 mt-1">
                    You wrote: {userAnswer.trim() || "(empty)"}
                  </Text>
                  <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mt-2">
                    Correct:{" "}
                    {currentQuestion.type === "pinyin"
                      ? currentQuestion.word.pinyin
                      : currentQuestion.type === "fillblank"
                        ? currentQuestion.word.chinese
                        : currentQuestion.word.english}
                  </Text>
                </View>
              )}

              {/* Self-Assessment */}
              <View className="flex-row gap-3 mb-4">
                <Pressable
                  onPress={() => handleSelfAssessment(1)}
                  className="flex-1 py-3 rounded-xl bg-red-500 items-center active:opacity-80"
                >
                  <Text className="text-white text-xs font-bold">Wrong</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSelfAssessment(isAnswerCorrect ? 4 : 3)}
                  className="flex-1 py-3 rounded-xl bg-green-500 items-center active:opacity-80"
                >
                  <Text className="text-white text-xs font-bold">
                    {isAnswerCorrect ? "Good" : "Close"}
                  </Text>
                </Pressable>
                {isAnswerCorrect && (
                  <Pressable
                    onPress={() => handleSelfAssessment(4)}
                    className="flex-1 py-3 rounded-xl bg-brand-500 items-center active:opacity-80"
                  >
                    <Text className="text-white text-xs font-bold">Easy</Text>
                  </Pressable>
                )}
              </View>
            </MotiView>
          )}

        {/* Word Info Reference */}
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mt-2 shadow-sm">
          <Text className="text-xs font-medium text-ink-400 dark:text-ink-500 mb-2">
            Word Reference
          </Text>
          <View className="flex-row items-center gap-3">
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              {currentQuestion?.word.chinese}
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              {currentQuestion?.word.pinyin}
            </Text>
            <Text className="text-sm text-ink-600 dark:text-ink-300 flex-1">
              {currentQuestion?.word.english}
            </Text>
          </View>
          {posText ? (
            <Text className="text-xs text-ink-400 dark:text-ink-500 mt-1">
              {posText}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}