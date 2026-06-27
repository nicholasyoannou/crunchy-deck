import { app } from 'electron'
import { readdirSync, readFileSync } from 'node:fs'

// Steam's reaper waits for the ENTIRE process tree. Electron's GPU/zygote children can outlive the
// main process (esp. under gamescope), keeping the reaper — and Steam's "running" state — alive, so
// the next launch hangs and the stale signed-in instance races the refresh token. app.quit() and even
// app.exit(0) leave those children; explicitly SIGKILL every descendant first, then exit.
export function killTreeAndExit(): void {
  try {
    const childrenOf = new Map<number, number[]>()
    for (const d of readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue
      try {
        const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
        const ppid = Number(stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/)[1]) // [0]=state,[1]=ppid
        const arr = childrenOf.get(ppid) ?? []
        arr.push(Number(d))
        childrenOf.set(ppid, arr)
      } catch {
        /* pid vanished mid-scan */
      }
    }
    const doomed: number[] = []
    const walk = (root: number) => {
      for (const c of childrenOf.get(root) ?? []) {
        doomed.push(c)
        walk(c)
      }
    }
    walk(process.pid)
    for (const pid of doomed) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* /proc unavailable (non-Linux) */
  }
  app.exit(0)
}
