import { View, Text, Pressable, Switch, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { isSuperAdmin } from "@/services/admin.service";
import {
  LogOut,
  Settings as SettingsIcon,
  BookOpen,
  Flame,
  Shield,
  Sparkles,
} from "lucide-react-native";

export default function Me() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const haptics = useSettingsStore((s) => s.hapticsEnabled);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  // Auto-navigate to onboarding on first launch
  useEffect(() => {
    if (!onboardingCompleted) {
      const timer = setTimeout(() => router.push("/onboarding"), 800);
      return () => clearTimeout(timer);
    }
  }, []);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const setDailyGoal = useSettingsStore((s) => s.setDailyGoal);

  const isSuper = user?.is_super === true || isSuperAdmin(user?.email ?? null);
  const isAdmin = user?.is_admin === true || isSuper;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: "#e0e7ff" }}
          >
            <Text className="text-2xl font-bold text-indigo-700">
              {(user?.username ?? "L").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text className="text-lg font-bold text-slate-900">
            {user?.username ?? "Guest"}
          </Text>
          <Text className="text-sm text-slate-500">
            {user?.email ?? "Not signed in"}
          </Text>
          {isAdmin && (
            <View className="flex-row items-center gap-1 mt-3 px-3 py-1.5 rounded-full bg-indigo-50">
              <Shield size={14} color="#4338ca" />
              <Text className="text-xs font-bold text-indigo-700">
                {isSuper ? "Super Administrator" : "Administrator"}
              </Text>
            </View>
          )}
        </View>

        {isAdmin && (
          <View className="mb-3">
            <Text className="text-xs font-semibold text-slate-600 mb-2 px-1">Admin</Text>
            <Pressable
              onPress={() => router.push('/admin/vocabulary')}
              className="rounded-2xl bg-white border border-slate-200 p-4 flex-row items-center active:opacity-70 shadow-sm mb-2"
            >
              <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                <BookOpen color="#4f46e5" size={20} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-sm font-bold text-slate-900">Vocabulary</Text>
                <Text className="text-xs text-slate-500">Add, edit, or delete words</Text>
              </View>
              <Text className="text-sm text-slate-400">›</Text>
            </Pressable>

            {isSuper && (
              <Pressable
                onPress={() => router.push('/admin/users')}
                className="rounded-2xl bg-white border border-slate-200 p-4 flex-row items-center active:opacity-70 shadow-sm mb-2"
              >
                <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                  <Shield color="#4f46e5" size={20} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-sm font-bold text-slate-900">Users</Text>
                  <Text className="text-xs text-slate-500">Create accounts, reset passwords</Text>
                </View>
                <Text className="text-sm text-slate-400">›</Text>
              </Pressable>
            )}
          </View>
        )}

        <Row
          icon={<BookOpen color="#4f46e5" size={18} />}
          title="Daily goal"
          right={
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setDailyGoal(Math.max(5, dailyGoal - 5))}
                className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center active:opacity-70"
              >
                <Text className="text-slate-600 text-lg">−</Text>
              </Pressable>
              <Text className="w-10 text-center font-semibold text-slate-900">
                {dailyGoal}
              </Text>
              <Pressable
                onPress={() => setDailyGoal(Math.min(100, dailyGoal + 5))}
                className="w-8 h-8 rounded-lg bg-slate-100 items-center justify-center active:opacity-70"
              >
                <Text className="text-slate-600 text-lg">+</Text>
              </Pressable>
            </View>
          }
        />

        <Row
          icon={<Flame color="#f59e0b" size={18} />}
          title="Dark mode"
          right={
            <Switch
              value={darkMode}
              onValueChange={(v) => {
                setDarkMode(v);
                setThemeMode(v ? "dark" : "light");
              }}
            />
          }
        />

        <Row
          icon={<SettingsIcon color="#64748b" size={18} />}
          title="Haptics"
          right={<Switch value={haptics} onValueChange={setHaptics} />}
        />

        <View className="h-px bg-slate-100 my-3" />

        {user ? (
          <Pressable
            onPress={async () => {
              try {
                await signOut();
              } catch {}
              router.replace("/");
            }}
            className="rounded-2xl bg-white border border-slate-200 p-4 flex-row items-center justify-center gap-2 active:opacity-70 shadow-sm"
          >
            <LogOut color="#dc2626" size={18} />
            <Text className="text-red-600 font-semibold">Sign out</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/auth")}
            className="rounded-2xl p-4 flex-row items-center justify-center active:opacity-80"
            style={{ backgroundColor: "#4f46e5" }}
          >
            <Text className="text-white font-semibold">Sign in / Sign up</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="rounded-2xl bg-white border border-slate-200 p-4 mb-2 flex-row items-center justify-between shadow-sm">
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-sm font-medium text-slate-900">{title}</Text>
      </View>
      {right}
    </View>
  );
}
