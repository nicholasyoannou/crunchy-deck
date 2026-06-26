import { goto } from '$app/navigation'

// If a call failed because the session expired / the account signed out, send the user
// back to login. Returns true when it handled (redirected), so callers can bail early.
export function authGuard(res: { ok: boolean; authExpired?: boolean }): boolean {
  if (!res.ok && res.authExpired) {
    goto('/login')
    return true
  }
  return false
}
