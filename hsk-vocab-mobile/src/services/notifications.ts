import { Platform } from "react-native";
import { useSettingsStore } from "@/stores/settings";

const REMINDER_MESSAGES = [
  "Time to study! Keep your streak going! 🔥",
  "Don't break your streak — a few words today keeps the score high! 📚",
  "Quick practice session? Your daily goal is waiting! 🎯",
  "Every word learned brings you closer to fluency. Let's go! 🚀",
  "Your brain loves consistency. 5 minutes of review now! 🧠",
  "Study reminder: even a short session makes a big difference! 💪",
  "Ready to level up? Your HSK words are waiting! ⭐",
];

function getRandomMessage(): string {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

/** Lazy-load expo-notifications to avoid module-level side effects in Expo Go */
let _Notifications: typeof import("expo-notifications") | null = null;
let _loadFailed = false;
async function getNotifications() {
  if (_loadFailed) return null;
  if (!_Notifications) {
    try {
      _Notifications = await import("expo-notifications");
    } catch {
      _loadFailed = true;
      return null;
    }
  }
  return _Notifications;
}

/** Request notification permissions. Returns true if granted. */
export async function requestPermissions(): Promise<boolean> {
  try {
    const Notifications = await getNotifications();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** Create the Android notification channel (idempotent) */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const Notifications = await getNotifications();
    await Notifications.setNotificationChannelAsync("study-reminders", {
      name: "Study Reminders",
      description: "Daily reminders to study your HSK vocabulary",
      importance: (Notifications as any).AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#a855f7",
    });
  } catch {
    // Silently fail — channel setup is best-effort
  }
}

/** Configure foreground notification behavior */
async function configureHandler(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Silently fail
  }
}

/**
 * Get the next study days based on daysPerWeek starting from today.
 */
function getStudyDays(daysPerWeek: number): Date[] {
  const days: Date[] = [];
  const now = new Date();
  const studyDays = Math.max(1, Math.min(7, daysPerWeek));
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (i < studyDays) days.push(d);
  }
  return days;
}

/** Parse "HH:MM" into hour and minute numbers */
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h || 9, minute: m || 0 };
}

/**
 * Cancel all existing scheduled notifications and reschedule based on current settings.
 */
export async function rescheduleReminders(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const { remindersEnabled, reminderTime, daysPerWeek, dailyGoal } =
      useSettingsStore.getState();
    if (!remindersEnabled) return;

    const studyDays = getStudyDays(daysPerWeek);
    const { hour, minute } = parseTime(reminderTime);

    for (let i = 0; i < studyDays.length; i++) {
      const triggerDate = new Date(studyDays[i]);
      triggerDate.setHours(hour, minute, 0, 0);
      if (triggerDate.getTime() <= Date.now()) continue;

      const dayLabel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `Day ${i + 1}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${dayLabel}'s Study Reminder 📖`,
          body: getRandomMessage(),
          subtitle: `Goal: ${dailyGoal} words today`,
          data: { screen: "(tabs)/learn" },
          sound: undefined,
          badge: 1,
        },
        trigger: {
          type: (Notifications as any).SchedulableTriggerInputTypes?.DATE ?? "date",
          date: triggerDate,
        } as any,
      });
    }
  } catch {
    // Silently fail — notifications are best-effort
  }
}

/**
 * Initialize the notification system on app startup.
 */
export async function initNotifications(): Promise<void> {
  await configureHandler();
  await setupAndroidChannel();
  await requestPermissions();
  await rescheduleReminders();
}

/**
 * Subscribe to notification response taps.
 * Returns a cleanup function.
 */
export async function subscribeToNotificationTaps(
  onTap: (screen: string) => void,
): Promise<() => void> {
  try {
    const Notifications = await getNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen;
        if (screen) onTap(screen as string);
      },
    );
    return () => subscription.remove();
  } catch {
    return () => {}; // No-op cleanup
  }
}