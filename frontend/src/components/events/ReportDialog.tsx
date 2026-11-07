import { useState } from 'react'
import { REPORT_REASONS } from '../../services/chat'
import { useApp } from '../../state/AppStore'
import { useToast } from '../../state/toast'
import type { Report, ReportReason } from '../../types'
import { Dialog } from '../ui/Dialog'
import { Button, Textarea } from '../ui/primitives'

export function ReportDialog({ open, onClose, targetType, targetId, subject }: { open: boolean; onClose: () => void; targetType: Report['targetType']; targetId: string; subject: string }) {
  const { actions } = useApp()
  const { toast } = useToast()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const submit = () => {
    if (!reason) {
      setError('Choose a reason so we can route your report.')
      return
    }
    if (actions.report(targetType, targetId, reason, details)) {
      toast('Thanks for reporting. In production, a moderator would review this within 24 hours. (Demo: stored in this browser only.)', { tone: 'info' })
      setReason('')
      setDetails('')
      setError('')
      onClose()
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Report ${targetType === 'event' ? 'event' : 'message'}`}
      description={subject}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Send report</Button>
        </>
      }
    >
      <fieldset aria-describedby={error ? 'report-error' : undefined}>
        <legend className="mb-2 text-sm font-semibold text-ink">What's wrong?</legend>
        <div className="space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-mist has-[:checked]:border-brand has-[:checked]:bg-brand-tint/50">
              <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="size-4" />
              {r.label}
            </label>
          ))}
        </div>
        {error && (
          <p id="report-error" className="mt-2 text-sm font-medium text-brand-deep">
            {error}
          </p>
        )}
      </fieldset>
      <label htmlFor="report-details" className="mt-4 mb-1.5 block text-sm font-semibold text-ink">
        Details <span className="font-normal text-muted">(optional)</span>
      </label>
      <Textarea id="report-details" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps a moderator understand the problem." />
      <p className="mt-3 text-xs text-muted">Reports are confidential — the person you report isn't told who reported them. If someone is in immediate danger, call 911.</p>
    </Dialog>
  )
}
