//! `3 de 9 tasks` — o progresso que o commit já declarava e ninguém lia.
//!
//! `3 commits` responde quanto ANDOU; `3 de 9 tasks` responde quanto FALTA, e o denominador
//! já estava no plano. A marca `[S2/T3]` no fim do assunto é o que liga os dois — 13 commits
//! do lote vivo a carregam, medido em 17/08.
//!
//! Sem marca nenhuma o widget se cala e a linha volta a contar commits: inventar um
//! denominador seria pior que contar a coisa errada.

export function taskCount(done: number, total: number): string | undefined {
  if (!total || !done) return undefined
  return `${done} de ${total} tasks`
}
