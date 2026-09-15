import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Sparkles, GraduationCap, MessageCircle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { ConversationScenario } from '@/data/conversationScenarios';
import { GrammarPattern } from '@/data/grammarPatterns';

interface Props {
  scenario?: ConversationScenario | null;
  pattern?: GrammarPattern | null;
  onClear: () => void;
}

export function ContextCard({ scenario, pattern, onClear }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const ctx = scenario || pattern;

  if (!ctx) return null;

  const isScenario = 'setting' in ctx;

  return (
    <View
      className="px-4 py-3 border-b border-ink-100 dark:border-ink-800"
      style={{
        backgroundColor: isDark ? '#0a0a15' : '#faf9ff',
      }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-1.5 mb-1">
            <View
              className="w-5 h-5 rounded-full items-center justify-center"
              style={{
                backgroundColor: isScenario
                  ? '#fce7f3'
                  : '#ede9fe',
              }}
            >
              {isScenario ? (
                <MessageCircle size={12} color="#ec4899" />
              ) : (
                <GraduationCap size={12} color="#8b5cf6" />
              )}
            </View>
            <Text
              className="text-xs font-semibold text-ink-900 dark:text-white truncate"
            >
              {isScenario
                ? `Scenario: ${ctx.title}`
                : `Grammar: ${ctx.name}`}
            </Text>
          </View>
          {isScenario && (
            <Text
              numberOfLines={1}
              className="text-[10px] text-ink-500 dark:text-ink-400 truncate"
            >
              {ctx.setting} · You are {ctx.aiRole}
            </Text>
          )}
          {!isScenario && (
            <Text
              numberOfLines={1}
              className="text-[10px] text-ink-500 dark:text-ink-400 truncate"
            >
              Structure: {ctx.structure}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onClear}
          className="p-1.5 rounded-lg active:opacity-50"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <X size={14} color="#9ca3af" />
        </Pressable>
      </View>
    </View>
  );
}