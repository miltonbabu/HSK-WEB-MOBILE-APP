import { View, Pressable, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import { AI_MODES, AIMode } from '@/data/aiModes';

interface Props {
  active: AIMode;
  onChange: (mode: AIMode) => void;
}

export function AIModeTabs({ active, onChange }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
    >
      {AI_MODES.map((mode) => (
        <Pressable
          key={mode.id}
          onPress={() => onChange(mode.id)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:opacity-80"
          style={{
            backgroundColor:
              active === mode.id
                ? isDark
                  ? '#7e22ce'
                  : '#a855f7'
                : isDark
                ? '#1f2937'
                : 'rgba(0,0,0,0.05)',
          }}
        >
          <mode.icon
            size={14}
            color={
              active === mode.id ? '#fff' : isDark ? '#d1d5db' : '#6b7280'
            }
          />
          <Text
            className="text-xs font-semibold"
            style={{
              color:
                active === mode.id ? '#fff' : isDark ? '#d1d5db' : '#6b7280',
            }}
          >
            {mode.shortLabel}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

import { Text } from 'react-native';