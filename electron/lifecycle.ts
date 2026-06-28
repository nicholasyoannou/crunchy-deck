import { BrowserWindow } from 'electron'
import { readdirSync, readFileSync } from 'node:fs'

// FAST + COMPLETE teardown. Why not app.quit()/app.exit()?
//  - app.quit() runs Electron's graceful shutdown, which under gamescope stalls for SECONDS waiting on
//    the GPU/network service — that's the "obscene quit time".
//  - Even app.exit(0) leaves the GPU/zygote children alive; Steam's reaper then waits on the whole
//    process tree, so the NEXT launch hangs and the stale signed-in instance races the refresh token.
//  - A BrowserWindow left undestroyed leaves a surface gamescope keeps expecting → hung session.
// So: destroy windows (free the surface), SIGKILL every descendant, then a clean process.exit(0) so
// Steam's reaper gets a proper SIGCHLD. (Do NOT also SIGKILL our own process group — that races the
// reaper and leaves Big Picture stuck on "abort game".) Wired to app:quit, window-all-closed, SIGTERM, SIGINT.
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

  // 3) Hard exit via process.exit — NOT app.exit (runs Electron's graceful shutdown that stalls under
  // gamescope), and crucially NOT a process-group SIGKILL of ourselves (`kill(-pid)`): that terminates
  // main in a way that races Steam's reaper, so Steam sees the PID vanish without a clean SIGCHLD and
  // stays stuck thinking the game is running ("abort game" loop in Big Picture). The children are
  // already SIGKILLed above, so a normal process.exit(0) lets the reaper observe the exit properly.
  process.exit(0)
}
