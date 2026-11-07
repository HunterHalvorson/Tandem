/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 web client id for "Sign in with Google" (optional — the button only appears when set). */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
