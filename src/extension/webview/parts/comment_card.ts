//! One comment, in a card. The thread is usually WHY someone opened the pane.

import { escape } from '../shell.js'
import { ghBody } from './gh_body.js'
import { when } from './when.js'

export interface CommentLike {
  author: string
  avatar: string | null
  createdAt: string
  bodyHtml: string
}

export function commentCard(comment: CommentLike): string {
  return `
<article class="card bg-base-200 border border-base-300">
  <div class="card-body gap-2 p-4">
    <header class="flex items-center gap-2 text-xs opacity-70">
      ${comment.avatar ? `<img class="w-5 h-5 rounded-full" src="${escape(comment.avatar)}" alt="">` : ''}
      <strong class="font-semibold">${escape(comment.author)}</strong>
      <span>·</span>
      <span>${when(comment.createdAt)}</span>
    </header>
    ${ghBody(comment.bodyHtml, 'text-sm')}
  </div>
</article>`
}
