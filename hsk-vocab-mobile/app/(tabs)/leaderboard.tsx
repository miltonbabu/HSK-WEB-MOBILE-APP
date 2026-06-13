import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { MotiView } from "moti";
import { Trophy, Flame, Target, BarChart3 } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";

// ---------------------------------------------------------------------------
// Mode definitions — label + internal LearningMode value
// ---------------------------------------------------------------------------
const MODES = [
  { label: "All", value: "all" },
  { label: "Flashcard", value: "flashcard" },
  { label: "Listening", value: "listening" },
  { label: "Timed Quiz", value: "timed-quiz" },
  { label: "Translation", value: "translation" },
  { label: "Shadowing", value: "shadowing" },
  { label: "Handwriting", value: "handwriting" },
  { label: "Sequential", value: "sequential-quiz" },
  { label: "Visual", value: "visual" },
  { label: "Sentence", value: "sentence-making" },
  { label: "Puzzle", value: "sentence-puzzle" },
] as const;

const ALL_MODE_VALUES = MODES.filter((m) => m.value !== "all").map(
  (m) => m.value,
);

// ---------------------------------------------------------------------------
// Entry shape returned by ds.leaderboard.getTop / getUserRank
// ---------------------------------------------------------------------------
interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string;
  score: number;
  accuracy: number;
  mode: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum scores and average accuracy for a user across multiple mode entries. */
