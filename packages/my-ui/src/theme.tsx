import { useEffect, useState } from "react";

//! OS TEMAS. Três, e o padrão é **SynthWave '84** — o tema do Robb Owen pro VS
//! Code. Ele não está aqui por nostalgia: é a paleta em que esta casa escreve
//! código o dia inteiro, e uma landing que não parece o editor onde o produto
//! nasceu está mentindo sobre de onde ela veio.
//!
//! A paleta inteira vive no CSS (`tokens.css`); aqui só mora a ESCOLHA. Isso é
//! de propósito — trocar um hex não deveria exigir recompilar JavaScript.

export const THEMES = ["synthwave", "aura", "tokyo"] as const;
export type Theme = (typeof THEMES)[number];

const LABELS: Record<Theme, { short: string; title: string }> = {
  synthwave: { short: "Synth", title: "SynthWave '84" },
  aura: { short: "Aura", title: "Aura" },
  tokyo: { short: "Tokyo", title: "Tokyo Night" },
};

const KEY = "my-theme";

/** O tema vive no `<html data-theme>` e persiste no localStorage.
 *
 *  Um valor guardado que não é mais um tema (renomeamos um, ou a pessoa mexeu
 *  no storage) cai no padrão em vez de deixar a página sem paleta nenhuma. */
export function useTheme(initial: Theme = "synthwave") {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof localStorage === "undefined") return initial;
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved && (THEMES as readonly string[]).includes(saved) ? saved : initial;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}

export function ThemeSwitch({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="theme-switch" aria-label="Tema visual">
      {THEMES.map((t) => (
        <button
          key={t}
          title={LABELS[t].title}
          className={theme === t ? "active" : ""}
          onClick={() => setTheme(t)}
        >
          {LABELS[t].short}
        </button>
      ))}
    </div>
  );
}
