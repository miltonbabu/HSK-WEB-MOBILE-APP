import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  Headphones,
  Clock,
  ListOrdered,
  Image,
  MessageSquare,
  Puzzle,
  Languages,
  Mic,
  PenTool,
} from "lucide-react-native";

const MODES = [
  {
    id: "flashcard",
    name: "Flashcards",
    icon: BookOpen,
    color: "#a855f7",
    desc: "Tap to flip",
  },
  {
    id: "listening",
    name: "Listening",
    icon: Headphones,
    color: "#ec4899",
    desc: "Hear & pick",
  },
  {
    id: "timed-quiz",
    name: "Timed Quiz",
    icon: Clock,
    color: "#f59e0b",
    desc: "60s challenge",
  },
  {
    id: "sequential-quiz",
    name: "Sequential",
    icon: ListOrdered,
    color: "#10b981",
    desc: "No timer",
  },
  {
    id: "visual",
    name: "Visual",
    icon: Image,
    color: "#06b6d4",
    desc: "Picture match",
  },
  {
    id: "sentence-making",
    name: "Sentences",
    icon: MessageSquare,
    color: "#8b5cf6",
    desc: "Build a sentence",
  },
  {
    id: "sentence-puzzle",
    name: "Puzzle",
    icon: Puzzle,
    color: "#f97316",
    desc: "Reorder words",
  },
  {
    id: "translation",
    name: "Translation",
    icon: Languages,
    color: "#3b82f6",
    desc: "EN ↔ ZH",
  },
  {
    id: "shadowing",
    name: "Shadowing",
    icon: Mic,
    color: "#ef4444",
    desc: "Repeat aloud",
  },
  {
    id: "handwriting",
    name: "Handwriting",
    icon: PenTool,
    color: "#14b8a6",
    desc: "Draw characters",
  },
];

export default function Learn() {
  const router = useRouter();

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["top"]}
    >
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Text className="text-2xl font-bold text-ink-900 dark:text-white mb-1">
          Practice
        </Text>
        <Text className="text-sm text-ink-500 dark:text-ink-400 mb-5">
          Pick a learning mode
        </Text>
        <View className="flex-row flex-wrap -mx-1.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <View key={m.id} className="w-1/2 p-1.5">
                <Pressable
                  onPress={() => router.push(`/mode/${m.id}`)}
                  className="rounded-2xl bg-white dark:bg-ink-900 p-4 active:opacity-70"
                  style={{
                    shadowColor: m.color,
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                    style={{ backgroundColor: m.color + "22" }}
                  >
                    <Icon color={m.color} size={20} />
                  </View>
                  <Text className="text-sm font-semibold text-ink-900 dark:text-white">
                    {m.name}
                  </Text>
                  <Text className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    {m.desc}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
