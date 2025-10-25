/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N2YO_API_KEY: string
  readonly VITE_NASA_API_KEY: string
  readonly VITE_SPACE_TRACK_USERNAME: string
  readonly VITE_SPACE_TRACK_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
