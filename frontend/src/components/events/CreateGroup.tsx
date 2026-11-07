import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CATEGORIES } from '../../data/categories'
import { QUADRANTS } from '../../data/calgary'
import { useApp } from '../../state/AppStore'
import type { CategoryId, Quadrant } from '../../types'
import { Dialog } from '../ui/Dialog'
import { Button, ButtonLink, Field, Input, Select, Textarea } from '../ui/primitives'

export function CreateGroup() {
  const { user, actions } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryId>('meetups')
  const [quadrant, setQuadrant] = useState<Quadrant>('NW')
  if (!user) return <ButtonLink to="/login?next=%2Fgroups" size="sm">Sign in to start a group</ButtonLink>
  if (!user.onboardingComplete) return <Link to="/onboarding?next=%2Fgroups" className="font-semibold underline">Finish your profile to start a group</Link>
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Start a group</Button>
      <Dialog open={open} onClose={() => { if (!pending) setOpen(false) }} title="Start a group">
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          setPending(true)
          try {
            const id = await actions.createGroup({ name, description, category, quadrant })
            if (id) navigate(`/groups/${id}`)
          } finally {
            setPending(false)
          }
        }}>
          <Field label="Group name">{(props) =>
            <Input {...props} required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field label="Description">{(props) =>
            <Textarea {...props} required maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />}
          </Field>
          <Field label="Category">{(props) =>
            <Select {...props} value={category} onChange={(event) => setCategory(event.target.value as CategoryId)}>
              {Object.values(CATEGORIES).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </Select>}
          </Field>
          <Field label="Calgary quadrant">{(props) =>
            <Select {...props} value={quadrant} onChange={(event) => setQuadrant(event.target.value as Quadrant)}>
              {QUADRANTS.map((value) => <option key={value}>{value}</option>)}
            </Select>}
          </Field>
          <Button type="submit" disabled={pending || !name.trim() || !description.trim()}>
            {pending ? 'Creating…' : 'Create group'}
          </Button>
        </form>
      </Dialog>
    </>
  )
}
