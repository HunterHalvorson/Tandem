/** Plain-language + voice search. "Free hiking this weekend in NW" becomes filters. */
import { Mic, MicOff, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { isSpeechRecognitionSupported, listen } from '../../lib/speech'
import { applyParsedQuery, parseQuery } from '../../services/nlp'
import type { EventFilters } from '../../services/filters'

const EXAMPLES = ['free hiking this weekend in NW', 'quiet book club', 'beginner running tomorrow', 'wheelchair accessible under $20']

export function SmartSearch({ filters, onChange, className }: { filters: EventFilters; onChange: (f: EventFilters) => void; className?: string }) {
  const [text, setText] = useState(filters.q)
  const [understood, setUnderstood] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const [announce, setAnnounce] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  const voice = isSpeechRecognitionSupported()

  useEffect(() => () => stopRef.current?.(), [])

  const run = (value: string) => {
    const parsed = parseQuery(value)
    onChange(applyParsedQuery(filters, parsed))
    setUnderstood(parsed.understood)
    setText(parsed.text)
    setAnnounce(parsed.understood.length ? `Applied: ${parsed.understood.join(', ')}${parsed.text ? `. Searching for ${parsed.text}` : ''}` : value ? `Searching for ${value}` : 'Search cleared')
  }

  const toggleVoice = () => {
    if (listening) {
      stopRef.current?.()
      return
    }
    setAnnounce('Listening… say something like “free hiking this weekend in the northwest”.')
    let last = ''
    stopRef.current = listen({
      onTranscript: (t, final) => {
        last = t
        setText(t)
        if (final) run(t)
      },
      onError: (err) => setAnnounce(err === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice search stopped. You can type instead.'),
      onDone: () => {
        setListening(false)
        stopRef.current = null
        if (last && !understood.length) run(last)
      },
    })
    setListening(!!stopRef.current)
  }

  return (
    <div className={className}>
      <form
        role="search"
        aria-label="Search events"
        onSubmit={(e) => {
          e.preventDefault()
          run(text)
        }}
        className="flex items-center gap-2 rounded-card border border-line-strong bg-white p-1.5 pl-3 shadow-card focus-within:border-ink/40"
      >
        <Search aria-hidden className="size-5 shrink-0 text-muted" />
        <label htmlFor="smart-search" className="sr-only">
          Search events in plain language
        </label>
        <input
          id="smart-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Try “free hiking this weekend in NW”"
          className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-muted"
          autoComplete="off"
        />
        {voice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? 'Stop voice search' : 'Search by voice'}
            title={listening ? 'Stop listening' : 'Search by voice'}
            className={cn('grid size-10 shrink-0 place-items-center rounded-control transition-colors', listening ? 'animate-pulse bg-brand text-white' : 'text-ink hover:bg-mist')}
          >
            {listening ? <MicOff aria-hidden className="size-5" /> : <Mic aria-hidden className="size-5" />}
          </button>
        )}
        <button type="submit" className="h-10 shrink-0 rounded-control bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
          Search
        </button>
      </form>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {understood.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Sparkles aria-hidden className="size-4 text-brand" />
          Understood:
          {understood.map((u) => (
            <span key={u} className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">
              {u}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-2 hidden flex-wrap items-center gap-1.5 text-sm text-muted sm:flex">
          Try:
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => run(ex)} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft hover:border-ink/30 hover:text-ink">
              {ex}
            </button>
          ))}
          {voice && <span className="text-xs">· or tap the mic to speak</span>}
        </p>
      )}
    </div>
  )
}
