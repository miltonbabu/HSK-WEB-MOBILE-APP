// Chinese text-to-speech using expo-speech.
// Mirrors the web app's window.speechSynthesis usage.

import * as Speech from "expo-speech";

export interface SpeakOptions {
  rate?: number; // 0.5 .. 1.0
  pitch?: number;
  language?: string; // e.g. 'zh-CN'
}

// Try multiple Chinese language codes since Android OEMs vary
const LANG_FALLBACKS = ["zh-CN", "zh-Hans", "zh-Hans-CN", "zh", "cmn-Hans-CN"];

export async function speak(text: string, opts: SpeakOptions = {}) {
  const { rate = 0.8, pitch = 1, language = "zh-CN" } = opts;

  // Ensure audio mode is set for playback (not recording)
  try {
    const { Audio } = await import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {
    // expo-av native module not available — ignore
  }

  // Try primary language first, then fallbacks
  const langsToTry = [language, ...LANG_FALLBACKS.filter((l) => l !== language)];

  try {
    await Speech.stop();
    await new Promise((r) => setTimeout(r, 100));

    for (const lang of langsToTry) {
      try {
        await Speech.speak(text, {
          language: lang,
          rate,
          pitch,
          volume: 1.0,
        });
        return; // success
      } catch {
        // try next language
        continue;
      }
    }
    console.warn("[Speech] All language fallbacks failed");
  } catch (e) {
    console.warn("[Speech] Error:", e);
  }
}

export function stopSpeaking() {
  Speech.stop();
}