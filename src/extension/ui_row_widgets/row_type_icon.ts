//! The icon of a row: the SHAPE says which main, the COLOUR says the state.
//!
//! One glyph carries both because `TreeItem.iconPath` is a single `ThemeIcon` —
//! "type glyph plus spinner beside it" is not a shape the API has. A Nerd Font glyph
//! in the label is not a way around it: the sidebar renders in the UI font, not the
//! terminal font, so those code points come out as tofu. Emoji would render, and
//! would ignore the theme.
//!
//! `lightbulb` decides, `code` writes, `verified` approves — the three verbs of the
//! pipeline, in the order the tree already sorts them.
//!
//! And the EMOJI in the label is the second glyph, which is the thing originally asked
//! for and the API refuses to give: one `iconPath` per row. Emoji renders in the
//! sidebar because it comes from the system emoji font — unlike a Nerd Font code
//! point, which comes out as tofu. So the row carries two marks: the emoji says WHAT
//! this is, and the coloured icon says HOW IT IS DOING.
//!
//! THERE WAS A DRAWN-FILE PATH HERE, and it never drew anything. It looked for
//! `<main>-<state>.{gif,svg,png}` in an `icons/` folder beside the compiled code,
//! and that folder holds no files — it is not in git, so a fresh clone does not
//! even have the directory. Three `existsSync` per run row per repaint, 46 rows,
//! once a second: ~138 syscalls a second that never found anything, and the
//! fallback fired every single time. Deleted 19/08 with the rest of the
//! apparatus (`ICON_DIR`, `EXTENSIONS`, `STATE_NAME`, `fileIcon`, and `RowIcon`
//! as a union).
//!
//! The animated-GIF idea it was built for is still a good one — repainting four
//! times a second to cycle a colour DOES flicker the sidebar. Whoever picks it
//! up again should commit the files first; the code is three lines and comes
//! back with them. Code for a feature that never shipped costs a reader's
//! attention every time, and pays nothing back.

import * as vscode from 'vscode'
import { State } from './state_color.js'

const MAIN_ICON: Record<string, string> = {
  '02_product': 'lightbulb',
  '01_coding': 'code',
  '03_qa': 'verified',
}

/**
 * The icon of a row: a themed codicon, shape by main and colour by state.
 *
 * The codicon is not a placeholder waiting to be replaced — it follows the theme and a
 * PNG never will.
 * #enum_aberto: an unknown main draws a plain circle rather than disappearing.
 */
export function rowTypeIcon(main: string, state: State): vscode.ThemeIcon {
  return new vscode.ThemeIcon(MAIN_ICON[main] ?? 'circle-outline', new vscode.ThemeColor(state))
}

/** The three-letter tag of a main, for a hover that names the stage in words. */
export const MAIN_TAG: Record<string, string> = { '02_product': 'prod', '01_coding': 'cod', '03_qa': 'qa' }

/** The emoji that opens the label: 💡 decide · 💻 escreve · ✅ aprova. */
const MAIN_EMOJI: Record<string, string> = { '02_product': '💡', '01_coding': '💻', '03_qa': '✅' }

export function mainEmoji(main: string): string {
  return MAIN_EMOJI[main] ?? '📁'
}
