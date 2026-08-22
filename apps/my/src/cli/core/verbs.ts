//! O decorator `@verb` e o registro que ele alimenta.
//!
//! Existe porque um GRUPO não tem onde guardar a própria descrição: o subverbo
//! tem a docstring do arquivo, e a pasta não tem arquivo. Sem isto o help
//! dizia "6 subcomandos", que não é descrição — é contagem.
//!
//! O decorator DESCREVE, nunca declara. Pasta sem `@verb` continua aparecendo,
//! só que sem a frase; pasta com `@verb` e sem código no disco não vira comando
//! nenhum. A CLI continua sendo o disco — isto é a legenda dela.
//!
//! Decorator LEGADO, que é o que o bun implementa: a assinatura é
//! `(target, key, descriptor)` e o nome do verbo é `key`. Medido em 17/08 — na
//! forma TC39 o `ctx.name` chega `undefined`.
//!
//! depends_on: —
//! impacts:    src/cli/my.ts · src/cli/core/router.ts

/** verbo → a frase que o `my --help` mostra. */
export const VERBS = new Map<string, string>();

/** Marca o método como VERBO da CLI e guarda a descrição dele. O corpo do
 *  método nunca roda: quem executa é o subverbo, achado no disco. */
export const verb =
  (description: string) =>
  (_target: unknown, key: string) => {
    VERBS.set(key, description);
  };
