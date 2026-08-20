//! `3 de 4 unidades` — how much of a fan-out has moved.

export function unitCount(moving: number, total: number): string | undefined {
  if (!total) return undefined
  return `${moving} de ${total} unidade${total === 1 ? '' : 's'}`
}
