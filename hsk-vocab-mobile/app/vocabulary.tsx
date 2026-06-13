import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Search, Volume2 } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useDataSource } from "@/db/context";
import { speak } from "@/services/speech";
import { useSettingsStore } from "@/stores/settings";
import type { Word, HSKLevel } from "@/types";

// ── Level colors ──
const LEVEL_COLORS: Record<number, { bg: string; shadow: string }> = {
  1: { bg: "#8b5cf6", shadow: "rgba(139,92,246,0.35)" },
  2: { bg: "#10b981", shadow: "rgba(16,185,129,0.35)" },
  3: { bg: "#f59e0b", shadow: "rgba(245,158,11,0.35)" },
  4: { bg: "#ec4899", shadow: "rgba(236,72,153,0.35)" },
};

// ── Example sentence generation ──
interface ExampleData {
  chinese: string;
  pinyin: string;
  english: string;
}

function cleanEn(en: string): string {
  return en
    .split(";")[0]
    .split(",")[0]
    .replace(/\([^)]*\)/g, "")
    .trim();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateExamples(word: Word): ExampleData[] {
  if (
    Array.isArray(word.example_sentences) &&
    word.example_sentences.length > 0
  ) {
    return word.example_sentences.map((s) => ({
      chinese: s,
      pinyin: "",
      english: "",
    }));
  }
  const ch = word.chinese;
  const py = word.pinyin;
  const en = cleanEn(word.english);
  const pos = Array.isArray(word.pos) ? word.pos : [];

  if (pos.includes("verb")) {
    return [
      {
        chinese: `我${ch}你。`,
        pinyin: `Wǒ ${py} nǐ.`,
        english: `I ${en} you.`,
      },
      {
        chinese: `他${ch}学习中文。`,
        pinyin: `Tā ${py} xuéxí zhōngwén.`,
        english: `He ${en}s studying Chinese.`,
      },
      {
        chinese: `她很${ch}这本书。`,
        pinyin: `Tā hěn ${py} zhè běn shū.`,
        english: `She really ${en}s this book.`,
      },
    ];
  } else if (pos.includes("noun")) {
    return [
      {
        chinese: `这是我的${ch}。`,
        pinyin: `Zhè shì wǒ de ${py}.`,
        english: `This is my ${en}.`,
      },
      {
        chinese: `他的${ch}很好。`,
        pinyin: `Tā de ${py} hěn hǎo.`,
        english: `His ${en} is very good.`,
      },
      {
        chinese: `我喜欢这个${ch}。`,
        pinyin: `Wǒ xǐhuan zhège ${py}.`,
        english: `I like this ${en}.`,
      },
    ];
  } else if (pos.includes("adjective")) {
    return [
      {
        chinese: `今天天气很${ch}。`,
        pinyin: `Jīntiān tiānqì hěn ${py}.`,
        english: `The weather is very ${en} today.`,
      },
      {
        chinese: `她是一个${ch}的人。`,
        pinyin: `Tā shì yígè ${py} de rén.`,
        english: `She is a ${en} person.`,
      },
      {
        chinese: `这个地方非常${ch}。`,
        pinyin: `Zhège dìfāng fēicháng ${py}.`,
        english: `This place is very ${en}.`,
      },
    ];
  } else if (pos.includes("adverb")) {
    return [
      {
        chinese: `我${ch}去学校。`,
        pinyin: `Wǒ ${py} qù xuéxiào.`,
        english: `I go to school ${en}.`,
      },
      {
        chinese: `他${ch}高兴。`,
        pinyin: `Tā ${py} gāoxìng.`,
        english: `He is ${en} happy.`,
      },
      {
        chinese: `她${ch}喜欢唱歌。`,
        pinyin: `Tā ${py} xǐhuan chànggē.`,
        english: `She likes singing ${en}.`,
      },
    ];
  } else if (pos.includes("pronoun")) {
    return [
      {
        chinese: `${ch}是我的朋友。`,
        pinyin: `${capitalize(py)} shì wǒ de péngyǒu.`,
        english: `${capitalize(en)} is my friend.`,
      },
      {
        chinese: `${ch}喜欢看电影。`,
        pinyin: `${capitalize(py)} xǐhuan kàn diànyǐng.`,
        english: `${capitalize(en)} likes watching movies.`,
      },
      {
        chinese: `${ch}每天都很忙。`,
        pinyin: `${capitalize(py)} měitiān dōu hěn máng.`,
        english: `${capitalize(en)} is busy every day.`,
      },
    ];
  } else if (pos.includes("preposition")) {
    return [
      {
        chinese: `我${ch}朋友一起去。`,
        pinyin: `Wǒ ${py} péngyǒu yìqǐ qù.`,
        english: `I go together ${en} my friend.`,
      },
      {
        chinese: `他${ch}我在一起很开心。`,
        pinyin: `Tā ${py} wǒ zài yìqǐ hěn kāixīn.`,
        english: `He is very happy together ${en} me.`,
      },
    ];
  } else if (pos.includes("conjunction")) {
    return [
      {
        chinese: `我${ch}他都是学生。`,
        pinyin: `Wǒ ${py} tā dōu shì xuéshēng.`,
        english: `Both he ${en} I are students.`,
      },
      {
        chinese: `你喜欢茶${ch}咖啡？`,
        pinyin: `Nǐ xǐhuan chá ${py} kāfēi?`,
        english: `Do you like tea ${en} coffee?`,
      },
    ];
  } else if (pos.includes("measure")) {
    return [
      {
        chinese: `我一${ch}书。`,
        pinyin: `Wǒ yí${py} shū.`,
        english: `I have one ${en} of book.`,
      },
      {
        chinese: `他两${ch}猫。`,
        pinyin: `Tā liǎng${py} māo.`,
        english: `He has two ${en} of cats.`,
      },
    ];
  } else if (pos.includes("number")) {
    return [
      {
        chinese: `我有${ch}个朋友。`,
        pinyin: `Wǒ yǒu ${py} gè péngyǒu.`,
        english: `I have ${en} friends.`,
      },
      {
        chinese: `${ch}个人来了。`,
        pinyin: `${capitalize(py)} gè rén lái le.`,
        english: `${capitalize(en)} people came.`,
      },
    ];
  } else if (pos.includes("particle")) {
    return [
      { chinese: `好${ch}！`, pinyin: `Hǎo ${py}!`, english: `Okay! / Good!` },
      {
        chinese: `是${ch}，我知道了。`,
        pinyin: `Shì ${py}, wǒ zhīdào le.`,
        english: `Yes, I know.`,
      },
      { chinese: `走吧${ch}！`, pinyin: `Zǒu ba ${py}!`, english: `Let's go!` },
    ];
  } else if (pos.includes("interjection")) {
    return [
      {
        chinese: `${ch}，你说什么？`,
        pinyin: `${capitalize(py)}, nǐ shuō shénme?`,
        english: `${capitalize(en)}! What did you say?`,
      },
      {
        chinese: `${ch}，太好了！`,
        pinyin: `${capitalize(py)}, tài hǎo le!`,
        english: `${capitalize(en)}! That's great!`,
      },
      {
        chinese: `${ch}，我明白了。`,
        pinyin: `${capitalize(py)}, wǒ míngbái le.`,
        english: `${capitalize(en)}! I understand.`,
      },
    ];
  } else if (pos.includes("prefix") || pos.includes("suffix")) {
    return [
      {
        chinese: `这个${ch}很有意思。`,
        pinyin: `Zhège ${py} hěn yǒu yìsi.`,
        english: `This ${en} is very interesting.`,
      },
      {
        chinese: `那个${ch}不太好。`,
        pinyin: `Nàge ${py} bú tài hǎo.`,
        english: `That ${en} is not very good.`,
      },
    ];
  } else {
    return [
      {
        chinese: `我知道${ch}的意思。`,
        pinyin: `Wǒ zhīdào ${py} de yìsi.`,
        english: `I know the meaning of ${en}.`,
      },
      {
        chinese: `请再说一次${ch}。`,
        pinyin: `Qǐng zài shuō yícì ${py}.`,
        english: `Please say ${en} again.`,
      },
      {
        chinese: `${ch}是什么意思？`,
        pinyin: `${capitalize(py)} shì shénme yìsi?`,
        english: `What does ${en} mean?`,
      },
    ];
  }
}

