import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListOrdered } from "lucide-react-native";

export default function SequentialQuizMode() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
      edges={["bottom"]}
    >
      <ListOrdered size={48} color="#a855f7" />
      <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
        Sequential Quiz
      </Text>
      <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
        Coming soon — practice words in order with spaced repetition.
      </Text>
    </SafeAreaView>
  );
}