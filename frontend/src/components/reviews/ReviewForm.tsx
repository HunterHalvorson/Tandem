import { useState, type FormEvent } from 'react'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import type { CalgaryEvent } from '../../types'
import { Button, StarInput, Textarea } from '../ui/primitives'

export function ReviewForm({ event, onDone }: { event: CalgaryEvent; onDone?: () => void }) {
  const { actions } = useApp()
  const { toast } = useToast()
  const [overall, setOverall] = useState<number | null>(null)
  const [organization, setOrganization] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [access, setAccess] = useState<number | null>(null)
  const [wouldReturn, setWouldReturn] = useState<'yes' | 'no' | 'skip'>('skip')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!overall || saving) return
    setSaving(true)
    try {
      if (await actions.submitReview(event.id, {
        overall,
        organization,
        accuracy,
        accessibilityAccuracy: access,
        wouldReturn: wouldReturn === 'skip' ? null : wouldReturn === 'yes',
        comment,
      })) {
        toast(`Rating saved: ${overall} out of 5 stars.`)
        onDone?.()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <StarInput label="Overall rating" value={overall} onChange={setOverall} />
      <details className="border-y border-line py-2">
        <summary className="cursor-pointer py-1 text-sm font-semibold">Add optional feedback</summary>
        <div className="space-y-4 pt-3">
          <StarInput label="How well was it organized?" value={organization} onChange={setOrganization} />
          <StarInput label="Did the description match what happened?" value={accuracy} onChange={setAccuracy} />
          <StarInput label="Was the accessibility information accurate?" value={access} onChange={setAccess} allowNA />
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">Would you attend another activity with this group?</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['yes', 'Yes'],
                  ['no', 'No'],
                  ['skip', 'Prefer not to say'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:text-brand-deep has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
                  <input type="radio" name="would-return" className="sr-only" checked={wouldReturn === v} onChange={() => setWouldReturn(v)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Shown as a percentage for the whole event.</p>
          </fieldset>
          <div>
            <label htmlFor="review-comment" className="mb-1.5 block text-sm font-semibold text-ink">
              Written feedback <span className="font-normal text-muted">(optional)</span>
            </label>
            <Textarea id="review-comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should future attendees know?" />
          </div>
        </div>
      </details>
      <Button type="submit" disabled={!overall || saving}>{saving ? 'Saving…' : 'Submit rating'}</Button>
    </form>
  )
}