function combineAllModeEntries(
  entries: LeaderboardEntry[],
): LeaderboardEntry[] {
  const map = new Map<
    string,
    { totalScore: number; totalAccuracy: number; count: number; entry: LeaderboardEntry }
  >();
  for (const e of entries) {
    const existing = map.get(e.user_id);
    if (existing) {
      existing.totalScore += e.score;
      existing.totalAccuracy += e.accuracy;
      existing.count += 1;
    } else {
      map.set(e.user_id, {
        totalScore: e.score,
        totalAccuracy: e.accuracy,
        count: 1,
        entry: e,
      });
    }
  }
  const combined: LeaderboardEntry[] = [];
  for (const [userId, agg] of map) {
    combined.push({
      ...agg.entry,
      score: agg.totalScore,
      accuracy: Math.round((agg.totalAccuracy / agg.count) * 100) / 100,
    });
  }
  combined.sort((a, b) => b.score - a.score);
  return combined.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Leaderboard() {
  const ds = useDataSource();
  const user = useAuthStore((s) => s.user);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";

  const [mode, setMode] = useState<string>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ------------------------------------------------------------------
  // Fetch data
  // ------------------------------------------------------------------
  const fetchData = useCallback(
    async (selectedMode: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        if (selectedMode === "all") {
          // Fetch all modes in parallel, then combine
          const results = await Promise.all(
            ALL_MODE_VALUES.map((m) => ds.leaderboard.getTop(m, 20)),
          );
          const flat = results.flat();
          const combined = combineAllModeEntries(flat);
          setEntries(combined);

          // User rank for "all" — combine ranks across modes
          if (user) {
            const rankResults = await Promise.all(
              ALL_MODE_VALUES.map((m) =>
                ds.leaderboard.getUserRank(m, user.id),
              ),
            );
            // To get combined rank, we need to know where the user's combined score
            // would rank. Since we have combined entries, we can derive it:
            const userEntry = combined.find((e) => e.user_id === user.id);
            if (userEntry) {
              const idx = combined.findIndex((e) => e.user_id === user.id);
              setUserRank(idx + 1);
            } else {
              setUserRank(null);
            }
          }
        } else {
          const [top, rank] = await Promise.all([
            ds.leaderboard.getTop(selectedMode, 20),
            user
              ? ds.leaderboard.getUserRank(selectedMode, user.id)
              : Promise.resolve(null),
          ]);
          setEntries(top);
          setUserRank(rank);
        }
      } catch {
        // silently fail — UI shows empty state
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ds, user],
  );

  useEffect(() => {
    fetchData(mode);
  }, [mode, fetchData]);

  const onRefresh = useCallback(() => {
    fetchData(mode, true);
  }, [mode, fetchData]);

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const medalColors = [
    { bg: "#fef3c7", border: "#f59e0b", text: "#b45309" }, // gold
    { bg: "#e5e7eb", border: "#9ca3af", text: "#4b5563" }, // silver
    { bg: "#ffedd5", border: "#f97316", text: "#c2410c" }, // bronze
  ];

  const renderRank = (rank: number) => {
    if (rank === 1) return <Trophy size={18} color="#f59e0b" />;
    if (rank === 2) return <Trophy size={18} color="#9ca3af" />;
    if (rank === 3) return <Trophy size={18} color="#f97316" />;
    return (
      <Text className="text-sm font-bold text-ink-400 dark:text-ink-500 w-5 text-center">
        {rank}
      </Text>
    );
  };

  // ------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------
  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["top"]}
    >
      {/* Header */}
      <View className="px-4 pt-2 pb-2">
        <View className="flex-row items-center gap-2 mb-3">
          <Trophy color="#a855f7" size={24} />
          <Text className="text-2xl font-bold text-ink-900 dark:text-white">
            Leaderboard
          </Text>
        </View>

        {/* Mode pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {MODES.map((m) => {
            const active = mode === m.value;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMode(m.value)}
                className={`px-4 py-1.5 rounded-full ${
                  active
                    ? "bg-brand-500"
                    : "bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    active
                      ? "text-white"
                      : "text-ink-600 dark:text-ink-300"
                  }`}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={["#a855f7"]}
            />
          }
        >
          {entries.length === 0 ? (
            <View className="items-center justify-center py-20">
              <BarChart3 size={48} color={dark ? "#4b5563" : "#d1d5db"} />
              <Text className="text-sm text-ink-400 dark:text-ink-500 mt-4">
                No leaderboard data yet
              </Text>
              <Text className="text-xs text-ink-300 dark:text-ink-600 mt-1">
                Start practicing to appear on the leaderboard!
              </Text>
            </View>
          ) : (
            <>
              {/* User's own rank banner */}
              {user && userRank !== null && (
                <MotiView
                  from={{ opacity: 0, translateY: -4 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="rounded-2xl bg-white dark:bg-ink-900 shadow-sm px-4 py-3 mb-3 flex-row items-center justify-between border border-brand-200 dark:border-brand-700/30"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-700/30 items-center justify-center">
                      <Target size={16} color="#a855f7" />
                    </View>
                    <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                      Your Rank: #{userRank}
                    </Text>
                  </View>
                  <Flame size={18} color="#f59e0b" />
                </MotiView>
              )}

              {/* Leaderboard list */}
              {entries.map((entry, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const medal = isTop3 ? medalColors[rank - 1] : null;
                const isCurrentUser = user?.id === entry.user_id;

                return (
                  <MotiView
                    key={entry.user_id}
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{
                      type: "timing",
                      duration: 200,
                      delay: idx * 40,
                    }}
                    className={`rounded-2xl bg-white dark:bg-ink-900 shadow-sm mb-2 px-4 py-3 flex-row items-center ${
                      isCurrentUser
                        ? "border border-brand-300 dark:border-brand-600"
                        : ""
                    }`}
                    style={
                      isTop3
                        ? {
                            borderWidth: 1.5,
                            borderColor: medal!.border,
                            backgroundColor: dark
                              ? "rgba(17, 24, 39, 1)"
                              : medal!.bg,
                          }
                        : undefined
                    }
                  >
                    {/* Rank */}
                    <View className="w-9 items-center">
                      {renderRank(rank)}
                    </View>

                    {/* Avatar */}
                    <View
                      className="w-9 h-9 rounded-full items-center justify-center ml-2"
                      style={{
                        backgroundColor: isTop3
                          ? medal!.border + "22"
                          : dark
                            ? "#374151"
                            : "#e0e7ff",
                      }}
                    >
                      <Text
                        className="text-sm font-bold"
                        style={{
                          color: isTop3
                            ? medal!.text
                            : dark
                              ? "#d1d5db"
                              : "#4338ca",
                        }}
                      >
                        {(entry.username ?? "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>

                    {/* Name */}
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-sm font-semibold text-ink-900 dark:text-white"
                        numberOfLines={1}
                      >
                        {entry.username ?? "Unknown"}
                        {isCurrentUser && (
                          <Text className="text-brand-500 text-xs font-medium">
                            {" "}
                            (You)
                          </Text>
                        )}
                      </Text>
                      <Text className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                        {entry.accuracy}% accuracy
                      </Text>
                    </View>

                    {/* Score */}
                    <View className="items-end">
                      <Text className="text-base font-bold text-ink-900 dark:text-white">
                        {entry.score.toLocaleString()}
                      </Text>
                      <Text className="text-[10px] text-ink-400 dark:text-ink-500">
                        pts
                      </Text>
                    </View>
                  </MotiView>
                );
              })}

              <View className="h-8" />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}