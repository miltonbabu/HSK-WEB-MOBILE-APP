import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";

export default function Auth() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, username, password);
      }
      router.replace("/");
    } catch (e) {
      Alert.alert("Auth error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View className="items-center mb-8">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
              style={{ backgroundColor: "#4f46e5" }}
            >
              <Text className="text-white text-2xl font-bold">汉</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </Text>
            <Text className="text-sm text-slate-500 mt-1">
              {mode === "signin" ? "Sign in to continue learning" : "Start your HSK journey"}
            </Text>
          </View>

          {error ? (
            <View className="rounded-xl bg-red-100 p-3 mb-4">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            {mode === "signup" && (
              <Field label="Username" value={username} onChangeText={setUsername} placeholder="learner" />
            )}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

            <Pressable
              onPress={submit}
              disabled={isLoading || !email || !password || (mode === "signup" && !username)}
              className="rounded-2xl py-4 items-center mt-2 active:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: "#4f46e5" }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="items-center py-3"
            >
              <Text className="text-sm text-indigo-700">
                {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View>
      <Text className="text-xs font-medium text-slate-700 mb-1.5 ml-1">{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor="#9ca3af"
        className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-900"
      />
    </View>
  );
}
