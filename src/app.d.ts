// See https://svelte.dev/docs/kit/types#app

type CrResult<T> = { ok: true; data: T } | { ok: false; error: string; authExpired?: boolean }

interface CrBridge {
  version: string
  steam: boolean // launched through Steam (Steam OSK available) vs bare (use in-app keyboard)
  log(m: string): void
  auth: {
    login(username: string, password: string): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
    logout(): Promise<CrResult<void>>
    status(): Promise<CrResult<{ authenticated: boolean; account_id?: string; country?: string }>>
    profiles(): Promise<
      CrResult<
        { profile_id: string; profile_name?: string; username?: string; avatar?: string; wallpaper?: string; is_selected?: boolean }[]
      >
    >
    switchProfile(profile_id: string): Promise<CrResult<{ profile_id: string; account_id?: string }>>
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
    heroDetail(
      id: string,
      locale?: string
    ): Promise<
      CrResult<{
        rating: string | null
        isDubbed: boolean
        isSubbed: boolean
        genres: string[]
        upNext: { id: string; seasonNumber: number; episodeNumber: number; playhead: number; fullyWatched: boolean } | null
      }>
    >
    episodes(seasonId: string, locale?: string): Promise<CrResult<any[]>>
    search(query: string, locale?: string): Promise<CrResult<any[]>>
    watchlist(locale?: string): Promise<CrResult<any[]>>
    watchlistCheck(contentId: string, locale?: string): Promise<CrResult<boolean>>
    watchlistAdd(contentId: string, locale?: string): Promise<CrResult<boolean>>
    watchlistRemove(contentId: string, locale?: string): Promise<CrResult<boolean>>
    browse(
      opts?: { sortBy?: string; type?: string; categories?: string; seasonalTag?: string; n?: number; start?: number },
      locale?: string
    ): Promise<CrResult<any[]>>
    categories(locale?: string): Promise<CrResult<{ id: string; title: string }[]>>
    seasons(locale?: string): Promise<CrResult<{ id: string; title: string }[]>>
    history(locale?: string): Promise<CrResult<any[]>>
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
        audioLocale?: string
        hardSubs: Record<string, { url: string }>
        versions: { audio_locale: string; guid: string; original?: boolean }[]
        meta: {
          title: string
          seriesTitle: string
          seasonNumber: number | null
          episodeNumber: number | null
          durationMs: number | null
          maturityRating: string | null
          maturitySystem: string | null
          descriptors: string[]
        }
      }>
    >
    release(contentId: string, videoToken: string): Promise<CrResult<void>>
    setPlayhead(contentId: string, playhead: number): Promise<CrResult<void>>
  }
  update: {
    onAvailable(cb: (d: { version: string }) => void): void
    onProgress(cb: (d: { percent: number }) => void): void
    onDownloaded(cb: (d: { version: string }) => void): void
    download(): Promise<void>
    install(): Promise<void>
  }
}

declare global {
  namespace App {}
  interface Window {
    cr: CrBridge
  }
}

export {}
