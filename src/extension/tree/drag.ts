//! Dragging a row out gives you the run's OUTPUT FOLDER as a path.
//!
//! `text/uri-list` is the mime the rest of the editor already speaks: dropping on an
//! editor opens the folder, dropping on a terminal or a chat pastes the path. A custom
//! mime would only be understood by us, which is the opposite of what a drag is for.
//!
//! A commit is not a file and a unit lives in another checkout — both drag as nothing
//! rather than as something misleading.

import * as vscode from 'vscode'
import type { Node } from './provider.js'

export class DragRunFolder implements vscode.TreeDragAndDropController<Node> {
  readonly dragMimeTypes = ['text/uri-list']
  // Nothing is accepted INTO the tree: the disk is written by the workflows, and a
  // sidebar that accepts drops would be a second writer nobody asked for.
  readonly dropMimeTypes: string[] = []

  handleDrag(source: readonly Node[], transfer: vscode.DataTransfer): void {
    const uris = source
      .flatMap((node) => (node.kind === 'run' ? [node.run.dir] : []))
      .map((dir) => vscode.Uri.file(dir).toString())
    if (!uris.length) return
    // Newline-separated, per the uri-list spec — how multi-select drags arrive
    // everywhere else in the editor.
    transfer.set('text/uri-list', new vscode.DataTransferItem(uris.join('\r\n')))
  }
}
