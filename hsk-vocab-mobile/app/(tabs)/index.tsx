import { View, Text, ScrollView, Pressable } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import {
  Flame,
  Target,
  BookOpen,
  Trophy,
  ChevronRight,
  Layers,
  Ear,
  Clock,
  Languages,
  Mic,
  PenTool,
  MessageSquare,
  Puzzle,
  Image,
  ListOrdered,
} from "lucide-react-native";
import type { HSKLevel } from "@/types";

const LEVELS: HSKLevel[] = [1, 2, 3, 4];

const LEVEL_COLORS: Record<number, string> = {
  1: "#8b5cf6", // purple
  2: "#10b981", // green
  3: "#f59e0b", // amber
  4: "#ec4899", // pink
};

export default function Dashboard() {
  const ds = useDataSource();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const [counts, setCounts] = useState<Record<HSKLevel, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  });
  const [mastered, setMastered] = useState<Record<HSKLevel, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  });
  const [streak, setStreak] = useState(0);
  const [todayWords, setTodayWords] = useState(0);

  useEffect(() => {
    ds.vocab
      .countByLevel()
      .then(setCounts)
      .catch(() => {});
    if (user) {
      ds.progress
        .countMasteredByLevel(user.id)
        .then(setMastered)
        .catch(() => {});
      ds.profiles
        .get(user.id)
        .then((p) => setStreak(p?.streak_count ?? 0))
        .catch(() => {});

      // Fetch today's studied words count
      const today = new Date().toISOString().split("T")[0];
      ds.sessions
        .aggregateDaily(user.id, 1)
        .then((data) => {
          const todayData = data.find((d) => d.date === today);
          setTodayWords(todayData?.words_studied ?? 0);
        })
        .catch(() => {});
    }
  }, [ds, user]);

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["top", "bottom"]}
    >
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-2 pb-6">
        <View className="mb-4">
          <Text className="text-xs text-ink-500 dark:text-ink-400">
            Welcome back
          </Text>
          <Text className="text-2xl font-bold text-ink-900 dark:text-white">
            {user?.username ?? "Learner"} 你好 👋
          </Text>
        </View>

        <View className="flex-row gap-3 mb-5">
          <StatCard
            icon={<Flame color="#ec4899" size={20} />}
            label="Streak"
            value={`${streak}d`}
            color="bg-accent-500/10"
          />
          <StatCard
            icon={<Target color="#a855f7" size={20} />}
            label="Today"
            value={`${todayWords} / ${dailyGoal}`}
            color="bg-brand-500/10"
          />
          <StatCard
            icon={<Trophy color="#22c55e" size={20} />}
            label="Mastered"
            value={String(Object.values(mastered).reduce((a, b) => a + b, 0))}
            color="bg-jade-500/10"
          />
        </View>

        <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">
          Choose level
        </Text>
        {LEVELS.map((lvl) => {
          const total = counts[lvl] ?? 0;
          const known = mastered[lvl] ?? 0;
          const pct = total > 0 ? Math.round((known / total) * 100) : 0;
          const lvlColor = LEVEL_COLORS[lvl] ?? "#a855f7";
          return (
            <Pressable
              key={lvl}
              onPress={() => router.push(`/vocabulary?level=${lvl}`)}
              className="mb-3 rounded-2xl bg-white dark:bg-ink-900 p-4 flex-row items-center active:opacity-70"
              style={{
                shadowColor: lvlColor,
                shadowOpacity: 0.1,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: lvlColor }}
              >
                <Text className="text-white font-bold text-lg">{lvl}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink-900 dark:text-white">
                  HSK {lvl}
                </Text>
                <Text className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                  {known} / {total} words · {pct}%
                </Text>
                <View className="h-1.5 bg-ink-100 dark:bg-ink-800 rounded-full mt-2 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: lvlColor }}
                  />
                </View>
              </View>
              <ChevronRight color="#9ca3af" size={20} />
            </Pressable>
          );
        })}

        <View className="mt-4">
          <Text className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-2">
            Quick practice
          </Text>
          <View className="flex-row gap-3 flex-wrap">
            <ModePill
              icon={<Layers color="#7c3aed" size={20} />}
              label="Flashcards"
              onPress={() => router.push("/mode/flashcard")}
            />
            <ModePill
              icon={<Ear color="#ec4899" size={20} />}
              label="Listening"
              onPress={() => router.push("/mode/listening")}
            />
            <ModePill
              icon={<Clock color="#f59e0b" size={20} />}
              label="Timed Quiz"
              onPress={() => router.push("/mode/timed-quiz")}
            />
            <ModePill
              icon={<ListOrdered color="#10b981" size={20} />}
              label="Sequential"
              onPress={() => router.push("/mode/sequential-quiz")}
            />
            <ModePill
              icon={<Image color="#06b6d4" size={20} />}
              label="Visual"
              onPress={() => router.push("/mode/visual")}
            />
            <ModePill
              icon={<MessageSquare color="#8b5cf6" size={20} />}
              label="Sentences"
              onPress={() => router.push("/mode/sentence-making")}
            />
            <ModePill
              icon={<Puzzle color="#f97316" size={20} />}
              label="Puzzle"
              onPress={() => router.push("/mode/sentence-puzzle")}
            />
            <ModePill
              icon={<Languages color="#3b82f6" size={20} />}
              label="Translation"
              onPress={() => router.push("/mode/translation")}
            />
            <ModePill
              icon={<Mic color="#ef4444" size={20} />}
              label="Shadowing"
              onPress={() => router.push("/mode/shadowing")}
            />
            <ModePill
              icon={<PenTool color="#14b8a6" size={20} />}
              label="Handwriting"
              onPress={() => router.push("/mode/handwriting")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl bg-white dark:bg-ink-900 p-3"
      style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8 }}
    >
      <View
        className={`w-9 h-9 rounded-lg ${color} items-center justify-center mb-2`}
      >
        {icon}
      </View>
      <Text className="text-xs text-ink-500 dark:text-ink-400">{label}</Text>
      <Text className="text-lg font-bold text-ink-900 dark:text-white mt-0.5">
        {value}
      </Text>
    </View>
  );
}

function ModePill({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 px-5 py-3 rounded-2xl border border-brand-200 dark:border-brand-600/40 bg-brand-50 dark:bg-brand-700/20 active:opacity-70"
    >
      {icon}
      <Text className="text-base font-semibold text-brand-700 dark:text-brand-300">
        {label}
      </Text>
    </Pressable>
  );
}
