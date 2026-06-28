// Style of the in-player "Next episode" prompt, persisted in localStorage.
//  - 'full'    : thumbnail + "E{n} · {title}" (the default).
//  - 'minimal' : just "Next episode" + the episode number — no title, no thumbnail.
const KEY = 'cr.nextEpisodeStyle'
export type NextEpStyle = 'full' | 'minimal'

export function getNextEpStyle(): NextEpStyle {
  try {
    return localStorage.getItem(KEY) === 'minimal' ? 'minimal' : 'full'
  } catch {
    return 'full'
  }
}

export function setNextEpStyle(s: NextEpStyle): void {
  try {
    localStorage.setItem(KEY, s)
  } catch {
    /* ignore */
  }
}
