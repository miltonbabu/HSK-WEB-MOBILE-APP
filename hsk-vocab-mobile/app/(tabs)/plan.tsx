import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  Flame,
  Target,
  CalendarDays,
  AlertCircle,
} from "lucide-react-native";
import { useSettingsStore } from "@/stores/settings";
import { useDataSource } from "@/db/context";
import { useAuthStore } from "@/stores/auth";
import { useColorScheme } from "nativewind";
import type { HSKLevel } from "@/types";

const LEVELS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

// Dynamic accent colors per HSK level
const LEVEL_COLORS: Record<
  number,
  { accent: string; light: string; bg: string }
> = {
  1: {
    accent: "#3b82f6",
    light: "rgba(59,130,246,0.12)",
    bg: "rgba(59,130,246,0.10)",
  },
  2: {
    accent: "#10b981",
    light: "rgba(16,185,129,0.12)",
    bg: "rgba(16,185,129,0.10)",
  },
  3: {
    accent: "#f59e0b",
    light: "rgba(245,158,11,0.12)",
    bg: "rgba(245,158,11,0.10)",
  },
  4: {
    accent: "#a855f7",
    light: "rgba(168,85,247,0.12)",
    bg: "rgba(168,85,247,0.10)",
  },
};
const MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// --- Pure helpers ---------------------------------------------------------
function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// --- Screen ---------------------------------------------------------------
export default function PlanScreen() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const ds = useDataSource();
  const user = useAuthStore((s) => s.user);

  const {
    hskLevel,
    dailyGoal,
    daysPerWeek,
    setHskLevel,
    setDailyGoal,
    setDaysPerWeek,
  } = useSettingsStore();

  // Real data from DB
  const [levelWordCount, setLevelWordCount] = useState(300);
  const [masteredCount, setMasteredCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weekStudyData, setWeekStudyData] = useState<
    { date: string; words_studied: number }[]
  >([]);

  useEffect(() => {
    ds.vocab
      .countByLevel()
      .then((counts) => {
        setLevelWordCount(counts[hskLevel as HSKLevel] || 300);
      })
      .catch(() => {});

    if (user) {
      ds.progress
        .countMasteredByLevel(user.id)
        .then((mastered) => {
          setMasteredCount(mastered[hskLevel as HSKLevel] || 0);
        })
        .catch(() => {});

      ds.profiles
        .get(user.id)
        .then((p) => {
          setStreak(p?.streak_count ?? 0);
        })
        .catch(() => {});

      ds.sessions
        .aggregateDaily(user.id, 7)
        .then((data) => {
          setWeekStudyData(
            data.map((d) => ({ date: d.date, words_studied: d.words_studied })),
          );
        })
        .catch(() => {});
    }
  }, [ds, user, hskLevel]);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  // Core calculations - simple and clear
  const totalWords = levelWordCount;
  const studyDays = Math.max(1, Math.min(7, Math.round(daysPerWeek ?? 6)));
  const wordsPerDay = Math.max(1, Math.min(200, Math.round(dailyGoal ?? 20)));
  const remainingWords = Math.max(0, totalWords - masteredCount);

  // How many study days needed at this pace
  const estimatedStudyDays = Math.ceil(remainingWords / wordsPerDay);
  // How many calendar weeks (study days ÷ days per week)
  const estimatedWeeks = Math.ceil(estimatedStudyDays / studyDays);
  // Words per week
  const wordsPerWeek = wordsPerDay * studyDays;

  const completionDate = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + estimatedWeeks * 7);
    return d;
  }, [weekStart, estimatedWeeks]);

  // Weekly plan - simple daily targets, no confusing new/review split
  const weekPlan = useMemo(() => {
    const days: {
      date: Date;
      dayName: string;
      dayFull: string;
      isStudyDay: boolean;
      isToday: boolean;
      target: number;
      actualStudied: number;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const studyEntry = weekStudyData.find((s) => {
        const sd = new Date(s.date);
        return sd.toDateString() === d.toDateString();
      });
      days.push({
        date: d,
        dayName: MON_FIRST[i],
        dayFull: DAY_NAMES[d.getDay()],
        isStudyDay: i < studyDays,
        isToday: d.toDateString() === today.toDateString(),
        target: i < studyDays ? wordsPerDay : 0,
        actualStudied: studyEntry?.words_studied ?? 0,
      });
    }
    return days;
  }, [weekStart, studyDays, wordsPerDay, today, weekStudyData]);

  // --- Colors -------------------------------------------------------------
  const cardBg = dark ? "#1f2937" : "#ffffff";
  const textPrimary = dark ? "#f3f4f6" : "#111827";
  const textSecondary = dark ? "#9ca3af" : "#6b7280";
  const textMuted = dark ? "#6b7280" : "#9ca3af";
  const borderColor = dark ? "#374151" : "#e5e7eb";
  const lvlColors = LEVEL_COLORS[hskLevel] || LEVEL_COLORS[4];
  const accent = lvlColors.accent;
  const accentLight = lvlColors.light;
  const accentBg = lvlColors.bg;
  const highlightBg = dark ? `${accent}26` : `${accent}1a`;
  const progressPct =
    totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: dark ? "#0b0615" : "#fafafa" }}
      edges={["top"]}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}
        >
          <Text style={{ fontSize: 28, fontWeight: "700", color: textPrimary }}>
            Study Plan
          </Text>
          <Text style={{ fontSize: 14, color: textSecondary, marginTop: 4 }}>
            HSK {hskLevel} · Goal: {wordsPerDay} words/day · {studyDays}{" "}
            days/week
          </Text>
        </View>

        {/* Level selector */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: textSecondary,
                marginBottom: 12,
                fontWeight: "600",
              }}
            >
              Select HSK Level
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {LEVELS.map((lvl) => {
                const active = lvl === hskLevel;
                const c = LEVEL_COLORS[lvl] || LEVEL_COLORS[4];
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setHskLevel(lvl)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 2.5,
                      borderColor: active ? c.accent : borderColor,
                      backgroundColor: active
                        ? c.bg
                        : dark
                          ? "#1a1f2e"
                          : "#f0f1f5",
                      opacity: pressed ? 0.7 : 1,
                      alignItems: "center",
                      shadowColor: active ? c.accent : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: active ? 0.25 : 0,
                      shadowRadius: 6,
                      elevation: active ? 4 : 0,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "800",
                        color: active ? c.accent : dark ? "#6b7280" : "#9ca3af",
                      }}
                    >
                      {lvl}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: active ? c.accent : textMuted,
                        marginTop: 4,
                        letterSpacing: 0.5,
                      }}
                    >
                      LEVEL
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Goal: words/day */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: accentLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookOpen size={16} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: textSecondary,
                    fontWeight: "600",
                  }}
                >
                  Words per day
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: accent,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}
                >
                  {wordsPerDay}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[5, 10, 15, 20, 25, 30, 50].map((n) => {
                const active = wordsPerDay === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setDailyGoal(n)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: active ? accent : borderColor,
                      backgroundColor: active ? accentBg : "transparent",
                      opacity: pressed ? 0.65 : 1,
                      minWidth: 48,
                      alignItems: "center",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: active ? accent : textSecondary,
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Goal: days/week */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: accentLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarDays size={16} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: textSecondary,
                    fontWeight: "600",
                  }}
                >
                  Days per week
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: accent,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}
                >
                  {studyDays}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                const active = studyDays === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setDaysPerWeek(n)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: active ? accent : borderColor,
                      backgroundColor: active ? accentBg : "transparent",
                      opacity: pressed ? 0.65 : 1,
                      minWidth: 48,
                      alignItems: "center",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: active ? accent : textSecondary,
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── How It's Calculated (NEW - clear formula explanation) ─── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <AlertCircle size={16} color={accent} />
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: textPrimary }}
              >
                How it's calculated
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {/* Step 1 */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: highlightBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "700", color: accent }}
                  >
                    1
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: textSecondary, flex: 1 }}>
                  Words remaining:{" "}
                  <Text style={{ fontWeight: "700", color: textPrimary }}>
                    {totalWords.toLocaleString()}
                  </Text>{" "}
                  total −{" "}
                  <Text style={{ fontWeight: "700", color: "#22c55e" }}>
                    {masteredCount.toLocaleString()}
                  </Text>{" "}
                  mastered ={" "}
                  <Text style={{ fontWeight: "700", color: accent }}>
                    {remainingWords.toLocaleString()}
                  </Text>
                </Text>
              </View>
              {/* Step 2 */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: highlightBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "700", color: accent }}
                  >
                    2
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: textSecondary, flex: 1 }}>
                  Study days needed:{" "}
                  <Text style={{ fontWeight: "700", color: accent }}>
                    {remainingWords.toLocaleString()}
                  </Text>{" "}
                  ÷{" "}
                  <Text style={{ fontWeight: "700", color: textPrimary }}>
                    {wordsPerDay}
                  </Text>{" "}
                  words/day ={" "}
                  <Text style={{ fontWeight: "700", color: accent }}>
                    {estimatedStudyDays.toLocaleString()} days
                  </Text>
                </Text>
              </View>
              {/* Step 3 */}
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: highlightBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "700", color: accent }}
                  >
                    3
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: textSecondary, flex: 1 }}>
                  Calendar weeks:{" "}
                  <Text style={{ fontWeight: "700", color: accent }}>
                    {estimatedStudyDays.toLocaleString()}
                  </Text>{" "}
                  days ÷{" "}
                  <Text style={{ fontWeight: "700", color: textPrimary }}>
                    {studyDays}
                  </Text>{" "}
                  days/week ={" "}
                  <Text style={{ fontWeight: "700", color: accent }}>
                    {estimatedWeeks} weeks
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Overview Card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={{ backgroundColor: accent, borderRadius: 20, padding: 18 }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Your Plan
            </Text>
            <View className="h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </View>

            {/* Stats row 1 */}
            <View style={{ flexDirection: "row", marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Progress
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#fff",
                    marginTop: 2,
                  }}
                >
                  {masteredCount}/{totalWords.toLocaleString()}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 1,
                  }}
                >
                  {progressPct}% mastered
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Remaining
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#fff",
                    marginTop: 2,
                  }}
                >
                  {remainingWords.toLocaleString()}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 1,
                  }}
                >
                  words left
                </Text>
              </View>
            </View>

            {/* Stats row 2 */}
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Weekly Pace
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#fff",
                    marginTop: 2,
                  }}
                >
                  {wordsPerWeek}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 1,
                  }}
                >
                  {wordsPerDay}/day × {studyDays} days
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Est. Finish
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#fff",
                    marginTop: 2,
                  }}
                >
                  {estimatedWeeks > 0 ? `${estimatedWeeks}w` : "Done!"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 1,
                  }}
                >
                  {completionDate.getMonth() + 1}/{completionDate.getDate()}/
                  {completionDate.getFullYear()}
                </Text>
              </View>
            </View>

            {/* Streak */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 14,
                gap: 6,
              }}
            >
              <Flame size={16} color="#fbbf24" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                {streak} day streak
              </Text>
            </View>
          </View>
        </View>

        {/* Weekly plan */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} color={textSecondary} />
            <Text
              style={{ fontSize: 13, color: textSecondary, fontWeight: "600" }}
            >
              This week ({formatDate(weekStart)} – {formatDate(weekEnd)})
            </Text>
          </View>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor,
              overflow: "hidden",
            }}
          >
            {weekPlan.map((d, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: d.isToday ? highlightBg : "transparent",
                  borderBottomWidth: idx < weekPlan.length - 1 ? 1 : 0,
                  borderBottomColor: borderColor,
                }}
              >
                {/* Day label */}
                <View style={{ width: 44 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: d.isToday ? accent : textPrimary,
                      textTransform: "uppercase",
                    }}
                  >
                    {d.dayName}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: textMuted, marginTop: 2 }}
                  >
                    {formatDate(d.date)}
                  </Text>
                </View>

                {/* Target / Actual */}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  {d.isStudyDay ? (
                    <View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: textPrimary,
                        }}
                      >
                        Target: {d.target} words
                      </Text>
                      {d.actualStudied > 0 && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <View
                            style={{
                              height: 4,
                              flex: 1,
                              borderRadius: 2,
                              backgroundColor: dark ? "#374151" : "#e5e7eb",
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                height: "100%",
                                borderRadius: 2,
                                backgroundColor:
                                  d.actualStudied >= d.target
                                    ? "#22c55e"
                                    : accent,
                                width: `${Math.min(100, Math.round((d.actualStudied / d.target) * 100))}%`,
                              }}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color:
                                d.actualStudied >= d.target
                                  ? "#22c55e"
                                  : textMuted,
                              fontWeight: "600",
                            }}
                          >
                            {d.actualStudied}/{d.target}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        color: textMuted,
                        fontStyle: "italic",
                      }}
                    >
                      Rest day
                    </Text>
                  )}
                </View>

                {/* Status icon */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: d.isStudyDay
                      ? d.actualStudied >= d.target && d.target > 0
                        ? "rgba(34,197,94,0.15)"
                        : highlightBg
                      : "rgba(156,163,175,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {d.isStudyDay ? (
                    d.actualStudied >= d.target && d.target > 0 ? (
                      <Target size={14} color="#22c55e" />
                    ) : (
                      <BookOpen size={14} color={accent} />
                    )
                  ) : (
                    <BookOpen size={14} color={textMuted} />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
