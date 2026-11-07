import { useState } from 'react'
import { formatRelative } from '../../lib/dates'
import { displayName } from '../../lib/format'
import { MAX_MESSAGE_LENGTH } from '../../services/chat'
import { getUser } from '../../services/db'
import { isMember } from '../../services/groups'
import { useApp } from '../../state/AppStore'
import { Button, Card, SectionHeading, Textarea } from '../ui/primitives'
import { ReportDialog } from './ReportDialog'

export function GroupDiscussion({ groupId }: { groupId: string }) {
  const { db, user, now, groupMessages, actions } = useApp()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const member = isMember(db, groupId, user?.id)
  const messages = groupMessages.filter((message) => message.groupId === groupId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

  return (
    <section className="mt-10" aria-labelledby="group-discussion">
      <SectionHeading id="group-discussion" title="Group discussion" />
      <Card className="space-y-4 p-4">
        {!member ? (
          <p className="text-ink-soft">Join the group to read the discussion and plan activities together.</p>
        ) : (
          <>
            <div role="log" aria-labelledby="group-discussion" className="max-h-96 overflow-y-auto">
              {messages.length === 0 && <p className="text-muted">Start the discussion with a message.</p>}
              {messages.map((message) => {
                const author = getUser(db, message.userId)
                const reported = db.reports.some((report) => report.targetId === message.id && report.targetType === 'message')
                return (
                  <article key={message.id} className="border-b border-line py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{message.userId === user?.id ? 'You' : author ? displayName(author) : 'Member'}</span>
                      <time dateTime={message.createdAt} className="text-muted">{formatRelative(message.createdAt, now)}</time>
                    </div>
                    <p className="whitespace-pre-wrap wrap-anywhere">{reported ? 'You reported this message.' : message.body}</p>
                    {!reported && message.userId !== user?.id && (
                      <button type="button" className="text-sm text-muted underline" onClick={() => setReportId(message.id)}>
                        Report message
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
            <form className="space-y-2" onSubmit={async (event) => {
              event.preventDefault()
              if (!body.trim() || pending) return
              setPending(true)
              try {
                if (await actions.postToGroup(groupId, body)) setBody('')
              } finally {
                setPending(false)
              }
            }}>
              <label className="block text-sm font-semibold" htmlFor="group-message">Message the group</label>
              <Textarea id="group-message" rows={2} value={body} onChange={(event) => setBody(event.target.value)}
                maxLength={MAX_MESSAGE_LENGTH} readOnly={pending} />
              <Button type="submit" disabled={pending || !body.trim()}>{pending ? 'Sending…' : 'Send message'}</Button>
            </form>
          </>
        )}
      </Card>
      {member && reportId && <ReportDialog open onClose={() => setReportId(null)} targetType="message" targetId={reportId} subject="Group message" />}
    </section>
  )
}
