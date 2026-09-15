import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquare, Send } from "lucide-react-native";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { generateResponse } from "@/services/ai-chat";
import type { ChatMessage } from "@/types";

const SCENARIOS = [
  { id: "restaurant", label: "At a Restaurant", prompt: "I want to practice ordering food at a Chinese restaurant. You are the waiter. Start the conversation in Chinese with pinyin and English." },
  { id: "taxi", label: "Taking a Taxi", prompt: "I want to practice taking a taxi in China. You are the taxi driver. Start the conversation in Chinese with pinyin and English." },
  { id: "shopping", label: "Shopping", prompt: "I want to practice shopping for clothes in China. You are the shop assistant. Start the conversation in Chinese with pinyin and English." },
  { id: "free", label: "Free Talk", prompt: "Let's have a casual conversation in Chinese. Ask me a question to get started. Include pinyin and English for difficult words." },
];

export default function ConversationScreen() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scenario, setScenario] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const startScenario = useCallback(async (scenarioId: string) => {
    const s = SCENARIOS.find((x) => x.id === scenarioId);
    if (!s) return;
    setScenario(scenarioId);
    setLoading(true);
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: s.prompt, timestamp: Date.now() };
    setMessages([userMsg]);
    try {
      let aiContent = "";
      await generateResponse(
        ds,
        [{ role: "user", content: s.prompt }],
        (chunk) => { aiContent = chunk; },
        { hskLevel: 3, dailyGoal: 20, learningReason: "conversation", onboardingCompleted: true, userName: user?.username },
      );
      const aiMsg: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: aiContent, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error("Conversation start failed:", e);
    } finally {
      setLoading(false);
    }
  }, [ds, user]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: input.trim(), timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      let aiContent = "";
      await generateResponse(
        ds,
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => { aiContent = chunk; },
        { hskLevel: 3, dailyGoal: 20, learningReason: "conversation", onboardingCompleted: true, userName: user?.username },
      );
      const aiMsg: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: aiContent, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, ds, user]);

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!scenario ? (
          <ScrollView className="flex-1" contentContainerClassName="p-4">
            <View className="items-center mb-6 mt-4">
              <View className="w-14 h-14 rounded-2xl bg-blue-500 items-center justify-center mb-3">
                <MessageSquare size={28} color="white" />
              </View>
              <Text className="text-2xl font-bold text-ink-900 dark:text-white">AI Conversation</Text>
              <Text className="text-sm text-ink-500 dark:text-ink-400 mt-1">Practice real-life dialogs with AI</Text>
            </View>
            <View className="gap-3">
              {SCENARIOS.map((s) => (
                <Pressable key={s.id} onPress={() => startScenario(s.id)}
                  className="bg-white dark:bg-ink-900 rounded-2xl p-5">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center">
                      <MessageSquare size={20} color="#3b82f6" />
                    </View>
                    <Text className="text-base font-semibold text-ink-900 dark:text-white">{s.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1">
            <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="p-4"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {messages.map((m) => (
                <View key={m.id} className={`mb-3 max-w-[85%] ${m.role === "user" ? "self-end" : "self-start"}`}>
                  <View className={`rounded-2xl p-3 ${m.role === "user" ? "bg-brand-500" : "bg-white dark:bg-ink-900"}`}>
                    <Text className={`text-sm ${m.role === "user" ? "text-white" : "text-ink-900 dark:text-white"}`}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              ))}
              {loading && <Text className="text-sm text-ink-400 self-start mb-2">AI is typing...</Text>}
            </ScrollView>
            <View className="flex-row p-3 gap-2 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type your reply..."
                className="flex-1 bg-ink-100 dark:bg-ink-800 rounded-xl px-4 py-3 text-ink-900 dark:text-white"
                onSubmitEditing={send}
              />
              <Pressable onPress={send} disabled={loading || !input.trim()}
                className="bg-brand-500 rounded-xl px-4 items-center justify-center">
                <Send size={20} color="white" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}