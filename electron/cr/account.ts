// Account + current-profile preferences. The bearer token is already profile-scoped (switchProfile
// re-mints it per profile), so GET/PATCH /accounts/v1/me/profile read+write the CURRENTLY selected
// profile — exactly the per-profile prefs the official apps sync.
import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export interface Membership {
  premium: boolean | null // null = couldn't determine from the token
  benefits: string[]
}

// CR's access token is a JWT whose `benefits` claim lists entitlements (e.g. cr_premium). Decode it
// in-process — no extra round trip — and treat any premium-looking benefit as "has Premium".
export async function getMembership(): Promise<Membership> {
  const payload = decodeJwt(await accessToken())
  const benefits = Array.isArray(payload?.benefits) ? (payload!.benefits as string[]) : []
  console.log('[membership] benefits', JSON.stringify(benefits))
  const premium = benefits.length ? benefits.some((b) => /premium|fan_pack|mega_fan|super_fan/i.test(b)) : null
  return { premium, benefits }
}

export interface ProfilePrefs {
  audioLanguage: string // locale code, e.g. 'ja-JP'
  subtitleLanguage: string // locale code, e.g. 'en-US'
  displayLanguage: string // UI / metadata locale, e.g. 'en-US'
  matureContent: boolean // CR maturity_rating: M3 = on, M2 = off
  closedCaptions: boolean
  audioDescription: boolean
}

// CR maturity flag: 'M3' allows mature content, 'M2' hides it.
const MATURE_ON = 'M3'
const MATURE_OFF = 'M2'

export async function getProfilePrefs(): Promise<ProfilePrefs> {
  const token = await accessToken()
  const p: any = await crFetch(`${CR.API}/accounts/v1/me/profile`, { bearer: token })
  console.log('[prefs] fields', Object.keys(p ?? {}).join(','))
  console.log('[prefs] values', JSON.stringify({
    maturity: p?.maturity_rating,
    comm: p?.preferred_communication_language,
    audio: p?.preferred_content_audio_language,
    sub: p?.preferred_content_subtitle_language
  }))
  return {
    audioLanguage: p?.preferred_content_audio_language ?? '',
    subtitleLanguage: p?.preferred_content_subtitle_language ?? '',
    displayLanguage: p?.preferred_communication_language ?? '',
    matureContent: p?.maturity_rating === MATURE_ON,
    closedCaptions: !!p?.prefer_closed_captions,
    audioDescription: !!p?.prefer_description_audio_role
  }
}

// Partial update — send only the fields the user changed. CR merges and syncs to every device.
export type ProfilePrefsPatch = Partial<ProfilePrefs>

export async function setProfilePrefs(patch: ProfilePrefsPatch): Promise<{ ok: true }> {
  const body: Record<string, unknown> = {}
  if (patch.audioLanguage !== undefined) body.preferred_content_audio_language = patch.audioLanguage
  if (patch.subtitleLanguage !== undefined) body.preferred_content_subtitle_language = patch.subtitleLanguage
  if (patch.displayLanguage !== undefined) body.preferred_communication_language = patch.displayLanguage
  if (patch.matureContent !== undefined) body.maturity_rating = patch.matureContent ? MATURE_ON : MATURE_OFF
  if (patch.closedCaptions !== undefined) body.prefer_closed_captions = patch.closedCaptions
  if (patch.audioDescription !== undefined) body.prefer_description_audio_role = patch.audioDescription
  const token = await accessToken()
  await crFetch(`${CR.API}/accounts/v1/me/profile`, { method: 'PATCH', json: body, bearer: token })
  return { ok: true }
}
