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

const shouldSuppress = (msg: string): boolean => {
  return suppressedPatterns.some((pattern) => msg.includes(pattern));
};

// Suppress console.error
const originalError = console.error;
console.error = (...args: any[]) => {
  const msg =
    typeof args[0] === "string"
      ? args[0]
      : args[0] instanceof Error
        ? args[0].message
        : "";
  if (!shouldSuppress(msg)) {
    originalError.apply(console, args);
  }
};

// Suppress console.warn
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg =
    typeof args[0] === "string"
      ? args[0]
      : args[0] instanceof Error
        ? args[0].message
        : "";
  if (!shouldSuppress(msg)) {
    originalWarn.apply(console, args);
  }
};