// ── Highlight word in sentence ──
function HighlightedSentence({
  sentence,
  word,
}: {
  sentence: string;
  word: string;
}) {
  const parts = sentence.split(word);
  if (parts.length === 1) {
    return (
      <Text className="text-sm leading-relaxed text-ink-900 dark:text-white">
        {sentence}
      </Text>
    );
  }
  return (
    <Text className="text-sm leading-relaxed">
      {parts.map((part, idx) => (
        <Text key={idx}>
          <Text className="text-ink-900 dark:text-white">{part}</Text>
          {idx < parts.length - 1 && (
            <Text className="font-bold text-purple-600 dark:text-purple-400 bg-purple-100/60 dark:bg-purple-900/30">
              {word}
            </Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

// ── Main screen ──
export default function Vocabulary() {
  const { level } = useLocalSearchParams<{ level?: string }>();
  const router = useRouter();
  const ds = useDataSource();
  const speechRate = useSettingsStore((s) => s.speechRate);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [words, setWords] = useState<Word[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<HSKLevel | "all">(
    level ? (Number(level) as HSKLevel) : "all",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list =
          activeLevel === "all"
            ? await ds.vocab.searchWords("", 500)
            : await ds.vocab.getWordsByLevel(activeLevel);
        setWords(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [ds, activeLevel]);

  useEffect(() => {
    if (!query.trim()) {
      (async () => {
        const list =
          activeLevel === "all"
            ? await ds.vocab.searchWords("", 500)
            : await ds.vocab.getWordsByLevel(activeLevel);
        setWords(list);
      })();
      return;
    }
    const t = setTimeout(async () => {
      const list = await ds.vocab.searchWords(query, 200);
      setWords(list);
    }, 250);
    return () => clearTimeout(t);
  }, [query, ds, activeLevel]);

  const handleSpeak = useCallback(
    (chinese: string, id: string) => {
      setSpeakingId(id);
      speak(chinese, { rate: speechRate })
        .catch((e) => console.warn("Vocab speak error:", e))
        .finally(() => setSpeakingId(null));
    },
    [speechRate],
  );

  const renderItem = ({ item, index }: { item: Word; index: number }) => {
    const color = LEVEL_COLORS[item.hsk_level] || LEVEL_COLORS[1];
    const isExpanded = expandedId === item.id;
    const isSpeaking = speakingId === item.id;
    const examples = generateExamples(item);
    const posText = Array.isArray(item.pos)
      ? item.pos.join(" · ")
      : String(item.pos || "");

    return (
      <Pressable
        onPress={() => {
          setExpandedId(isExpanded ? null : item.id);
        }}
        className="rounded-2xl bg-white dark:bg-ink-900 p-4 active:opacity-80"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        {/* ── Card header ── */}
        <View className="flex-row items-center gap-3">
          {/* Number badge */}
          <View
            className="w-10 h-10 rounded-lg items-center justify-center"
            style={{ backgroundColor: color.bg + "22" }}
          >
            <Text className="text-sm font-bold" style={{ color: color.bg }}>
              {index + 1}
            </Text>
          </View>

          {/* Chinese character button */}
          <Pressable
            onPress={() => handleSpeak(item.chinese, item.id)}
            className="px-4 py-2 rounded-xl items-center justify-center"
            style={{
              backgroundColor: isSpeaking ? "#8b5cf6" : color.bg,
              shadowColor: isSpeaking ? "#8b5cf6" : color.bg,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isSpeaking ? 0.5 : 0.3,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text className="text-lg font-bold text-white">{item.chinese}</Text>
          </Pressable>

          {/* Word info */}
          <View className="flex-1 min-w-0">
            <Text className="text-base italic text-teal-600 dark:text-teal-400">
              {item.pinyin}
            </Text>
            <Text
              className="text-sm text-ink-600 dark:text-ink-300 mt-0.5"
              numberOfLines={1}
            >
              {item.english}
            </Text>
          </View>

          {/* POS tag */}
          <View className="flex-row items-center gap-2">
            {posText ? (
              <View className="px-2 py-1 rounded-md bg-ink-100/50 dark:bg-white/10">
                <Text className="text-[10px] font-medium text-ink-500 dark:text-ink-400">
                  {posText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Expanded: example sentences ── */}
        {isExpanded && (
          <View className="mt-3 ml-11 space-y-2">
            {/* Word summary */}
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-bold text-purple-600 dark:text-purple-400">
                {item.chinese}
              </Text>
              <Text className="text-xs italic text-teal-600 dark:text-teal-400">
                {item.pinyin}
              </Text>
              <Text className="text-xs text-ink-500 dark:text-ink-400">
                = {item.english.split(";")[0]}
              </Text>
            </View>

            {/* Example cards */}
            {examples.map((ex, si) => {
              const exSpeakingId = `${item.id}-ex${si}`;
              const isExSpeaking = speakingId === exSpeakingId;
              return (
                <View
                  key={si}
                  className="p-2.5 rounded-lg bg-ink-50/50 dark:bg-white/5 border border-ink-100/30 dark:border-white/5"
                >
                  <View className="flex-row items-start gap-2">
                    <View className="flex-1">
                      <HighlightedSentence
                        sentence={ex.chinese}
                        word={item.chinese}
                      />
                      {ex.pinyin ? (
                        <Text className="text-xs italic text-teal-600 dark:text-teal-400 mt-1">
                          {ex.pinyin}
                        </Text>
                      ) : null}
                      {ex.english ? (
                        <Text className="text-xs text-ink-600 dark:text-ink-300 mt-0.5">
                          {ex.english}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleSpeak(ex.chinese, exSpeakingId)}
                      className="mt-0.5 p-1 active:opacity-50"
                    >
                      <Volume2
                        size={14}
                        color={isExSpeaking ? "#8b5cf6" : "#9ca3af"}
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-ink-950" edges={[]}>
      {/* ── Search bar ── */}
      <View className="px-4 pt-3 pb-2">
        <View
          className="flex-row items-center gap-2 rounded-2xl bg-white dark:bg-ink-900 border-2 border-brand-200 dark:border-brand-600/40 px-3 py-1.5"
          style={{
            shadowColor: "#a855f7",
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Search color="#a855f7" size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search HSK vocabulary…"
            placeholderTextColor="#9ca3af"
            className="flex-1 text-sm text-ink-900 dark:text-white"
            autoCorrect={false}
          />
          <Text className="text-xs text-ink-400 dark:text-ink-500">
            {words.length}
          </Text>
        </View>
        <View className="flex-row gap-2 mt-3">
          {(["all", 1, 2, 3, 4] as const).map((l) => {
            const lvlColor =
              l === "all" ? "#a855f7" : LEVEL_COLORS[l]?.bg || "#a855f7";
            const isActive = activeLevel === l;
            return (
              <Pressable
                key={String(l)}
                onPress={() => setActiveLevel(l as HSKLevel | "all")}
                className="flex-1 items-center py-3.5 rounded-2xl active:opacity-80"
                style={{
                  backgroundColor: isActive
                    ? lvlColor
                    : isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.45)",
                  borderWidth: 1,
                  borderColor: isActive
                    ? lvlColor
                    : isDark
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.6)",
                  shadowColor: isActive ? lvlColor : "#000",
                  shadowOpacity: isActive ? 0.3 : 0.06,
                  shadowRadius: isActive ? 10 : 4,
                  shadowOffset: { width: 0, height: 2 },
                  // glassmorphism blur not natively supported, use overlay trick
                  backdropFilter: "blur(12px)",
                }}
              >
                <Text
                  className="text-base font-bold"
                  style={{
                    color: isActive ? "#fff" : isDark ? "#d1d5db" : "#6b7280",
                  }}
                >
                  {l === "all" ? "All" : `HSK ${l}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#a855f7" />
        </View>
      ) : (
        <FlashList
          data={words}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          {...({ estimatedItemSize: 80 } as any)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-ink-500 dark:text-ink-400">
                No words found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
