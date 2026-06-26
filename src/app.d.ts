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
    home(locale?: string): Promise<CrResult<{ feed: any; itemsByRow: any[][]; heroItems: any[] }>>
  }
  device: {
    code(): Promise<CrResult<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }>>
    poll(
      device_code: string
    ): Promise<CrResult<{ status: 'ok' | 'pending' | 'slow_down' | 'expired' | 'error'; error?: string }>>
  }
}

declare global {
  namespace App {}
  interface Window {
    cr: CrBridge
  }
}

export {}
