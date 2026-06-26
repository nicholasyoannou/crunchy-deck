// See https://svelte.dev/docs/kit/types#app

type CrResult<T> = { ok: true; data: T } | { ok: false; error: string; authExpired?: boolean }

interface CrBridge {
  version: string
  log(m: string): void
  auth: {
    login(username: string, password: string): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
    logout(): Promise<CrResult<void>>
    status(): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
  }
  api: {
    home(
      locale?: string
    ): Promise<
      CrResult<{ feed: any; heroCards: any[]; heroItems: any[]; rows: { title: string; link?: string; ids?: string[] }[] }>
    >
    row(desc: { title: string; link?: string; ids?: string[] }, locale?: string): Promise<CrResult<any[]>>
    series(
      id: string,
      locale?: string
    ): Promise<
      CrResult<{
        series: any
        seasons: any[]
        upNext: { id: string; seasonNumber: number; episodeNumber: number; playhead: number; fullyWatched: boolean } | null
      }>
    >
    episodes(seasonId: string, locale?: string): Promise<CrResult<any[]>>
  }
  device: {
    code(): Promise<CrResult<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }>>
    poll(
      device_code: string
    ): Promise<CrResult<{ status: 'ok' | 'pending' | 'slow_down' | 'expired' | 'error'; error?: string }>>
  }
  player: {
    stream(
      id: string
    ): Promise<
      CrResult<{
        accessToken: string
        contentId: string
        assetId?: string
        videoToken: string
        manifestUrl: string
        drmUrl?: string
        audioLocale?: string
        hardSubs: Record<string, { url: string }>
      }>
    >
    release(contentId: string, videoToken: string): Promise<CrResult<void>>
  }
}

declare global {
  namespace App {}
  interface Window {
    cr: CrBridge
  }
}

export {}
