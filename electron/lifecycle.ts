import { BrowserWindow } from 'electron'
import { readdirSync, readFileSync } from 'node:fs'

// FAST + COMPLETE teardown. Why not app.quit()/app.exit()?
//  - app.quit() runs Electron's graceful shutdown, which under gamescope stalls for SECONDS waiting on
//    the GPU/network service — that's the "obscene quit time".
//  - Even app.exit(0) leaves the GPU/zygote children alive; Steam's reaper then waits on the whole
//    process tree, so the NEXT launch hangs and the stale signed-in instance races the refresh token.
//  - A BrowserWindow left undestroyed leaves a surface gamescope keeps expecting → hung session.
// So: destroy windows (free the surface), SIGKILL every descendant + our process group, then a hard
// process.exit (no graceful path to stall on). Wired to app:quit, window-all-closed, SIGTERM, SIGINT.
export function killTreeAndExit(reason = 'quit'): void {
  console.log('[quit]', reason)

  // 1) Destroy windows synchronously so gamescope releases their surfaces immediately.
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        w.destroy()
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* ignore */
  }

  // 2) SIGKILL the whole descendant tree (renderers, GPU, zygote, utility) so nothing outlives us.
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

  // 3) SIGKILL our own process group too — catches any child that re-parented or spawned mid-scan.
  // No-op (ESRCH) if we aren't the group leader; the tree walk above already covered descendants.
  try {
    process.kill(-process.pid, 'SIGKILL')
  } catch {
    /* not the group leader */
  }

  // 4) Hard exit. process.exit (not app.exit) skips Electron's graceful shutdown, which is the part
  // that stalls under gamescope. The children are already dead, so there's nothing to clean up.
  process.exit(0)
}
