import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

//! I18N sem dependência: um dicionário por locale, uma chave por texto.
//!
//! Duas decisões que economizam a maior parte da dor:
//!
//! 1. **A CHAVE É O TEXTO NA LÍNGUA DE ORIGEM.** `t("Troque a pergunta.")` em vez
//!    de `t("hero.line")`. Chave abstrata obriga a abrir o dicionário pra saber o
//!    que a tela diz, e o dia em que alguém esquece de traduzir a tela mostra
//!    `hero.line` pro usuário. Aqui o pior caso é aparecer em português.
//!
//! 2. **Faltou tradução, devolve a origem** — e avisa no console em dev. Texto
//!    faltando nunca deve virar tela quebrada.
//!
//! O `<html lang>` acompanha o locale: leitor de tela e hifenização leem de lá.

export type Locale = string;
export type Dict = Record<string, string>;
export type Dicts = Record<Locale, Dict>;

/** Interpola `{nome}` — o suficiente pra contagem e nome próprio, e nada além
 *  disso de propósito: plural e data pedem `Intl`, não um mecanismo caseiro. */
function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
}

/** `import.meta.env` é do bundler, não da linguagem: o pacote é compilado por
 *  `tsc` puro e não pode DEPENDER dele — lido com guarda, some em produção. */
const DEV = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export type T = (text: string, vars?: Record<string, string | number>) => string;

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: T; locales: Locale[] };

const I18nContext = createContext<Ctx | null>(null);

/** Escolhe o melhor locale disponível pro navegador: exato, depois só a língua
 *  (`pt-PT` cai em `pt-BR` se for o único `pt`), depois o de origem. */
function negotiate(available: Locale[], source: Locale): Locale {
  if (typeof navigator === "undefined") return source;
  const stored = localStorage.getItem("my-locale");
  if (stored && available.includes(stored)) return stored;
  for (const want of navigator.languages ?? [navigator.language]) {
    if (available.includes(want)) return want;
    const lang = want.split("-")[0];
    const near = available.find((a) => a.split("-")[0] === lang);
    if (near) return near;
  }
  return source;
}

export function I18nProvider({
  dicts,
  source = "pt-BR",
  children,
}: {
  /** Um dicionário por locale. O locale de ORIGEM pode ficar de fora: as chaves
   *  já são o texto dele. */
  dicts: Dicts;
  source?: Locale;
  children: ReactNode;
}) {
  const locales = useMemo(() => Array.from(new Set([source, ...Object.keys(dicts)])), [dicts, source]);
  const [locale, setLocale] = useState<Locale>(() => negotiate(locales, source));

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("my-locale", locale);
  }, [locale]);

  const value = useMemo<Ctx>(() => {
    const dict = dicts[locale] ?? {};
    const t: T = (text, vars) => {
      if (locale === source) return interpolate(text, vars);
      const hit = dict[text];
      if (hit === undefined && DEV) {
        console.warn(`[my-ui/i18n] sem tradução em ${locale}: ${JSON.stringify(text)}`);
      }
      return interpolate(hit ?? text, vars);
    };
    return { locale, setLocale, t, locales };
  }, [dicts, locale, locales, source]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Fora de um `<I18nProvider>` devolve a identidade: uma landing monolíngue não
 *  precisa montar provider nenhum, e `t()` continua sendo seguro de escrever. */
export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: typeof document === "undefined" ? "pt-BR" : document.documentElement.lang || "pt-BR",
    setLocale: () => {},
    t: (text, vars) => interpolate(text, vars),
    locales: [],
  };
}

export function useT(): T {
  return useI18n().t;
}

/** Troca de idioma, no mesmo formato do seletor de tema. Some sozinho quando só
 *  existe um locale — botão de escolha única é ruído. */
export function LocaleSwitch() {
  const { locale, setLocale, locales } = useI18n();
  if (locales.length < 2) return null;
  return (
    <div className="theme-switch" aria-label="Idioma">
      {locales.map((l) => (
        <button key={l} className={l === locale ? "active" : ""} onClick={() => setLocale(l)}>
          {l.split("-")[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}
