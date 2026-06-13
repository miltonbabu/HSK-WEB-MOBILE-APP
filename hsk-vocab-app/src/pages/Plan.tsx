import { useMemo } from "react";
import { useSettingsStore } from "@/stores";
import { BookOpen } from "lucide-react";

// --- Constants -----------------------------------------------------------
const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORDS_PER_LEVEL_ESTIMATE = 300;

// --- Pure helpers --------------------------------------------------------
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

// --- Page ----------------------------------------------------------------
export default function Plan() {
  const {
    hskLevel = 1,
    dailyGoal = 20,
    daysPerWeek = 6,
    setHskLevel,
    setDailyGoal,
    setDaysPerWeek,
  } = useSettingsStore();

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

  const accent = "#a855f7";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="pt-6 pb-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Study Plan
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          HSK Level {hskLevel} · {wordsPerDay} words/day · {studyDays} days/week
        </p>
      </div>

      {/* Level selector */}
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Target Level</div>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((lvl) => {
            const active = lvl === hskLevel;
            return (
              <button
                key={lvl}
                onClick={() => typeof setHskLevel === "function" && setHskLevel(lvl)}
                className={
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all " +
                  (active
                    ? "text-white shadow-md"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700")
                }
                style={active ? { backgroundColor: accent, boxShadow: `0 4px 12px ${accent}33` } : undefined}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Words/day */}
      <div className="mb-3 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Words per day</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{wordsPerDay}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {[10, 20, 30, 40, 50, 75, 100].map((n) => (
            <button
              key={n}
              onClick={() => typeof setDailyGoal === "function" && setDailyGoal(n)}
              className={
                "flex-1 py-2 rounded-lg text-xs font-bold transition-colors " +
                (wordsPerDay === n
                  ? "text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30")
              }
              style={wordsPerDay === n ? { backgroundColor: accent } : undefined}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Days/week */}
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Days per week</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">{studyDays}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => typeof setDaysPerWeek === "function" && setDaysPerWeek(n)}
              className={
                "flex-1 py-2 rounded-lg text-sm font-bold transition-colors " +
                (studyDays === n
                  ? "text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30")
              }
              style={studyDays === n ? { backgroundColor: accent } : undefined}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div
        className="mb-5 rounded-2xl p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, #ec4899 100%)` }}
      >
        <div className="text-xs font-semibold uppercase tracking-wide opacity-85">Overview</div>
        <div className="mt-1 text-2xl sm:text-3xl font-extrabold">~{totalWords.toLocaleString()} words to master</div>
        <div className="mt-1 text-sm opacity-90">
          At {wordsPerDay}/day × {studyDays} days/week
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-80">Study time</div>
            <div className="text-xl font-bold mt-0.5">{weeksLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Target date</div>
            <div className="text-xl font-bold mt-0.5">
              {completionDate.getMonth() + 1}/{completionDate.getDate()}/{completionDate.getFullYear()}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          This Week ({formatDate(weekStart)} – {formatDate(weekEnd)})
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {weekPlan.map((d, idx) => (
            <div
              key={idx}
              className={
                "flex items-center gap-3 px-4 py-3 " +
                (idx < weekPlan.length - 1 ? "border-b border-gray-100 dark:border-gray-700 " : "") +
                (d.isToday ? "bg-purple-50 dark:bg-purple-900/20" : "")
              }
            >
              <div className="w-14 shrink-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white uppercase">{d.dayName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(d.date)}</div>
              </div>
              <div className="flex-1 min-w-0">
                {d.isStudyDay ? (
                  <>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {d.newWords} new + {d.reviewWords} review
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {d.newWords + d.reviewWords} total words
                    </div>
                  </>
                ) : (
                  <div className="text-xs italic text-gray-500 dark:text-gray-400">
                    Rest day — review {Math.round(wordsPerDay * 0.3)} earlier words
                  </div>
                )}
              </div>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: d.isStudyDay ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)" }}
              >
                <BookOpen size={14} color={d.isStudyDay ? "#10b981" : "#9ca3af"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
