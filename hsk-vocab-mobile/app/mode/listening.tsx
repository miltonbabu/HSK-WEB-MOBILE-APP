import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Headphones, Volume2, SkipForward, Check, X } from 'lucide-react-native';
import { useDataSource } from '@/db/context';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { speak, stopSpeaking } from '@/services/speech';
import { gradeSRS } from '@/utils/srs';
import type { Word, UserProgress, HSKLevel } from '@/types';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;
const HSK_LEVELS: HSKLevel[] = [1, 2, 3, 4];

export default function ListeningMode() {
  const ds = useDataSource();
  const { user } = useAuthStore();
  const { speechRate, hapticsEnabled, setSpeechRate } = useSettingsStore();

  const [selectedLevel, setSelectedLevel] = useState<HSKLevel>(1);
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [userGuess, setUserGuess] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionStartRef = useRef(Date.now());

  // Load words for selected level
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsCorrect(null);
    setUserGuess('');
    setSessionStats({ correct: 0, total: 0 });

    ds.vocab.getWordsByLevel(selectedLevel).then((levelWords) => {
      if (mounted) {
        setWords(levelWords);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, [selectedLevel, ds.vocab]);

  const currentWord = words[currentIndex];

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticsEnabled) return;
    const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
    Haptics.impactAsync(map[type]).catch(() => {});
  }, [hapticsEnabled]);

  const speakWord = useCallback(async () => {
    if (!currentWord) return;
    setIsPlaying(true);
    try {
      await speak(currentWord.chinese, { rate: speechRate, language: 'zh-CN' });
    } catch {
      // ignore TTS errors
    } finally {
      // expo-speech doesn't give us an onEnd callback easily,
      // so we set a reasonable timeout based on word length
      setTimeout(() => setIsPlaying(false), Math.max(800, currentWord.chinese.length * 400));
    }
  }, [currentWord, speechRate]);

  const handleReveal = useCallback(() => {
    haptic('light');
    setShowAnswer(true);
    speakWord();
  }, [speakWord, haptic]);

  const handleAnswer = useCallback(async (correct: boolean) => {
    haptic(correct ? 'medium' : 'heavy');
    setIsCorrect(correct);
    setSessionStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // Update SRS progress
    if (currentWord && user) {
      try {
        const existing = await ds.progress.getForUser(user.id, currentWord.id);
        const quality: 0 | 1 | 2 | 3 | 4 | 5 = correct ? 4 : 1;
        const srsParams = existing
          ? { easinessFactor: existing.easiness_factor, interval: existing.interval, reviewCount: existing.review_count }
          : { easinessFactor: 2.5, interval: 0, reviewCount: 0 };
        const correctCount = existing?.correct_count ?? 0;
        const update = gradeSRS(srsParams, correctCount, quality);
        await ds.progress.upsert({
          user_id: user.id,
          word_id: currentWord.id,
          mastery_level: update.mastery_level,
          next_review: update.next_review,
          easiness_factor: update.easiness_factor,
          interval: update.interval,
          review_count: update.review_count,
          correct_count: update.correct_count,
          last_reviewed: update.last_reviewed,
        });
      } catch (e) {
        console.error('Failed to update progress:', e);
      }
    }

    setTimeout(() => {
      setShowAnswer(false);
      setIsCorrect(null);
      setUserGuess('');
      setCurrentIndex((prev) => (prev < words.length - 1 ? prev + 1 : 0));
    }, 1500);
  }, [currentWord, user, words.length, ds.progress, haptic]);

  const checkGuess = useCallback(() => {
    if (!userGuess.trim() || !currentWord) return;
    const correct = userGuess.trim().toLowerCase() === currentWord.english.toLowerCase();
    handleAnswer(correct);
  }, [userGuess, currentWord, handleAnswer]);

  const handleSkip = useCallback(() => {
    haptic('light');
    stopSpeaking();
    setShowAnswer(false);
    setIsCorrect(null);
    setUserGuess('');
    setCurrentIndex((prev) => (prev < words.length - 1 ? prev + 1 : 0));
  }, [words.length, haptic]);

  // Cleanup speech on unmount + record session
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (sessionStats.total > 0) {
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
        const accuracy = sessionStats.total > 0
          ? Math.round((sessionStats.correct / sessionStats.total) * 100)
          : 0;
        const userId = user?.id || "guest";
        ds.sessions.record({
          user_id: userId,
          mode: "listening",
          words_studied: sessionStats.total,
          accuracy,
          duration,
          date: new Date().toISOString(),
        }).catch(() => {});
        ds.profiles.updateStreak(userId).catch(() => {});
        const leaderboardScore = sessionStats.total * 10 * (accuracy / 100);
        ds.leaderboard.addEntry({
          user_id: userId,
          username: user?.username || "Guest",
          score: Math.max(0, leaderboardScore),
          accuracy,
          mode: "listening",
        }).catch(() => {});
      }
    };
  }, [sessionStats.total, sessionStats.correct, user]);

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950" edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#a855f7" />
      </SafeAreaView>
    );
  }

  // ─── Empty ────────────────────────────────────────────────
  if (words.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 px-6" edges={['top', 'bottom']}>
        <Headphones size={48} color="#a855f7" />
        <Text className="text-xl font-bold text-ink-900 dark:text-white mt-4">No Words Available</Text>
        <Text className="text-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
          No words found for HSK {selectedLevel}.
        </Text>
      </SafeAreaView>
    );
  }

  const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
  const progressPct = ((currentIndex + 1) / words.length) * 100;

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={['top', 'bottom']}>
      {/* ─── Level Picker Pills ──────────────────────────── */}
      <View className="px-4 pt-2 pb-1 flex-row gap-2">
        {HSK_LEVELS.map((lvl) => (
          <Pressable
            key={lvl}
            onPress={() => { setSelectedLevel(lvl); haptic('light'); }}
            className={`px-3 py-1.5 rounded-full ${
              selectedLevel === lvl
                ? 'bg-brand-500'
                : 'bg-ink-100 dark:bg-ink-800'
            }`}
          >
            <Text className={`text-xs font-semibold ${
              selectedLevel === lvl ? 'text-white' : 'text-ink-600 dark:text-ink-300'
            }`}>
              HSK {lvl}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ─── Header ──────────────────────────────────────── */}
      <View className="px-4 pt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-ink-900 dark:text-white">Listening Practice</Text>
          <Text className="text-sm text-ink-500 dark:text-ink-400">
            HSK {selectedLevel} • Word {currentIndex + 1}/{words.length}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-sm text-ink-500 dark:text-ink-400">Accuracy</Text>
          <Text className="text-lg font-semibold text-brand-600 dark:text-brand-400">{accuracy}%</Text>
        </View>
      </View>

      {/* ─── Progress Bar ────────────────────────────────── */}
      <View className="mx-4 mt-3 h-2 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: 'timing', duration: 300 }}
          className="h-full bg-jade-500 rounded-full"
        />
      </View>

      {/* ─── Card ────────────────────────────────────────── */}
      <MotiView
        key={currentWord.id}
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 250 }}
        className="mx-4 mt-6 bg-white dark:bg-ink-800 rounded-2xl p-8 shadow-sm"
      >
        <View className="items-center">
          {!showAnswer ? (
            <>
              {/* Play button */}
              <Pressable
                onPress={speakWord}
                disabled={isPlaying}
                className={`w-24 h-24 rounded-full items-center justify-center ${
                  isPlaying ? 'bg-brand-300' : 'bg-brand-500'
                } active:opacity-70`}
              >
                <Volume2 size={36} color="white" />
              </Pressable>
              <Text className="mt-4 text-sm text-ink-400 dark:text-ink-400">
                {isPlaying ? 'Playing...' : 'Tap to listen'}
              </Text>

              {/* Guess input */}
              <View className="mt-8 w-full items-center">
                <Text className="text-sm text-ink-500 dark:text-ink-400 mb-2">
                  Type the English meaning:
                </Text>
                <TextInput
                  value={userGuess}
                  onChangeText={setUserGuess}
                  onSubmitEditing={checkGuess}
                  placeholder="Your answer..."
                  placeholderTextColor="#9ca3af"
                  className="w-64 text-center text-base px-4 py-3 rounded-xl bg-ink-50 dark:bg-ink-700 text-ink-900 dark:text-white border border-ink-200 dark:border-ink-600"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    onPress={handleReveal}
                    className="px-5 py-2.5 rounded-xl bg-ink-100 dark:bg-ink-700 active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-ink-700 dark:text-ink-200">Reveal</Text>
                  </Pressable>
                  <Pressable
                    onPress={checkGuess}
                    disabled={!userGuess.trim()}
                    className={`px-5 py-2.5 rounded-xl active:opacity-70 ${
                      userGuess.trim() ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${
                      userGuess.trim() ? 'text-white' : 'text-ink-400 dark:text-ink-500'
                    }`}>Submit</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Revealed answer */}
              <Text className="text-5xl font-bold text-ink-900 dark:text-white">
                {currentWord.chinese}
              </Text>
              <Text className="mt-3 text-2xl text-ink-600 dark:text-ink-300">
                {currentWord.pinyin}
              </Text>
              <Text className={`mt-2 text-xl ${
                isCorrect === null
                  ? 'text-ink-700 dark:text-ink-300'
                  : isCorrect
                    ? 'text-jade-600 dark:text-jade-400'
                    : 'text-red-500'
              }`}>
                {currentWord.english}
              </Text>
              {currentWord.pos.length > 0 && (
                <Text className="mt-1 text-sm text-ink-400 dark:text-ink-500">
                  ({currentWord.pos.join(', ')})
                </Text>
              )}

              {/* Correct / Wrong feedback */}
              {isCorrect !== null && (
                <MotiView
                  from={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="mt-6"
                >
                  {isCorrect ? (
                    <Check size={48} color="#22c55e" />
                  ) : (
                    <X size={48} color="#ef4444" />
                  )}
                </MotiView>
              )}

              {/* Correct / Wrong buttons (only show before answer is graded) */}
              {isCorrect === null && (
                <View className="mt-8 flex-row gap-4">
                  <Pressable
                    onPress={() => handleAnswer(false)}
                    className="flex-row items-center gap-2 px-6 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 active:opacity-70"
                  >
                    <X size={20} color="#ef4444" />
                    <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Wrong</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAnswer(true)}
                    className="flex-row items-center gap-2 px-6 py-3 rounded-xl bg-jade-400/20 dark:bg-jade-500/20 active:opacity-70"
                  >
                    <Check size={20} color="#22c55e" />
                    <Text className="text-sm font-semibold text-jade-600 dark:text-jade-400">Correct</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </MotiView>

      {/* ─── Speed + Skip ────────────────────────────────── */}
      <View className="px-4 mt-5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-ink-400 dark:text-ink-500">Speed:</Text>
          {PLAYBACK_SPEEDS.map((speed) => (
            <Pressable
              key={speed}
              onPress={() => { setSpeechRate(speed); haptic('light'); }}
              className={`px-2.5 py-1 rounded-lg ${
                speechRate === speed
                  ? 'bg-brand-500'
                  : 'bg-ink-100 dark:bg-ink-800'
              } active:opacity-70`}
            >
              <Text className={`text-xs font-medium ${
                speechRate === speed ? 'text-white' : 'text-ink-600 dark:text-ink-300'
              }`}>
                {speed}x
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSkip}
          className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl bg-ink-100 dark:bg-ink-800 active:opacity-70"
        >
          <SkipForward size={16} color="#6b7280" />
          <Text className="text-sm font-medium text-ink-600 dark:text-ink-300">Skip</Text>
        </Pressable>
      </View>

      {/* ─── Session Stats ───────────────────────────────── */}
      <View className="mx-4 mt-5 p-4 rounded-2xl bg-ink-50 dark:bg-ink-800/50">
        <Text className="text-xs font-medium text-ink-400 dark:text-ink-500 mb-2">Session Stats</Text>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-lg font-bold text-ink-900 dark:text-white">{sessionStats.total}</Text>
            <Text className="text-xs text-ink-400 dark:text-ink-500">Studied</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-jade-600 dark:text-jade-400">{sessionStats.correct}</Text>
            <Text className="text-xs text-ink-400 dark:text-ink-500">Correct</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-red-500">{sessionStats.total - sessionStats.correct}</Text>
            <Text className="text-xs text-ink-400 dark:text-ink-500">Wrong</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-brand-600 dark:text-brand-400">{accuracy}%</Text>
            <Text className="text-xs text-ink-400 dark:text-ink-500">Accuracy</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
