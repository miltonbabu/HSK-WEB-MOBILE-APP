import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "lucide-react-native";

export default function VisualMode() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
      edges={["bottom"]}
    >
      <Image size={48} color="#a855f7" />
      <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
        Visual Learning
      </Text>
      <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
        Coming soon — learn words with images and visual associations.
      </Text>
    </SafeAreaView>
  );
}