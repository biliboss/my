import type { Fail } from "@my/shared/result"
import * as policy from '../policy.ts'
import { resolve } from './resolve.ts'

const ALLOWED_WHILE_BLOCKED = new Set(['unblock', 'hide', 'unhide'])

export type Verb = 'block' | 'unblock' | 'hide' | 'unhide'

export async function mark(
  verb: Verb,
  key: string,
  reason?: string,
): Promise<{ ok: true; id: string; verb: Verb; mark: policy.Mark | boolean } | Fail> {
  const found = await resolve(key)
  if (!found.ok) return found

  const { id } = found.workspace
  if (!ALLOWED_WHILE_BLOCKED.has(verb)) {
    const fenced = policy.fence(id)
    if (fenced) return fenced
  }

  const done =
    verb === 'block' ? policy.block(id, reason)
    : verb === 'unblock' ? policy.unblock(id)
    : verb === 'hide' ? policy.hide(id)
    : policy.unhide(id)

  return { ok: true, id, verb, mark: done }
}

