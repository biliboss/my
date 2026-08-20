//! The two clocks of the view, and when each one runs.
//!
//! DATA tick: re-reads the disk. 10s while something moves, 60s otherwise, never
//! while hidden — VS Code stops calling `getChildren` for a hidden view anyway, and a
//! `git log` per run per minute against a sidebar nobody is looking at is a battery
//! bill.
//!
//! BEAT: repaints once a second so a countdown in `m:ss` actually counts. It reads the
//! CACHE, never the disk, and it animates nothing else — the icon animates itself from
//! a file, because repainting the tree fast enough to animate a colour flickers the
//! whole sidebar.

import * as vscode from 'vscode'
import { log } from '../log.js'
import type { RunsTree } from './provider.js'

const FAST = 10_000
const SLOW = 60_000
// One second: what a countdown in `m:ss` needs, and nothing more. The old 250ms beat
// existed to animate a colour; the animation moved into the icon file, and the flicker
// went with it.
const BEAT = 1_000

export function startTicking(view: vscode.TreeView<unknown>, tree: RunsTree): vscode.Disposable {
  let data: NodeJS.Timeout | undefined
  let beat: NodeJS.Timeout | undefined
  let rate = 0

  const stop = () => {
    if (data) clearInterval(data)
    if (beat) clearInterval(beat)
    data = undefined
    beat = undefined
  }

  const arm = () => {
    const wanted = view.visible ? (tree.moving() ? FAST : SLOW) : 0
    if (wanted === rate) return
    stop()
    rate = wanted
    if (!wanted) {
      log().info('tick stop')
      return
    }
    data = setInterval(() => {
      tree.refresh()
      // Re-arm at the other speed when the work starts or stops.
      arm()
    }, wanted)
    // Only a live countdown needs a beat — a still tree has nothing to redraw.
    if (tree.ticking()) beat = setInterval(() => tree.repaint(), BEAT)
    log().info(`tick ${wanted}ms${beat ? ' + beat' : ''}`)
  }

  arm()

  const visibility = view.onDidChangeVisibility(() => arm())
  return {
    dispose: () => {
      visibility.dispose()
      stop()
    },
  }
}
