import { Camera, Eye, Lock, Settings, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { CategoryIcon } from '../components/events/visuals'
import { MilesCard } from '../components/miles/MilesCard'
import { SocialLinksEditor } from '../components/profile/editors'
import { ProfileView } from '../components/profile/ProfileView'
import { Avatar, Button, ButtonLink, Card, Chip, Container, EmptyState, Field, Input, Segmented, Select, Textarea } from '../components/ui/primitives'
import { CATEGORIES, CATEGORY_IDS } from '../data/categories'
import { NEIGHBOURHOODS, QUADRANTS } from '../data/calgary'
import { AVATAR_COLORS } from '../data/seed'
import { cn } from '../lib/cn'
import { usePageTitle } from '../lib/hooks'
import { getUser } from '../services/db'
import { useApp } from '../state/AppStore'
import { useToast } from '../state/toast'
import type { Quadrant, User } from '../types'

/** Resize an uploaded photo to a small square JPEG so it fits comfortably in browser storage. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.82)
}

export default function ProfilePage() {
  usePageTitle('My profile')
  const { user } = useApp()
  const [view, setView] = useState<'me' | 'public'>('me')
  if (!user) return null
  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">My profile</h1>
          <p className="mt-1 text-muted">Welcoming, useful, never competitive. You decide what others see.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Preview profile as"
            value={view}
            onChange={setView}
            options={[
              { value: 'me', label: 'My view', icon: <UserRound aria-hidden /> },
              { value: 'public', label: 'As others see it', icon: <Eye aria-hidden /> },
            ]}
          />
          <ButtonLink to="/settings#privacy" variant="secondary" size="sm">
            <Settings aria-hidden /> Privacy settings
          </ButtonLink>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          {view === 'public' && user.privacy.profileVisibility === 'private' ? (
            <EmptyState icon={<Lock aria-hidden />} title="Your profile is private" actions={<ButtonLink to="/settings#privacy" variant="secondary">Change visibility</ButtonLink>}>
              Other members only see your first name and last initial on events you join.
            </EmptyState>
          ) : (
            <ProfileView user={user} asPublic={view === 'public'} />
          )}
          <EditProfile user={user} />
        </div>
        <aside>
          <MilesCard userId={user.id} />
        </aside>
      </div>
    </Container>
  )
}

function EditProfile({ user }: { user: User }) {
  const { actions } = useApp()
  const { toast } = useToast()
  const [first, setFirst] = useState(user.firstName)
  const [last, setLast] = useState(user.lastName)
  const [bio, setBio] = useState(user.bio)
  const [error, setError] = useState('')

  const saveBasics = () => {
    if (!first.trim()) return setError('Your first name is required.')
    setError('')
    if (actions.updateProfile({ firstName: first.trim(), lastName: last.trim(), bio: bio.trim() })) toast('Profile saved.')
  }

  return (
    <Card className="p-6" as="section">
      <h2 className="text-xl font-bold text-ink" id="edit">
        Edit profile
      </h2>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Avatar user={user} size="lg" decorative={false} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-white px-3 text-sm font-semibold hover:bg-mist has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
              <Camera aria-hidden className="size-4" /> Upload photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const photo = await toAvatarDataUrl(file)
                    if (actions.updateProfile({ avatar: { ...user.avatar, photo } })) toast('Photo updated. It’s stored only in this browser.')
                  } catch {
                    toast('Sorry, that image couldn’t be read.', { tone: 'error' })
                  }
                  e.target.value = ''
                }}
              />
            </label>
            {user.avatar.photo && (
              <Button variant="ghost" size="sm" onClick={() => actions.updateProfile({ avatar: { color: user.avatar.color } })}>
                <Trash2 aria-hidden /> Remove photo
              </Button>
            )}
          </div>
          <fieldset>
            <legend className="sr-only">Avatar colour</legend>
            <div className="flex gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <label key={c} className="cursor-pointer rounded-full p-0.5 has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand">
                  <input type="radio" name="avatar-color" className="sr-only" checked={user.avatar.color === c} onChange={() => actions.updateProfile({ avatar: { ...user.avatar, color: c } })} />
                  <span className="block size-6 rounded-full" style={{ background: c }} />
                  <span className="sr-only">Colour {c}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          {(p) => <Input {...p} value={first} onChange={(e) => setFirst(e.target.value)} />}
        </Field>
        <Field label="Last name" optional>
          {(p) => <Input {...p} value={last} onChange={(e) => setLast(e.target.value)} />}
        </Field>
        <Field label="About you" optional className="sm:col-span-2" hint="A sentence or two about what you’d love to do in Calgary.">
          {(p) => <Textarea {...p} rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} />}
        </Field>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-brand-deep">{error}</p>}
      <Button className="mt-4" onClick={saveBasics}>
        Save details
      </Button>

      <hr className="my-8 border-line" />
      <h3 className="mb-1 text-lg font-bold">Location</h3>
      <p className="mb-3 text-sm text-muted">Approximate only — never an address.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Quadrant">
          {(p) => (
            <Select {...p} value={user.quadrant ?? ''} onChange={(e) => actions.updateProfile({ quadrant: (e.target.value || null) as Quadrant | null, neighbourhood: null })}>
              <option value="">Not set</option>
              {QUADRANTS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Neighbourhood" optional>
          {(p) => (
            <Select {...p} value={user.neighbourhood ?? ''} onChange={(e) => actions.updateProfile({ neighbourhood: e.target.value || null })} disabled={!user.quadrant}>
              <option value="">Prefer not to say</option>
              {NEIGHBOURHOODS.filter((n) => n.quadrant === user.quadrant).map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <hr className="my-8 border-line" />
      <h3 className="mb-3 text-lg font-bold">Interests</h3>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_IDS.map((c) => (
          <Chip
            key={c}
            selected={user.interests.includes(c)}
            icon={<CategoryIcon id={c} />}
            onToggle={() => actions.updateProfile({ interests: user.interests.includes(c) ? user.interests.filter((x) => x !== c) : [...user.interests, c] })}
          >
            {CATEGORIES[c].label}
          </Chip>
        ))}
      </div>

      <hr className="my-8 border-line" />
      <h3 className="mb-3 text-lg font-bold">Social profiles</h3>
      <SocialLinksEditor value={user.socials} onChange={(socials) => actions.updateProfile({ socials })} />
    </Card>
  )
}

export function PublicProfilePage() {
  const { id } = useParams()
  const { db, user } = useApp()
  const person = getUser(db, id)
  usePageTitle(person ? `${person.firstName}’s profile` : 'Profile not found')
  if (person && user?.id === person.id) return <Navigate to="/profile" replace />
  return (
    <Container className="max-w-4xl py-8">
      {!person ? (
        <EmptyState title="Profile not found" actions={<ButtonLink to="/discover">Browse events</ButtonLink>} />
      ) : person.privacy.profileVisibility === 'private' ? (
        <EmptyState icon={<Lock aria-hidden />} title={`${person.firstName} keeps their profile private`}>
          That’s a choice we respect. You’ll meet them at events instead.
        </EmptyState>
      ) : person.privacy.profileVisibility === 'members' && !user ? (
        <EmptyState icon={<Lock aria-hidden />} title="Members-only profile" actions={<ButtonLink to={`/login?next=/people/${person.id}`}>Sign in to view</ButtonLink>}>
          {person.firstName} shares their profile with signed-in members only.
        </EmptyState>
      ) : (
        <>
          <h1 className="sr-only">{person.firstName}’s profile</h1>
          <ProfileView user={person} asPublic />
          <p className={cn('mt-6 text-center text-xs text-muted')}>
            Tandem has no followers, likes or personal ratings. <Link to="/about" className="underline">Why?</Link>
          </p>
        </>
      )}
    </Container>
  )
}
