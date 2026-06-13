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
  PencilLine,
  CheckCircle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Trophy,
  Target,
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

interface AnswerRecord {
  word: Word;
  userSentence: string;
  validated: boolean; // word was found in sentence
  selfAssessment: "correct" | "close" | "wrong" | null;
  quality: number;
}

export default function SentenceMakingMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { hapticsEnabled } = useSettingsStore();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [questionCount, setQuestionCount] = useState(5);
  const [words, setWords] = useState<Word[]>([]);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSentence, setUserSentence] = useState("");
  const [validationState, setValidationState] = useState<
    "idle" | "validating" | "validated" | "failed"
  >("idle");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfAssess, setSelfAssess] = useState<
    "correct" | "close" | "wrong" | null
  >(null);
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
    setAnswers([]);
    setUserSentence("");
    setValidationState("idle");
    setSelfAssess(null);
    sessionStartRef.current = Date.now();
    setPhase("quiz");
    triggerHaptic("light");
  };

  const validateSentence = () => {
    if (!userSentence.trim() || !currentWord) return;

    const sentence = userSentence.trim();
    const targetWord = currentWord.chinese;

    triggerHaptic("medium");

    const found = sentence.includes(targetWord);

    if (found) {
      setValidationState("validated");
      triggerHaptic("success");
    } else {
      setValidationState("failed");
      triggerHaptic("error");
    }
  };

  const handleSelfAssessment = async (
    assessment: "correct" | "close" | "wrong",
  ) => {
    if (!currentWord) return;
    triggerHaptic(assessment === "correct" ? "success" : "error");

    setSelfAssess(assessment);

    let quality: number;
    if (validationState === "validated") {
      quality = 5;
    } else {
      quality = assessment === "correct" ? 4 : assessment === "close" ? 3 : 1;
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
        quality as 0 | 1 | 2 | 3 | 4 | 5,
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

    const record: AnswerRecord = {
      word: currentWord,
      userSentence: userSentence.trim(),
      validated: validationState === "validated",
      selfAssessment: assessment,
      quality,
    };

    const newAnswers = [...answers, record];
    setAnswers(newAnswers);

    // Advance after delay
    setTimeout(() => {
      if (currentIndex + 1 >= (quizWords.length || questionCount)) {
        endQuiz(newAnswers);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setUserSentence("");
        setValidationState("idle");
        setSelfAssess(null);
      }
    }, 800);
  };

  const endQuiz = async (finalAnswers: AnswerRecord[]) => {
    setPhase("results");
    triggerHaptic("medium");

    const duration = Math.round(
      (Date.now() - sessionStartRef.current) / 1000,
    );
    const correctCount = finalAnswers.filter(
      (a) => a.quality >= 3,
    ).length;
    const accuracy =
      finalAnswers.length > 0
        ? Math.round((correctCount / finalAnswers.length) * 100)
        : 0;

    try {
      await ds.sessions.record({
        user_id: userId,
        mode: "sentence-making",
        words_studied: finalAnswers.length,
        accuracy,
        duration,
        date: new Date().toISOString(),
      });

      await ds.profiles.updateStreak(userId);

      await ds.leaderboard.addEntry({
        user_id: userId,
        username: user?.username || "Learner",
        avatar_url: user?.email ? undefined : undefined,
        score: correctCount,
        accuracy,
        mode: "sentence-making",
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
        <PencilLine size={48} color="#9ca3af" />
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
                <PencilLine size={32} color="white" />
              </View>
            </MotiView>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">
              Sentence Making
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Create sentences using target HSK vocabulary words
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
                      selectedLevel === lvl
                        ? { color: "#fff" }
                        : undefined
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
            <Text className="text-white text-lg font-bold">Start Practice</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Results Phase ──
  if (phase === "results") {
    const correctCount = answers.filter((a) => a.quality >= 3).length;
    const accuracy =
      answers.length > 0
        ? Math.round((correctCount / answers.length) * 100)
        : 0;
    const validatedCount = answers.filter((a) => a.validated).length;

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
              Practice Complete!
            </Text>

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
                  {validatedCount}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400">
                  Auto-Validated
                </Text>
              </View>
            </View>
          </View>

          {/* Answer Review */}
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Sentence Review
            </Text>
            {answers.map((a, i) => (
              <View
                key={i}
                className={`p-3 rounded-xl mb-2 ${
                  a.quality >= 4
                    ? "bg-green-50 dark:bg-green-900/10"
                    : a.quality >= 3
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : "bg-red-50 dark:bg-red-900/10"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-1">
                  {a.quality >= 3 ? (
                    <CheckCircle size={14} color="#22c55e" />
                  ) : (
                    <XCircle size={14} color="#ef4444" />
                  )}
                  <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                    {a.word.chinese}
                  </Text>
                  <Text className="text-xs text-ink-400 dark:text-ink-500">
                    {a.word.pinyin}
                  </Text>
                  {a.validated && (
                    <View className="bg-green-500/20 px-1.5 py-0.5 rounded-md">
                      <Text className="text-[10px] text-green-600 font-semibold">
                        AUTO
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-ink-500 dark:text-ink-400 pl-6">
                  "{a.userSentence}"
                </Text>
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
              New Practice
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-lg font-bold text-ink-900 dark:text-white">
              Sentence Making
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400">
              Question {currentIndex + 1} / {quizWords.length}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              Progress
            </Text>
            <Text className="text-lg font-bold" style={{ color: levelColor }}>
              {Math.round(progressPercent)}%
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

        {/* Word Card */}
        <MotiView
          key={currentWord?.id}
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 250 }}
          className="bg-white dark:bg-ink-900 rounded-2xl p-6 items-center mb-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Target size={16} color={levelColor} />
            <Text
              className="text-xs font-semibold"
              style={{ color: levelColor }}
            >
              Target Word
            </Text>
          </View>
          <Text className="text-5xl font-bold text-ink-900 dark:text-white tracking-wider mb-2">
            {currentWord?.chinese}
          </Text>
          <Text className="text-lg text-ink-500 dark:text-ink-400 mb-1">
            {currentWord?.pinyin}
          </Text>
          <Text className="text-base text-ink-600 dark:text-ink-300 text-center mb-2">
            {currentWord?.english}
          </Text>
          {posText ? (
            <Text className="text-xs text-ink-400 dark:text-ink-500">
              {posText}
            </Text>
          ) : null}
        </MotiView>

        {/* Sentence Input */}
        {validationState !== "validated" && (
          <View className="bg-white dark:bg-ink-900 rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
              Write a sentence using "{currentWord?.chinese}":
            </Text>
            <TextInput
              value={userSentence}
              onChangeText={setUserSentence}
              placeholder="Type your Chinese sentence here..."
              placeholderTextColor="#9ca3af"
              className="text-base px-4 py-3 rounded-xl bg-ink-50 dark:bg-ink-800 text-ink-900 dark:text-white border border-ink-200 dark:border-ink-700 mb-4"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
              autoCorrect={false}
            />

            <Pressable
              onPress={validateSentence}
              disabled={!userSentence.trim()}
              className={`rounded-xl py-3 items-center justify-center active:opacity-80 ${
                userSentence.trim()
                  ? "bg-brand-500"
                  : "bg-ink-200 dark:bg-ink-700"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  userSentence.trim()
                    ? "text-white"
                    : "text-ink-400 dark:text-ink-500"
                }`}
              >
                Validate
              </Text>
            </Pressable>
          </View>
        )}

        {/* Validation Result */}
        {validationState === "validated" && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 250 }}
            className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 items-center mb-4 border border-green-200 dark:border-green-800"
          >
            <CheckCircle size={40} color="#22c55e" />
            <Text className="text-lg font-bold text-green-700 dark:text-green-400 mt-2">
              Automatically Validated!
            </Text>
            <Text className="text-sm text-green-600 dark:text-green-400 text-center mt-1">
              Your sentence contains the target word "{currentWord?.chinese}".
            </Text>

            {/* Confirm */}
            <Pressable
              onPress={() => handleSelfAssessment("correct")}
              className="mt-4 bg-green-500 rounded-xl py-3 px-8 active:opacity-80"
            >
              <Text className="text-white font-bold">Continue</Text>
            </Pressable>
          </MotiView>
        )}

        {validationState === "failed" && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 250 }}
            className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 items-center mb-4 border border-amber-200 dark:border-amber-800"
          >
            <HelpCircle size={40} color="#f59e0b" />
            <Text className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-2">
              Not Detected
            </Text>
            <Text className="text-sm text-amber-600 dark:text-amber-400 text-center mt-1 mb-4">
              We didn't find "{currentWord?.chinese}" in your sentence. How
              would you rate your sentence?
            </Text>

            {/* Self-Assessment */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => handleSelfAssessment("wrong")}
                className="flex-1 py-3 rounded-xl bg-red-500 items-center active:opacity-80"
              >
                <XCircle size={18} color="white" />
                <Text className="text-white text-xs font-bold mt-1">Wrong</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSelfAssessment("close")}
                className="flex-1 py-3 rounded-xl bg-amber-500 items-center active:opacity-80"
              >
                <HelpCircle size={18} color="white" />
                <Text className="text-white text-xs font-bold mt-1">Close</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSelfAssessment("correct")}
                className="flex-1 py-3 rounded-xl bg-green-500 items-center active:opacity-80"
              >
                <CheckCircle size={18} color="white" />
                <Text className="text-white text-xs font-bold mt-1">
                  Correct
                </Text>
              </Pressable>
            </View>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}