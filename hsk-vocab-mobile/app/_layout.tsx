import "@/services/suppress-warnings";
import "../global.css";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useEffect, useRef } from "react";
import { Text, TextInput, View, TouchableOpacity } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DataSourceProvider } from "@/db/context";
import { useSettingsStore } from "@/stores/settings";
import { useColorScheme } from "nativewind";
import {
  initNotifications,
  rescheduleReminders,
  subscribeToNotificationTaps,
} from "@/services/notifications";
import {
  useFonts,
  NotoSansSC_400Regular,
  NotoSansSC_500Medium,
  NotoSansSC_600SemiBold,
  NotoSansSC_700Bold,
} from "@expo-google-fonts/noto-sans-sc";

// Global JS error handler — prevents white screen on uncaught errors
if (typeof globalThis !== "undefined") {
  const origError = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
  if (origError && (globalThis as any).ErrorUtils) {
    (globalThis as any).ErrorUtils.setGlobalHandler(
      (error: Error, isFatal?: boolean) => {
        console.error(
          "[GlobalHandler]",
          isFatal ? "FATAL" : "NON-FATAL",
          error?.message || error,
        );
        if (origError) origError(error, isFatal);
      },
    );
  }
}

// ErrorBoundary — catches rendering crashes so the app shows an error screen instead of closing
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error?.message || error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            backgroundColor: "#faf5ff",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#dc2626",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#6b7280",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{
              backgroundColor: "#a855f7",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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

  const router = useRouter();
  const darkMode = useSettingsStore((s) => s.darkMode);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const daysPerWeek = useSettingsStore((s) => s.daysPerWeek);
  const systemScheme = useColorScheme(); // from nativewind, reads system
  const isSystemDark =
    systemScheme && typeof systemScheme === "object"
      ? systemScheme.colorScheme === "dark"
      : (systemScheme as unknown as string) === "dark";
  const effectiveDark = themeMode === "system" ? isSystemDark : darkMode;

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

  // Initialize notifications on mount
  useEffect(() => {
    initNotifications().catch(() => {});
  }, []);

  // Handle notification tap — navigate to Learn tab
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    subscribeToNotificationTaps((screen) => {
      router.push(screen as any);
    })
      .then((cleanup) => {
        cleanupRef.current = cleanup;
      })
      .catch(() => {});
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [router]);

  // Reschedule reminders whenever settings change
  useEffect(() => {
    rescheduleReminders().catch(() => {});
  }, [remindersEnabled, reminderTime, daysPerWeek]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
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
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false, animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="vocabulary"
                options={{ title: "Vocabulary" }}
              />
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
    </ErrorBoundary>
  );
}
