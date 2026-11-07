/**
 * Loads Google Identity Services (https://accounts.google.com/gsi/client) on demand.
 * Configure with VITE_GOOGLE_CLIENT_ID in frontend/.env.local (see README → "Sign in with Google").
 * A web OAuth client id is public by design — it is not a secret.
 */

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || undefined

export interface GoogleCredentialResponse {
  credential: string
}

export interface GoogleButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    itp_support?: boolean
    context?: 'signin' | 'signup' | 'use'
  }): void
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
  disableAutoSelect(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let loading: Promise<GoogleAccountsId> | null = null

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (loading) return loading
  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google Identity Services did not initialise.'))
    }
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** After signing out, stop Google from silently re-selecting the same account. */
export function googleDisableAutoSelect(): void {
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch {
    /* script not loaded — nothing to do */
  }
}
