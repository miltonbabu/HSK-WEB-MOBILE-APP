import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { generateResponse } from "@/services/ai-chat";
import { speak } from "@/services/speech";
import type { ChatMessage, ChatSession, Word } from "@/types";
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  Sparkles,
  BookOpen,
  Volume2,
  Copy,
  RefreshCw,
  Pencil,
  Check,
  X,
  GraduationCap,
  CalendarDays,
  Menu,
} from "lucide-react-native";
import { MotiView } from "moti";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

const DRAFT_KEY = "hsk-chat-draft-v1";
const SESSIONS_KEY = "hsk.chat.sessions.v1";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const SUGGESTIONS = [
  "What does 安排 mean?",
  "Show me HSK 4 verbs",
  "Give me a quiz",
  "How do you say important?",
];

const QUICK_ACTIONS = [
  {
    label: "Grammar Help",
    icon: GraduationCap,
    message: "Explain common HSK grammar patterns with examples",
  },
  {
    label: "Study Plan",
    icon: CalendarDays,
    message: "Create a personalized study plan for me based on my progress",
  },
];

export default function AIChat() {
  const ds = useDataSource();
  const user = useAuthStore((s) => s.user);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const haptics = useSettingsStore((s) => s.hapticsEnabled);
  const hskLevel = useSettingsStore((s) => s.hskLevel);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const learningReason = useSettingsStore((s) => s.learningReason);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const insets = useSafeAreaInsets();

  const userPrefs = {
    hskLevel,
    dailyGoal,
    learningReason,
    onboardingCompleted,
    userName: user?.username,
  };

  const [sessions, setSessions] = useState<
    { id: string; title: string; createdAt: number; messages: ChatMessage[] }[]
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const active = sessions.find((s) => s.id === activeId);
  const messages = active?.messages ?? [];

  // Load sessions
  useEffect(() => {
    (async () => {
      const raw =
        await import("@react-native-async-storage/async-storage").then((m) =>
          m.default.getItem(SESSIONS_KEY),
        );
      const list = raw ? JSON.parse(raw) : [];
      setSessions(list);
      if (list[0]) setActiveId(list[0].id);
      const draft =
        await import("@react-native-async-storage/async-storage").then((m) =>
          m.default.getItem(DRAFT_KEY),
        );
      if (draft) setInput(draft);
    })();
  }, []);

  // Persist draft
  useEffect(() => {
    import("@react-native-async-storage/async-storage").then((m) =>
      m.default.setItem(DRAFT_KEY, input),
    );
  }, [input]);

  // Persist sessions
  useEffect(() => {
    import("@react-native-async-storage/async-storage").then((m) =>
      m.default.setItem(SESSIONS_KEY, JSON.stringify(sessions)),
    );
  }, [sessions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length, streamingContent]);

  const persist = useCallback((next: typeof sessions) => {
    setSessions(next);
  }, []);

  const newSession = () => {
    if (haptics) Haptics.selectionAsync();
    const s = {
      id: genId(),
      title: "New Chat",
      createdAt: Date.now(),
      messages: [] as ChatMessage[],
    };
    persist([s, ...sessions.filter((x) => x.messages.length > 0)]);
    setActiveId(s.id);
    setShowSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = (id: string) => {
    persist(sessions.filter((s) => s.id !== id));
    if (activeId === id) {
      const next = sessions.filter((s) => s.id !== id);
      setActiveId(next[0]?.id ?? null);
    }
  };

  const deleteMessage = (msgId: string) => {
    if (!activeId) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? {
              ...s,
              messages: s.messages.filter((m) => m.id !== msgId),
            }
          : s,
      ),
    );
  };

  const updateActive = (messages: ChatMessage[], title?: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages, ...(title ? { title } : {}) } : s,
      ),
    );
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Ensure a session exists
    let sessionId = activeId;
    let nextSessions = sessions;
    if (!sessionId) {
      const s = {
        id: genId(),
        title: text.slice(0, 30),
        createdAt: Date.now(),
        messages: [] as ChatMessage[],
      };
      nextSessions = [s, ...sessions];
      sessionId = s.id;
      setActiveId(s.id);
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    const currentMessages = [
      ...(nextSessions.find((s) => s.id === sessionId)?.messages ?? []),
      userMsg,
    ];
    const title = currentMessages.length === 1 ? text.slice(0, 30) : undefined;
    nextSessions = nextSessions.map((s) =>
      s.id === sessionId
        ? { ...s, messages: currentMessages, ...(title ? { title } : {}) }
        : s,
    );
    persist(nextSessions);

    setInput("");
    setIsGenerating(true);
    setStreamingContent("");

    try {
      const { content, words } = await generateResponse(
        ds,
        currentMessages.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => setStreamingContent((prev) => prev + chunk),
        userPrefs,
      );
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...currentMessages, assistantMsg] }
            : s,
        ),
      );
    } catch {
      const err: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...currentMessages, err] }
            : s,
        ),
      );
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
    }
  };

  const regenerate = async (msgId: string) => {
    if (!active || isGenerating) return;
    const idx = active.messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    const trimmed = active.messages.slice(0, idx);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, messages: trimmed } : s)),
    );
    setIsGenerating(true);
    setStreamingContent("");
    try {
      const { content, words } = await generateResponse(
        ds,
        trimmed.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => setStreamingContent((prev) => prev + chunk),
        userPrefs,
      );
      const a: ChatMessage = {
        id: genId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...trimmed, a] } : s,
        ),
      );
    } catch {
      const e: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "Sorry, something went wrong.",
        timestamp: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...trimmed, e] } : s,
        ),
      );
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
    }
  };

  const startEdit = (msgId: string, content: string) => {
    setEditingId(msgId);
    setEditText(content);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim() || !active) return;
    const idx = active.messages.findIndex((m) => m.id === editingId);
    const trimmed = active.messages.slice(0, idx);
    const edited: ChatMessage = {
      id: genId(),
      role: "user",
      content: editText.trim(),
      timestamp: Date.now(),
    };
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: [...trimmed, edited] } : s,
      ),
    );
    setEditingId(null);
    setEditText("");
    setIsGenerating(true);
    setStreamingContent("");
    try {
      const { content, words } = await generateResponse(
        ds,
        [...trimmed, edited].map((m) => ({ role: m.role, content: m.content })),
        (chunk) => setStreamingContent((prev) => prev + chunk),
        userPrefs,
      );
      const a: ChatMessage = {
        id: genId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        words: words.length > 0 ? words : undefined,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...trimmed, edited, a] } : s,
        ),
      );
    } catch {
      const e: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "Sorry, something went wrong.",
        timestamp: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...trimmed, edited, e] } : s,
        ),
      );
    } finally {
      setIsGenerating(false);
      setStreamingContent("");
    }
  };

  const copyMsg = async (id: string, content: string) => {
    await Clipboard.setStringAsync(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    if (haptics)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const onSpeak = (chinese: string) => {
    speak(chinese, { rate: speechRate, language: "zh-CN" }).catch(() => {});
  };

  return (
    <SafeAreaView
      className="flex-1 bg-brand-50 dark:bg-ink-950"
      edges={["top"]}
    >
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 py-3 border-b border-ink-100 dark:border-ink-800 bg-white/80 dark:bg-ink-900/80">
          <Pressable
            onPress={() => setShowSidebar(true)}
            className="p-1.5 -ml-1.5 active:opacity-50"
          >
            <Menu color="#6b7280" size={22} />
          </Pressable>
          <View
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: "#a855f7" }}
          >
            <Sparkles color="white" size={18} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900 dark:text-white">
              HSK AI Assistant
            </Text>
            <Text className="text-[10px] text-ink-500 dark:text-ink-400">
              Vocabulary & grammar knowledge base
            </Text>
          </View>
        </View>

        <View className="flex-1 flex-row">
          {/* Sidebar */}
          {showSidebar && (
            <Pressable
              className="absolute inset-0 z-10 bg-black/40"
              onPress={() => setShowSidebar(false)}
            />
          )}
          <View
            className={`absolute z-20 top-0 bottom-0 left-0 w-72 bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 ${showSidebar ? "" : "-translate-x-full"}`}
            style={{ paddingTop: insets.top + 8 }}
          >
            <View className="p-3 border-b border-ink-100 dark:border-ink-800">
              <Pressable
                onPress={newSession}
                className="rounded-xl py-2.5 flex-row items-center justify-center gap-2 active:opacity-80"
                style={{ backgroundColor: "#a855f7" }}
              >
                <Plus color="white" size={16} />
                <Text className="text-white text-sm font-semibold">
                  New Chat
                </Text>
              </Pressable>
            </View>
            <FlatList
              data={sessions}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setActiveId(item.id);
                    setShowSidebar(false);
                  }}
                  className={`flex-row items-start gap-2 px-3 py-2.5 rounded-xl mb-1 ${
                    item.id === activeId
                      ? "bg-brand-100 dark:bg-brand-700/30"
                      : "active:bg-ink-50 dark:active:bg-ink-800"
                  }`}
                >
                  <MessageSquare
                    color={item.id === activeId ? "#7e22ce" : "#6b7280"}
                    size={16}
                  />
                  <View className="flex-1 min-w-0">
                    <Text
                      numberOfLines={1}
                      className={`text-sm font-medium ${item.id === activeId ? "text-brand-700 dark:text-brand-300" : "text-ink-700 dark:text-ink-300"}`}
                    >
                      {item.title}
                    </Text>
                    {item.messages[item.messages.length - 1] && (
                      <Text
                        numberOfLines={1}
                        className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5"
                      >
                        {item.messages[item.messages.length - 1].content.slice(
                          0,
                          40,
                        )}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => deleteSession(item.id)}
                    className="p-1 active:opacity-50"
                  >
                    <Trash2 color="#f87171" size={14} />
                  </Pressable>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text className="text-center text-xs text-ink-400 py-8">
                  No conversations yet
                </Text>
              }
            />
          </View>

          {/* Main chat */}
          <View className="flex-1">
            {messages.length === 0 && !isGenerating ? (
              <EmptyState
                onPick={(t) => {
                  setInput(t);
                  inputRef.current?.focus();
                }}
              />
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <MessageBubble
                    msg={item}
                    onCopy={copyMsg}
                    onRegenerate={regenerate}
                    onDelete={deleteMessage}
                    onStartEdit={startEdit}
                    onSpeak={onSpeak}
                    isCopied={copiedId === item.id}
                    isEditing={editingId === item.id}
                    editText={editText}
                    setEditText={setEditText}
                    onSaveEdit={saveEdit}
                    onCancelEdit={() => {
                      setEditingId(null);
                      setEditText("");
                    }}
                    isGenerating={isGenerating}
                  />
                )}
                ListFooterComponent={
                  isGenerating ? (
                    streamingContent ? (
                      <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="items-start"
                      >
                        <View className="max-w-[85%] rounded-2xl rounded-bl-md bg-white dark:bg-ink-900 px-3 py-2.5 border border-ink-100 dark:border-ink-800">
                          <SimpleMarkdown>{streamingContent}</SimpleMarkdown>
                          <View className="w-1.5 h-3.5 bg-brand-500 animate-pulse ml-0.5 mt-1" />
                        </View>
                      </MotiView>
                    ) : (
                      <View className="items-start">
                        <View className="rounded-2xl rounded-bl-md bg-white dark:bg-ink-900 px-4 py-3 border border-ink-100 dark:border-ink-800 flex-row gap-1.5">
                          <View
                            className="w-2 h-2 rounded-full bg-brand-400"
                            style={{ opacity: 0.3 }}
                          />
                          <View
                            className="w-2 h-2 rounded-full bg-brand-400"
                            style={{ opacity: 0.6 }}
                          />
                          <View className="w-2 h-2 rounded-full bg-brand-400" />
                        </View>
                      </View>
                    )
                  ) : null
                }
              />
            )}

            {/* Input bar */}
            <View
              className="px-3 py-2 border-t border-ink-100 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90"
              style={{ paddingBottom: Math.max(insets.bottom, 8) }}
            >
              <View className="flex-row items-end gap-2 rounded-2xl bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 px-3 py-2">
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask about HSK vocabulary..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  className="flex-1 text-sm text-ink-900 dark:text-white max-h-28"
                  style={{ minHeight: 24 }}
                  editable={!isGenerating}
                />
                <Pressable
                  onPress={send}
                  disabled={!input.trim() || isGenerating}
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{
                    backgroundColor:
                      input.trim() && !isGenerating
                        ? "#a855f7"
                        : "rgba(139,92,246,0.15)",
                    opacity: !input.trim() || isGenerating ? 0.5 : 1,
                  }}
                >
                  <Send color="white" size={16} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(139,92,246,0.15)" }}
      >
        <BookOpen color="#a855f7" size={28} />
      </View>
      <Text className="text-lg font-bold text-ink-900 dark:text-white mb-1">
        HSK Study Assistant
      </Text>
      <Text className="text-sm text-ink-500 dark:text-ink-400 text-center mb-5 max-w-xs">
        Ask about Chinese vocabulary, grammar patterns, or get practice quizzes.
      </Text>
      <View className="flex-row flex-wrap gap-2 justify-center mb-3">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Pressable
              key={a.label}
              onPress={() => onPick(a.message)}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-100 dark:bg-brand-700/30 active:opacity-70"
            >
              <Icon color="#7e22ce" size={14} />
              <Text className="text-xs font-medium text-brand-700 dark:text-brand-300">
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row flex-wrap gap-2 justify-center">
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            className="px-3 py-2 rounded-xl bg-ink-100 dark:bg-ink-800 active:opacity-70"
          >
            <Text className="text-xs text-ink-600 dark:text-ink-400">{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface BubbleProps {
  msg: ChatMessage;
  onCopy: (id: string, content: string) => void;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: (id: string, content: string) => void;
  onSpeak: (chinese: string) => void;
  isCopied: boolean;
  isEditing: boolean;
  editText: string;
  setEditText: (s: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isGenerating: boolean;
}

function MessageBubble({
  msg,
  onCopy,
  onRegenerate,
  onDelete,
  onStartEdit,
  onSpeak,
  isCopied,
  isEditing,
  editText,
  setEditText,
  onSaveEdit,
  onCancelEdit,
  isGenerating,
}: BubbleProps) {
  const isUser = msg.role === "user";
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 200 }}
      className={`mb-3 ${isUser ? "items-end" : "items-start"}`}
    >
      {!isUser && (
        <View className="flex-row items-center mb-1">
          <View
            className="w-5 h-5 rounded-md items-center justify-center"
            style={{ backgroundColor: "#a855f7" }}
          >
            <Sparkles color="white" size={12} />
          </View>
        </View>
      )}
      {isEditing ? (
        <View className="max-w-[85%] gap-2">
          <TextInput
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            className="rounded-xl px-3 py-2 text-sm bg-white dark:bg-ink-900 border-2 border-brand-400 text-ink-900 dark:text-white"
          />
          <View className="flex-row gap-2 justify-end">
            <Pressable
              onPress={onCancelEdit}
              className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-ink-100 dark:bg-ink-800 active:opacity-70"
            >
              <X color="#6b7280" size={12} />
              <Text className="text-xs text-ink-600 dark:text-ink-400">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSaveEdit}
              className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg active:opacity-80"
              style={{ backgroundColor: "#a855f7" }}
            >
              <Check color="white" size={12} />
              <Text className="text-xs text-white">Save & Resend</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          className={`max-w-[85%] rounded-2xl px-3 py-2.5 ${
            isUser
              ? "rounded-br-md"
              : "rounded-bl-md bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800"
          }`}
          style={isUser ? { backgroundColor: "#a855f7" } : undefined}
        >
          {isUser ? (
            <Text className="text-sm text-white leading-relaxed">
              {msg.content}
            </Text>
          ) : (
            <SimpleMarkdown>{msg.content}</SimpleMarkdown>
          )}
        </View>
      )}

      {!isEditing && (
        <View
          className={`flex-row items-center gap-1 mt-1 ${isUser ? "justify-end" : "justify-start"}`}
        >
          {!isUser && (
            <>
              <Pressable
                onPress={() => onCopy(msg.id, msg.content)}
                className="px-1.5 py-1 rounded-md active:opacity-50"
              >
                {isCopied ? (
                  <Check color="#22c55e" size={12} />
                ) : (
                  <Copy color="#9ca3af" size={12} />
                )}
              </Pressable>
              <Pressable
                onPress={() => onRegenerate(msg.id)}
                disabled={isGenerating}
                className="px-1.5 py-1 rounded-md active:opacity-50"
              >
                <RefreshCw color="#9ca3af" size={12} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(msg.id)}
                className="px-1.5 py-1 rounded-md active:opacity-50"
              >
                <Trash2 color="#f87171" size={12} />
              </Pressable>
            </>
          )}
          {isUser && (
            <>
              <Pressable
                onPress={() => onStartEdit(msg.id, msg.content)}
                className="px-1.5 py-1 rounded-md active:opacity-50"
              >
                <Pencil color="#9ca3af" size={12} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(msg.id)}
                className="px-1.5 py-1 rounded-md active:opacity-50"
              >
                <Trash2 color="#f87171" size={12} />
              </Pressable>
            </>
          )}
        </View>
      )}

      {!isUser && msg.words && msg.words.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-2 max-w-[85%]">
          {msg.words.slice(0, 5).map((w) => (
            <WordChip key={w.id} word={w} onSpeak={onSpeak} />
          ))}
          {msg.words.length > 5 && (
            <Text className="text-[10px] text-ink-400 dark:text-ink-500 mt-1">
              +{msg.words.length - 5} more words
            </Text>
          )}
        </View>
      )}
    </MotiView>
  );
}

function WordChip({
  word,
  onSpeak,
}: {
  word: Word;
  onSpeak: (s: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-1.5 px-2 py-1 rounded-lg bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700">
      <Pressable
        onPress={() => onSpeak(word.chinese)}
        className="active:opacity-50"
      >
        <Volume2 color="#a855f7" size={12} />
      </Pressable>
      <Text className="text-xs font-bold text-ink-900 dark:text-white">
        {word.chinese}
      </Text>
      <Text className="text-[10px] text-ink-500 dark:text-ink-400 italic">
        {word.pinyin}
      </Text>
      <Text
        className="text-[10px] text-ink-600 dark:text-ink-300"
        numberOfLines={1}
      >
        {word.english.split(";")[0]}
      </Text>
    </View>
  );
}
