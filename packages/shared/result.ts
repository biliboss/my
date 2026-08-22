//! The failure shape every herdr-facing use case returns, and the reason it is
//! TAGGED instead of a bare string.
//!
//! A use case here refuses for four different reasons, and the caller has to
//! tell them apart to answer: a CLI prints them differently, an HTTP wrapper
//! maps them to 404 / 409 / 502. Before the tag, the wrapper re-derived the
//! reason by matching on the message text — which is how a reworded error
//! silently turned a 409 into a 500.
//!
//! No HTTP status here on purpose. This layer knows nothing about transport;
//! the mapping belongs to whoever wraps it.
//!
//! depends_on: —
//! impacts:    src/herdr/CONTEXT.md

export type Fail = {
  ok: false
  error: string
  /**
   *  - `not_found` the id or label names nothing
   *  - `ambiguous` the label names more than one, and guessing closes the wrong pane
   *  - `blocked`   the workspace fence refuses it (see `herdr/policy.ts`)
   *  - `herdr`     the multiplexer itself failed — the fault is OUTSIDE this process
   */
  reason: 'not_found' | 'ambiguous' | 'blocked' | 'herdr'
  /** The candidate ids, on `ambiguous` only — the ambiguity is returned, never guessed. */
  ids?: string[]
}

/** herdr said no. Its failures are all one reason, so this is the common wrap. */
export const upstream = (error: string): Fail => ({ ok: false, error, reason: 'herdr' })
