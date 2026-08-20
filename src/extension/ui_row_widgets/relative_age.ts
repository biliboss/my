//! `há 6 min` · `há 2 h` · `há 3 dias` — a timestamp answered in words.
//!
//! `6m` was shorter and nobody could read it: reported from the screen, "3c 6m" was
//! four characters of mystery. A sidebar is glanced at, not decoded, so the unit is
//! spelled and the preposition stays.

export function relativeAge(since: number): string {
  const minutes = Math.floor((Date.now() - since) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
}
