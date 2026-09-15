import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GraduationCap, Clock, CheckCircle } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import type { Word, HSKLevel } from "@/types";

type Phase = "setup" | "listening" | "reading" | "writing" | "results";
type QType = "tf" | "mcq" | "cloze";

interface Question {
  id: string;
  type: QType;
  chinese: string;
  pinyin: string;
  prompt: string;
  options: string[];
  answer: string;
  section: "listening" | "reading" | "writing";
}

const QUESTION_COUNTS: Record<string, number> = { practice: 12, full: 30 };

export default function ExamScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<Phase>("setup");
  const [examLength, setExamLength] = useState<"practice" | "full">("practice");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState(0);

  const userId = user?.id || "guest";

  const generateQuestions = useCallback(async (words: Word[], count: number): Promise<Question[]> => {
    const pool = words.filter((w) => w.chinese && w.english);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const qs: Question[] = [];
    const sections: ("listening" | "reading" | "writing")[] = ["listening", "reading", "writing"];
    for (let i = 0; i < count; i++) {
      const w = shuffled[i % shuffled.length];
      const section = sections[i % 3];
      const type: QType = i % 3 === 0 ? "tf" : i % 3 === 1 ? "mcq" : "cloze";
      const distractors = shuffled.filter((x) => x.id !== w.id).slice(0, 3).map((x) => x.english);
      const options = [w.english, ...distractors].sort(() => Math.random() - 0.5);
      qs.push({
        id: `q_${i}`, type, section,
        chinese: w.chinese, pinyin: w.pinyin,
        prompt: type === "tf" ? `True or False: "${w.chinese}" means "${w.english}"` : `What does "${w.chinese}" (${w.pinyin}) mean?`,
        options: type === "tf" ? ["True", "False"] : options,
        answer: type === "tf" ? "True" : w.english,
      });
    }
    return qs;
  }, []);

  const startExam = useCallback(async () => {
    try {
      setLoading(true);
      const words = await ds.vocab.getWordsByLevel(4 as HSKLevel);
      const count = QUESTION_COUNTS[examLength];
      const qs = await generateQuestions(words, count);
      setQuestions(qs);
      setCurrent(0);
      setAnswers({});
      setStartTime(Date.now());
      setPhase("listening");
    } catch (e) {
      console.error("Exam start failed:", e);
    } finally {
      setLoading(false);
    }
  }, [ds.vocab, examLength, generateQuestions]);

  const answer = (qId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    if (current + 1 < questions.length) setCurrent((p) => p + 1);
    else finishExam();
  };

  const finishExam = async () => {
    const correct = questions.filter((q) => answers[q.id] === q.answer).length;
    const duration = Math.round((Date.now() - startTime) / 1000);
    const sectionResults: Record<string, { correct: number; total: number }> = {};
    for (const section of ["listening", "reading", "writing"]) {
      const sectionQs = questions.filter((q) => q.section === section);
      sectionResults[section] = {
        correct: sectionQs.filter((q) => answers[q.id] === q.answer).length,
        total: sectionQs.length,
      };
    }
    try {
      await ds.exam.saveAttempt({
        user_id: userId, exam_length: examLength,
        total_questions: questions.length, correct,
        accuracy: Math.round((correct / questions.length) * 100),
        duration, section_results: sectionResults,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (e) { console.error("Exam save failed:", e); }
    setPhase("results");
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text className="mt-3 text-sm text-ink-500">Preparing exam questions...</Text>
      </SafeAreaView>
    );
  }

  if (phase === "setup") {
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
          <View className="items-center mb-6 mt-8">
            <View className="w-16 h-16 rounded-2xl bg-red-500 items-center justify-center mb-4">
              <GraduationCap size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-ink-900 dark:text-white">HSK 4 Mock Exam</Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              Full mock exam: listening, reading & writing
            </Text>
          </View>
          <View className="gap-3 mb-6">
            {(["practice", "full"] as const).map((len) => (
              <Pressable key={len} onPress={() => setExamLength(len)}
                className={`rounded-2xl p-5 ${examLength === len ? "bg-red-500" : "bg-white dark:bg-ink-900"}`}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className={`text-lg font-bold capitalize ${examLength === len ? "text-white" : "text-ink-900 dark:text-white"}`}>{len}</Text>
                    <Text className={`text-sm ${examLength === len ? "text-red-100" : "text-ink-500"}`}>
                      {QUESTION_COUNTS[len]} questions
                    </Text>
                  </View>
                  <Clock size={24} color={examLength === len ? "white" : "#6b7280"} />
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={startExam} className="bg-red-500 rounded-2xl py-4 items-center">
            <Text className="text-white text-lg font-bold">Start Exam</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "results") {
    const correct = questions.filter((q) => answers[q.id] === q.answer).length;
    const accuracy = Math.round((correct / questions.length) * 100);
    return (
      <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
          <View className="items-center mb-6 mt-8">
            <CheckCircle size={64} color="#10b981" />
            <Text className="text-3xl font-bold text-ink-900 dark:text-white mt-4">{accuracy}%</Text>
            <Text className="text-lg text-ink-500">{correct} / {questions.length} correct</Text>
          </View>
          {Object.entries(answers.length ? {} : {}).map(() => null)}
          {["listening", "reading", "writing"].map((section) => {
            const sectionQs = questions.filter((q) => q.section === section);
            const sectionCorrect = sectionQs.filter((q) => answers[q.id] === q.answer).length;
            return (
              <View key={section} className="bg-white dark:bg-ink-900 rounded-xl p-4 mb-3 flex-row justify-between">
                <Text className="text-sm font-semibold capitalize text-ink-700 dark:text-ink-300">{section}</Text>
                <Text className="text-sm text-ink-900 dark:text-white">{sectionCorrect} / {sectionQs.length}</Text>
              </View>
            );
          })}
          <Pressable onPress={() => setPhase("setup")} className="bg-red-500 rounded-2xl py-4 items-center mt-4">
            <Text className="text-white text-lg font-bold">Back to Setup</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-sm font-semibold capitalize text-red-500">{q.section}</Text>
          <Text className="text-sm text-ink-500">{current + 1} / {questions.length}</Text>
        </View>
        <View className="bg-white dark:bg-ink-900 rounded-2xl p-6 mb-6">
          <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-2 text-center">{q.chinese}</Text>
          <Text className="text-sm text-ink-500 text-center mb-4">{q.pinyin}</Text>
          <Text className="text-base text-ink-700 dark:text-ink-300 text-center">{q.prompt}</Text>
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