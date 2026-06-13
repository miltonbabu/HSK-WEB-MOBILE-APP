import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, TextInput } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DataSourceProvider } from "@/db/context";
import { useSettingsStore } from "@/stores/settings";
import { useColorScheme } from "nativewind";
import {
  useFonts,
  NotoSansSC_400Regular,
  NotoSansSC_500Medium,
  NotoSansSC_600SemiBold,
  NotoSansSC_700Bold,
} from "@expo-google-fonts/noto-sans-sc";

// Apply Noto Sans SC as default font globally
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.style = { fontFamily: "NotoSansSC_400Regular" };
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.style = { fontFamily: "NotoSansSC_400Regular" };

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSansSC_400Regular,
    NotoSansSC_500Medium,
    NotoSansSC_600SemiBold,
    NotoSansSC_700Bold,
  });

  const darkMode = useSettingsStore((s) => s.darkMode);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme(); // from nativewind, reads system
  const effectiveDark =
    themeMode === "system" ? systemScheme === "dark" : darkMode;

  // Override NativeWind's color scheme so dark: classes respond to the toggle
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    setColorScheme(effectiveDark ? "dark" : "light");
  }, [effectiveDark, setColorScheme]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataSourceProvider>
          <StatusBar style={effectiveDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: effectiveDark ? "#030712" : "#ffffff",
              },
              headerTintColor: effectiveDark ? "#f9fafb" : "#111827",
              contentStyle: {
                backgroundColor: effectiveDark ? "#030712" : "#faf5ff",
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="vocabulary" options={{ title: "Vocabulary" }} />
            <Stack.Screen
              name="mode/flashcard"
              options={{ title: "Flashcards" }}
            />
            <Stack.Screen
              name="mode/listening"
              options={{ title: "Listening" }}
            />
            <Stack.Screen
              name="mode/timed-quiz"
              options={{ title: "Timed Quiz" }}
            />
            <Stack.Screen
              name="mode/sequential-quiz"
              options={{ title: "Sequential Quiz" }}
            />
            <Stack.Screen name="mode/visual" options={{ title: "Visual" }} />
            <Stack.Screen
              name="mode/sentence-making"
              options={{ title: "Sentences" }}
            />
            <Stack.Screen
              name="mode/sentence-puzzle"
              options={{ title: "Puzzle" }}
            />
            <Stack.Screen
              name="mode/translation"
              options={{ title: "Translation" }}
            />
            <Stack.Screen
              name="mode/shadowing"
              options={{ title: "Shadowing" }}
            />
            <Stack.Screen
              name="mode/handwriting"
              options={{ title: "Handwriting" }}
            />
          </Stack>
        </DataSourceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
