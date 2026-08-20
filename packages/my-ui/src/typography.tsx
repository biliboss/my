import type { CSSProperties, ElementType, ReactNode } from "react";

//! TIPOGRAFIA como passo, não como pixel. Cada componente aqui é um par
//! (tamanho, entrelinha, tracking) que já foi decidido — escolher os três
//! separadamente é como um título grande vira texto frouxo.
//!
//! `as` existe porque o NÍVEL SEMÂNTICO e o TAMANHO são coisas diferentes: uma
//! seção pode precisar de um `<h2>` pequeno sem virar `<h3>` só pra caber.

type TextProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

function make(step: string, weight: string, lh: string, tr: string, fallback: ElementType) {
  return function Text({ children, as, className = "", style }: TextProps) {
    const As = as ?? fallback;
    return (
      <As
        className={className}
        style={{
          fontSize: `var(${step})`,
          fontWeight: `var(${weight})`,
          lineHeight: `var(${lh})`,
          letterSpacing: `var(${tr})`,
          ...style,
        }}
      >
        {children}
      </As>
    );
  };
}

/** A manchete da primeira dobra. Uma por página. */
export const Display = make("--fs-9", "--fw-black", "--lh-tight", "--tr-tight", "h1");
/** O título de uma dobra. */
export const Title = make("--fs-8", "--fw-bold", "--lh-tight", "--tr-tight", "h2");
/** O título de um passo dentro de uma dobra. */
export const Subtitle = make("--fs-5", "--fw-semibold", "--lh-snug", "--tr-snug", "h3");
/** O parágrafo de posicionamento, logo abaixo de um título. */
export const Lead = make("--fs-4", "--fw-regular", "--lh-loose", "--tr-normal", "p");
export const Body = make("--fs-2", "--fw-regular", "--lh-normal", "--tr-normal", "p");
/** A letra miúda: limite assumido, nota de integridade, contagem. */
export const Fine = make("--fs-1", "--fw-regular", "--lh-normal", "--tr-normal", "small");

/** A etiqueta monoespaçada em caixa alta que abre uma dobra. */
export function Mono({ children, as: As = "span", className = "", style }: TextProps) {
  return (
    <As
      className={className}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-0)",
        letterSpacing: "var(--tr-wider)",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </As>
  );
}

/** Trecho de código no meio de uma frase. */
export function Code({ children }: { children: ReactNode }) {
  return <code>{children}</code>;
}

/** Uma tecla. Usada pela navegação por dobra, e por qualquer texto que ensine
 *  um atalho — que é a única forma de um atalho ser descoberto. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
