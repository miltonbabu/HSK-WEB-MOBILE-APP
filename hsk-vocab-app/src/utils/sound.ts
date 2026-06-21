// Lightweight sound effects using the Web Audio API.
// No audio files needed — sounds are synthesized at runtime.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // Resume if suspended (browsers block audio until user interaction)
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain: number = 0.15
) {
  const audioCtx = getCtx()
  if (!audioCtx) return

  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  osc.type = type
  osc.frequency.value = freq

  // Envelope: quick attack, smooth decay
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime + start)
  gainNode.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + start + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration)

  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  osc.start(audioCtx.currentTime + start)
  osc.stop(audioCtx.currentTime + start + duration)
}

/** Pleasant two-note ascending chime for correct answers. */
export function playCorrectSound() {
  playTone(660, 0, 0.12, 'sine', 0.12)   // E5
  playTone(990, 0.08, 0.18, 'sine', 0.12) // B5
}

/** Soft low buzz for incorrect answers. */
export function playWrongSound() {
  playTone(220, 0, 0.2, 'sawtooth', 0.08) // A3
}
