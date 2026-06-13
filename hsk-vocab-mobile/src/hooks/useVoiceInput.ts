// Voice input hook — uses the system keyboard's built-in dictation.
// Pressing the mic button focuses the input field, opening the keyboard.
// Users can then tap the keyboard's microphone key for system-level dictation.
// This works on both iOS and Android without any external APIs or native modules.

import { useState, useCallback } from "react";
import type { TextInput } from "react-native";

export function useVoiceInput(inputRef: React.RefObject<TextInput | null>) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(true); // keyboard dictation works everywhere

  const startListening = useCallback(() => {
    // Focus the input to open the keyboard.
    // The user can then use the keyboard's built-in microphone/dictation button.
    inputRef.current?.focus();
    setIsListening(true);
    // Reset after a short delay — just a visual indicator
    setTimeout(() => setIsListening(false), 800);
  }, [inputRef]);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript: "",
    isSupported,
    startListening,
    stopListening,
  };
}