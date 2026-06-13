import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Puzzle } from "lucide-react-native";

export default function SentencePuzzleMode() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
      edges={["bottom"]}
    >
      <Puzzle size={48} color="#a855f7" />
      <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
        Sentence Puzzle
      </Text>
      <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
        Coming soon — arrange word tiles to form correct Chinese sentences.
      </Text>
    </SafeAreaView>
  );
}