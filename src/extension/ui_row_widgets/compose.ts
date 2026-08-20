//! COMPOSE — a row is a list of widgets, and this is what puts them together.
//!
//! A `TreeItem` has four slots a widget can fill: the label, the dimmed text beside
//! it, the icon, and the hover. So a widget is a function returning a piece of one
//! of those, and a row is a composition — never a template string built inline.
//!
//! Why bother, in a tree of four row kinds: every design change so far was a change
//! to ONE piece. The clock gained seconds; `draft` replaced an hourglass; the status
//! moved out of the row and into the hover. Each of those touched one widget and
//! nothing else, and that is the whole return on this file.
//!
//! `undefined` means "this widget has nothing to say" and disappears — a row never
//! renders an empty separator, so no widget has to know whether it is last.

import * as vscode from 'vscode'

export interface RowParts {
  /** The name. One string, because a `TreeItem` label is one string. */
  label: string
  /** Dimmed text beside the label, in order. `undefined` entries vanish. */
  parts?: (string | undefined)[]
  icon?: vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri }
  /** Markdown blocks, joined by blank lines. `undefined` entries vanish. */
  hover?: (string | undefined)[]
  /** Stable identity, so selection and expansion survive a refresh. */
  id?: string
  command?: vscode.Command
  /** Drives `when: viewItem == …` for inline buttons. */
  context?: string
  /** A real file, which is what makes the row draggable and gives it a native path. */
  resource?: vscode.Uri
  children?: boolean
  expanded?: boolean
}

/** The separator between parts: thin, because the parts are already short. */
const BETWEEN = ' '

export function compose(parts: RowParts): vscode.TreeItem {
  const item = new vscode.TreeItem(
    parts.label,
    // No twisty when there is nothing under it: an empty expander is a promise the
    // row does not keep.
    parts.children
      ? parts.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None,
  )

  const description = (parts.parts ?? []).filter(Boolean).join(BETWEEN)
  if (description) item.description = description

  const hover = (parts.hover ?? []).filter(Boolean).join('\n\n')
  if (hover) item.tooltip = new vscode.MarkdownString(hover)

  if (parts.icon) item.iconPath = parts.icon
  if (parts.id) item.id = parts.id
  if (parts.command) item.command = parts.command
  if (parts.context) item.contextValue = parts.context
  if (parts.resource) item.resourceUri = parts.resource

  return item
}
