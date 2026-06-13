import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookOpen } from "lucide-react-native";
import { useSettingsStore } from "@/stores/settings";

const LEVELS: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];
const MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORDS_PER_LEVEL_ESTIMATE = 300;

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
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  const { hskLevel, dailyGoal, daysPerWeek, setHskLevel, setDailyGoal, setDaysPerWeek } =
    useSettingsStore();

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const totalWords = WORDS_PER_LEVEL_ESTIMATE;
  const studyDays = Math.max(1, Math.min(7, Math.round(daysPerWeek ?? 6)));
  const wordsPerDay = Math.max(1, Math.min(200, Math.round(dailyGoal ?? 20)));
  const totalStudyDays = Math.ceil(totalWords / wordsPerDay);
  const totalWeeks = Math.ceil(totalStudyDays / studyDays);
  const weeksLabel = totalWeeks >= 52 ? `${(totalWeeks / 52).toFixed(1)} years` : `${totalWeeks} weeks`;
  const completionDate = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + totalWeeks * 7);
    return d;
  }, [weekStart, totalWeeks]);

  const weekPlan = useMemo(() => {
    const days: {
      date: Date;
      dayName: string;
      isStudyDay: boolean;
      isToday: boolean;
      newWords: number;
      reviewWords: number;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dayName: MON_FIRST[i],
        isStudyDay: i < studyDays,
        isToday: d.toDateString() === today.toDateString(),
        newWords: i < studyDays ? wordsPerDay : 0,
        reviewWords: i < studyDays ? Math.round(wordsPerDay * 0.6) : 0,
      });
    }
    return days;
  }, [weekStart, studyDays, wordsPerDay, today]);

  // --- Colors -------------------------------------------------------------
  const cardBg = dark ? "#1f2937" : "#ffffff";
  const textPrimary = dark ? "#f3f4f6" : "#111827";
  const textSecondary = dark ? "#9ca3af" : "#6b7280";
  const textMuted = dark ? "#6b7280" : "#9ca3af";
  const borderColor = dark ? "#374151" : "#e5e7eb";
  const highlightBg = dark ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.10)";
  const accent = "#a855f7";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: dark ? "#0b0615" : "#fafafa" }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: textPrimary }}>Study Plan</Text>
          <Text style={{ fontSize: 14, color: textSecondary, marginTop: 4 }}>
            HSK Level {hskLevel} · {wordsPerDay} words/day · {studyDays} days/week
          </Text>
        </View>

        {/* Level selector */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8, fontWeight: "600" }}>
            Target Level
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {LEVELS.map((lvl) => {
              const active = lvl === hskLevel;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => setHskLevel(lvl)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? accent : borderColor,
                    backgroundColor: active ? accent : cardBg,
                    opacity: pressed ? 0.75 : 1,
                    minWidth: 48,
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: active ? "#ffffff" : textPrimary }}>
                    {lvl}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Goal: words/day */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: textSecondary, fontWeight: "600" }}>Words per day</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: textPrimary }}>{wordsPerDay}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
              {[10, 20, 30, 40, 50, 75, 100].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setDailyGoal(n)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: wordsPerDay === n ? accent : borderColor,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: wordsPerDay === n ? "#fff" : textPrimary }}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Goal: days/week */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: textSecondary, fontWeight: "600" }}>Days per week</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: textPrimary }}>{studyDays}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setDaysPerWeek(n)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: studyDays === n ? accent : borderColor,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: studyDays === n ? "#fff" : textPrimary }}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Overview */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ backgroundColor: accent, borderRadius: 20, padding: 18 }}>
            <Text
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Overview
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 6 }}>
              ~{totalWords.toLocaleString()} words to master
            </Text>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
              At {wordsPerDay}/day × {studyDays} days/week
            </Text>
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.25)", marginVertical: 14 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Study time</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 2 }}>{weeksLabel}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Target date</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 2 }}>
                  {completionDate.getMonth() + 1}/{completionDate.getDate()}/{completionDate.getFullYear()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Weekly schedule */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8, fontWeight: "600" }}>
            This Week ({formatDate(weekStart)} – {formatDate(weekEnd)})
          </Text>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor, overflow: "hidden" }}>
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
                  <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{formatDate(d.date)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  {d.isStudyDay ? (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary }}>
                        {d.newWords} new + {d.reviewWords} review
                      </Text>
                      <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                        {d.newWords + d.reviewWords} total words
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 12, color: textMuted, fontStyle: "italic" }}>
                      Rest day — review {Math.round(wordsPerDay * 0.3)} earlier words
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: d.isStudyDay ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen size={16} color={d.isStudyDay ? "#10b981" : textMuted} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
