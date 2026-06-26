// See https://svelte.dev/docs/kit/types#app

type CrResult<T> = { ok: true; data: T } | { ok: false; error: string }

interface CrBridge {
  version: string
  auth: {
    login(username: string, password: string): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
    logout(): Promise<CrResult<void>>
    status(): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
  }
  api: {
    home(locale?: string): Promise<CrResult<{ feed: any; itemsByRow: any[][] }>>
  }
}

declare global {
  namespace App {}
  interface Window {
    cr: CrBridge
  }
}

export {}
