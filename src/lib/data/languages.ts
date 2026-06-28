import audio from './audio-languages.json'
import subtitle from './subtitle-languages.json'
import ui from './ui-languages.json'

// CR's own locale -> display-name maps (lifted from the official app's i18n assets).
export type LangMap = Record<string, string>
export const AUDIO_LANGUAGES = audio as LangMap
export const SUBTITLE_LANGUAGES = subtitle as LangMap
export const DISPLAY_LANGUAGES = ui as LangMap

export interface LangOption {
  code: string
  label: string
}

let intl: Intl.DisplayNames | null = null
function intlLabel(code: string): string | null {
  try {
    intl ??= new Intl.DisplayNames(['en'], { type: 'language' })
    return intl.of(code) ?? null
  } catch {
    return null
  }
}

// CR's label if we have it, else a proper language name from Intl (covers e.g. ja-JP, which isn't in
// the audio map), else the raw code as a last resort.
export function langLabel(map: LangMap, code: string, empty = 'None'): string {
  if (!code) return empty
  return map[code] ?? intlLabel(code) ?? code
}

export function langOptions(map: LangMap): LangOption[] {
  return Object.entries(map).map(([code, label]) => ({ code, label }))
}

// Picker options, guaranteeing the current value appears (so a CR locale outside our list still shows
// as the selected row). `lead` prepends fixed options like "None".
export function pickerOptions(map: LangMap, current: string, lead: LangOption[] = []): LangOption[] {
  const opts = [...lead, ...langOptions(map)]
  if (current && !opts.some((o) => o.code === current)) opts.splice(lead.length, 0, { code: current, label: langLabel(map, current) })
  return opts
}

export const SUBTITLE_NONE: LangOption = { code: '', label: 'None' }
