import { useState, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, CheckCircle, RotateCcw, Trash2, BookOpen } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import type { Mistake } from "@/types";

export default function MistakesScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "mastered">("active");

  const userId = user?.id || "guest";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all = await ds.mistakes.list(userId);
      setMistakes(all);
    } catch (e) {
      console.error("Failed to load mistakes:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, ds.mistakes]);

  useEffect(() => { load(); }, [load]);

  const filtered = mistakes.filter((m) => {
    if (filter === "active") return !m.mastered;
    if (filter === "mastered") return m.mastered;
    return true;
  });

  const handleMastered = async (id: string) => {
    await ds.mistakes.markMastered(id, true);
    load();
  };
  const handleRetry = async (id: string) => {
    await ds.mistakes.retry(id);
    load();
  };
  const handleDelete = async (id: string) => {
    await ds.mistakes.remove(id);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
        <ActivityIndicator size="large" color="#a855f7" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
        <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-1">Mistake Notebook</Text>
        <Text className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          {mistakes.filter((m) => !m.mastered).length} active · {mistakes.length} total
        </Text>

        <View className="flex-row gap-2 mb-4">
          {(["active", "mastered", "all"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl ${filter === f ? "bg-brand-500" : "bg-ink-100 dark:bg-ink-800"}`}
            >
              <Text className={`text-sm font-semibold capitalize ${filter === f ? "text-white" : "text-ink-600 dark:text-ink-300"}`}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View className="items-center py-12">
            <CheckCircle size={48} color="#10b981" />
            <Text className="text-lg font-bold text-ink-900 dark:text-white mt-4">
              {filter === "active" ? "No active mistakes!" : "Nothing here yet"}
            </Text>
            <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
              {filter === "active" ? "You're doing great. Keep it up!" : "Mistakes you make will appear here."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filtered.map((m) => (
              <View key={m.id} className="bg-white dark:bg-ink-900 rounded-2xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <AlertTriangle size={16} color={m.mastered ? "#10b981" : "#f59e0b"} />
                    <Text className="text-xs font-semibold uppercase text-ink-500 dark:text-ink-400">
                      {m.skill} · {m.mode}
                    </Text>
                  </View>
                  {m.retry_count > 0 && (
                    <Text className="text-xs text-ink-400">×{m.retry_count + 1}</Text>
                  )}
                </View>
                <Text className="text-xl font-bold text-ink-900 dark:text-white">{m.chinese}</Text>
                <Text className="text-sm text-ink-500 dark:text-ink-400">{m.pinyin} — {m.english}</Text>
                <View className="mt-2 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                  <Text className="text-xs text-red-600 dark:text-red-400">You: {m.user_answer}</Text>
                  <Text className="text-xs text-green-600 dark:text-green-400">Correct: {m.correct_answer}</Text>
                </View>
                {!m.mastered && (
                  <View className="flex-row gap-2 mt-3">
                    <Pressable onPress={() => handleRetry(m.id)} className="flex-1 bg-ink-100 dark:bg-ink-800 rounded-lg py-2 items-center">
                      <View className="flex-row items-center gap-1">
                        <RotateCcw size={14} color="#6b7280" />
                        <Text className="text-xs font-semibold text-ink-600 dark:text-ink-300">Retry</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => handleMastered(m.id)} className="flex-1 bg-green-100 dark:bg-green-900/30 rounded-lg py-2 items-center">
                      <View className="flex-row items-center gap-1">
                        <CheckCircle size={14} color="#10b981" />
                        <Text className="text-xs font-semibold text-green-700 dark:text-green-400">Mastered</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(m.id)} className="bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2 items-center">
                      <Trash2 size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}