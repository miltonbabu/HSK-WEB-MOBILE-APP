import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  GraduationCap,
  MessageCircle,
  Plane,
  Music,
  Briefcase,
  Ellipsis,
  Target,
  Flame,
  Trophy,
  Zap,
  ChevronRight,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { useSettingsStore, type LearningReason } from '@/stores/settings';

const HSK_LEVELS = [
  { level: 0, label: 'Beginner', desc: 'Starting from scratch', color: '#8b5cf6' },
  { level: 1, label: 'HSK 1', desc: '~300 words', color: '#8b5cf6' },
  { level: 2, label: 'HSK 2', desc: '~300 words', color: '#10b981' },
  { level: 3, label: 'HSK 3', desc: '~500 words', color: '#f59e0b' },
  { level: 4, label: 'HSK 4', desc: '~1000 words', color: '#ec4899' },
];

const DAILY_GOALS = [
  { value: 10, icon: Target, label: '10 words', sub: 'Casual' },
  { value: 20, icon: BookOpen, label: '20 words', sub: 'Steady' },
  { value: 30, icon: Flame, label: '30 words', sub: 'Focused' },
  { value: 50, icon: Trophy, label: '50 words', sub: 'Intense' },
];

const REASONS: { key: LearningReason; icon: any; label: string; color: string }[] = [
  { key: 'hsk_exam', icon: GraduationCap, label: 'HSK Exam', color: '#8b5cf6' },
  { key: 'conversation', icon: MessageCircle, label: 'Conversation', color: '#10b981' },
  { key: 'travel', icon: Plane, label: 'Travel', color: '#f59e0b' },
  { key: 'culture', icon: Music, label: 'Culture & Media', color: '#ec4899' },
  { key: 'work', icon: Briefcase, label: 'Work / Business', color: '#3b82f6' },
  { key: 'other', icon: Ellipsis, label: 'Other', color: '#6b7280' },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboarding, onboardingCompleted } = useSettingsStore();

  const [step, setStep] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [learningReason, setLearningReason] = useState<LearningReason>('');
  const [createPlan, setCreatePlan] = useState(true);

  // Already completed? Go back
  if (onboardingCompleted && step === 0) {
    // Allow going through again from settings
  }

  const totalSteps = 4;

  const goNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      setOnboarding({ hskLevel: selectedLevel, dailyGoal, learningReason });
      router.back();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const progress = (step + 1) / totalSteps;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="px-5 pt-2 pb-1 flex-row items-center justify-between">
        <Pressable onPress={goBack} disabled={step === 0} className="w-10 h-10 items-center justify-center">
          {step > 0 && <ChevronRight size={20} color="#94a3b8" style={{ transform: [{ rotate: '180deg' }] }} />}
        </Pressable>
        <View className="flex-row gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i <= step ? '#8b5cf6' : '#e2e8f0',
              }}
            />
          ))}
        </View>
        <Pressable onPress={goNext} className="w-10 h-10 items-center justify-center">
          <ChevronRight size={20} color="#334155" />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View className="px-5 pt-1 pb-4">
        <View className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <Animated.View
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: '#8b5cf6',
            }}
          />
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-5">
        {/* Step 0: Select HSK Level */}
        {step === 0 && (
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 mb-1">Welcome to XueTong!</Text>
            <Text className="text-sm text-slate-500 mb-6">What's your current Chinese level?</Text>
            <View className="gap-3">
              {HSK_LEVELS.map((l) => {
                const selected = selectedLevel === l.level;
                return (
                  <Pressable
                    key={l.level}
                    onPress={() => setSelectedLevel(l.level)}
                    className="rounded-2xl p-4 border-2"
                    style={{
                      backgroundColor: selected ? `${l.color}10` : '#f8fafc',
                      borderColor: selected ? l.color : 'transparent',
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-lg font-bold" style={{ color: selected ? l.color : '#334155' }}>
                          {l.label}
                        </Text>
                        <Text className="text-sm text-slate-500">{l.desc}</Text>
                      </View>
                      {selected && (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: l.color }}>
                          <Check size={14} color="white" />
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 1: Daily Goal */}
        {step === 1 && (
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 mb-1">Set Your Daily Goal</Text>
            <Text className="text-sm text-slate-500 mb-6">How many words do you want to study each day?</Text>
            <View className="flex-row flex-wrap gap-3">
              {DAILY_GOALS.map((g) => {
                const selected = dailyGoal === g.value;
                const Icon = g.icon;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => setDailyGoal(g.value)}
                    className="rounded-2xl p-4 border-2 w-[47%] items-center"
                    style={{
                      backgroundColor: selected ? '#f5f3ff' : '#f8fafc',
                      borderColor: selected ? '#8b5cf6' : 'transparent',
                    }}
                  >
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center mb-2"
                      style={{ backgroundColor: selected ? '#8b5cf6' : '#e2e8f0' }}
                    >
                      <Icon size={20} color={selected ? 'white' : '#64748b'} />
                    </View>
                    <Text className="text-lg font-bold text-slate-900">{g.label}</Text>
                    <Text className="text-xs text-slate-500">{g.sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 2: Learning Reason */}
        {step === 2 && (
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 mb-1">Why Are You Learning?</Text>
            <Text className="text-sm text-slate-500 mb-6">This helps us tailor your study experience.</Text>
            <View className="gap-3">
              {REASONS.map((r) => {
                const selected = learningReason === r.key;
                const Icon = r.icon;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setLearningReason(r.key)}
                    className="rounded-2xl p-4 border-2 flex-row items-center gap-4"
                    style={{
                      backgroundColor: selected ? `${r.color}10` : '#f8fafc',
                      borderColor: selected ? r.color : 'transparent',
                    }}
                  >
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: selected ? r.color : '#e2e8f0' }}
                    >
                      <Icon size={20} color={selected ? 'white' : '#64748b'} />
                    </View>
                    <Text className="text-lg font-semibold flex-1" style={{ color: selected ? r.color : '#334155' }}>
                      {r.label}
                    </Text>
                    {selected && <Check size={18} color={r.color} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Personalized Plan */}
        {step === 3 && (
          <View className="flex-1">
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-2xl bg-purple-100 items-center justify-center mb-4">
                <Sparkles size={30} color="#8b5cf6" />
              </View>
              <Text className="text-2xl font-bold text-slate-900 mb-1">Personalized Plan</Text>
              <Text className="text-sm text-slate-500 text-center">
                Do you want our AI to create a personalized study plan for you?
              </Text>
            </View>
            <View className="gap-3">
              <Pressable
                onPress={() => setCreatePlan(true)}
                className="rounded-2xl p-5 border-2"
                style={{
                  backgroundColor: createPlan ? '#f5f3ff' : '#f8fafc',
                  borderColor: createPlan ? '#8b5cf6' : '#e2e8f0',
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center">
                    <Zap size={20} color="#8b5cf6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-slate-900">Yes, create a plan</Text>
                    <Text className="text-sm text-slate-500">
                      Get daily tips, level-appropriate content, and AI guidance
                    </Text>
                  </View>
                  {createPlan && <Check size={18} color="#8b5cf6" />}
                </View>
              </Pressable>
              <Pressable
                onPress={() => setCreatePlan(false)}
                className="rounded-2xl p-5 border-2"
                style={{
                  backgroundColor: !createPlan ? '#f8fafc' : '#ffffff',
                  borderColor: !createPlan ? '#cbd5e1' : '#e2e8f0',
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center">
                    <Target size={20} color="#64748b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-slate-900">I'll explore on my own</Text>
                    <Text className="text-sm text-slate-500">Browse freely and learn at your own pace</Text>
                  </View>
                  {!createPlan && <Check size={18} color="#64748b" />}
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="px-5 pb-6 pt-2 border-t border-slate-100">
        <Pressable
          onPress={goNext}
          className="w-full py-3.5 rounded-2xl items-center"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          <Text className="text-white font-semibold text-base">
            {step === totalSteps - 1 ? 'Start Learning!' : 'Next'}
          </Text>
        </Pressable>
        {step === totalSteps - 1 && (
          <Pressable onPress={() => { setOnboarding({ hskLevel: selectedLevel, dailyGoal, learningReason }); router.back(); }} className="mt-3 items-center">
            <Text className="text-sm text-slate-400">Skip</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}