import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic } from "lucide-react-native";

export default function ShadowingMode() {
  return (
    <SafeAreaView
      className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6"
      edges={["bottom"]}
    >
      <Mic size={48} color="#a855f7" />
      <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">
        Shadowing
      </Text>
      <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
        Coming soon — practice pronunciation by shadowing native audio.
      </Text>
    </SafeAreaView>
  );
}