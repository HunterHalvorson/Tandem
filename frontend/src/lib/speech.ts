/**
 * Speech helpers (accessibility): text-to-speech via the Web Speech API's speechSynthesis,
 * and voice input via SpeechRecognition where the browser supports it (Chrome/Edge/Safari).
 * Both degrade gracefully: callers check the `is…Supported()` functions and hide/disable controls.
 */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-CA'
  utterance.rate = 1
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}

/* ---- minimal SpeechRecognition typings (not part of TypeScript's DOM lib) ---- */

interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  isFinal: boolean
  0: RecognitionAlternative
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
export interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

/**
 * Start listening. Calls onTranscript with interim + final text; onDone when recognition ends.
 * Returns a stop function, or null when unsupported.
 */
export function listen(handlers: {
  onTranscript: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onDone?: () => void
}): (() => void) | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'en-CA'
  rec.interimResults = true
  rec.continuous = false
  rec.onresult = (e) => {
    let text = ''
    let final = false
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (e.results[i].isFinal) final = true
    }
    handlers.onTranscript(text.trim(), final)
  }
  rec.onerror = (e) => handlers.onError?.(e.error)
  rec.onend = () => handlers.onDone?.()
  try {
    rec.start()
  } catch {
    handlers.onError?.('start-failed')
    return null
  }
  return () => rec.stop()
}
