import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center bg-brand-50 dark:bg-ink-950 p-6">
      <Text className="text-6xl font-bold text-brand-500 mb-2">404</Text>
      <Text className="text-lg font-semibold text-ink-900 dark:text-white mb-4">Page not found</Text>
      <Pressable onPress={() => router.replace('/')} className="rounded-xl px-5 py-3 active:opacity-80" style={{ backgroundColor: '#a855f7' }}>
        <Text className="text-white font-semibold">Go home</Text>
      </Pressable>
    </View>
  );
}
