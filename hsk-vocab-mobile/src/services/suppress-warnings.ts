// Suppress known Expo Go compatibility warnings/errors
// These are expected in Expo Go — native modules are not available
// but the rest of the app (UI, local features) still works fine.

const suppressedPatterns = [
  "expo-notifications",
  "ExponentAV",
  "ExpoVideoView",
  "ExpoTopicSubscriptionModule",
  "ExpoPushTokenManager",
  "ExpoNotificationsHandlerModule",
  "ExpoNotificationsEmitter",
  "ExpoNotificationScheduler",
  "ExpoNotificationPresenter",
  "ExpoNotificationPermissionsModule",
  "ExpoNotificationChannelManager",
  "ExpoNotificationChannelGroupManager",
  "ExpoNotificationCategoriesModule",
  "ExpoBadgeModule",
  "ExpoBackgroundNotificationTasksModule",
  "NotificationsServerRegistrationModule",
  "deprecated",
  "SafeAreaView",
  "requireOptionalNativeModule",
  "requireOptionalNativeViewManager",
];

function argsToMessage(args: any[]): string {
  return args
    .map((a) =>
      typeof a === "string"
        ? a
        : a instanceof Error
          ? a.message
          : typeof a === "object" && a !== null
            ? a.message || ""
            : String(a ?? ""),
    )
    .join(" ");
}

const shouldSuppress = (msg: string): boolean => {
  return suppressedPatterns.some((pattern) => msg.includes(pattern));
};

// Suppress console.error
const originalError = console.error;
console.error = (...args: any[]) => {
  if (!shouldSuppress(argsToMessage(args))) {
    originalError.apply(console, args);
  }
};

// Suppress console.warn
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (!shouldSuppress(argsToMessage(args))) {
    originalWarn.apply(console, args);
  }
};