//! O Tailwind v4 existe aqui por UMA razão: o HeroUI 3 publica o CSS dele como
//! FONTE Tailwind (`@heroui/react/dist/styles.css` é um arquivo de 67 bytes que
//! só faz `@import "@heroui/styles"`). Sem este plugin o import é resolvido pra
//! nada, o build passa VERDE, e a página vai pro ar sem o estilo dos
//! componentes — medido em 21/08: o CSS publicado saiu com 19KB em vez de 248KB.
//!
//! depends_on: apps/lp/app/heroui.css
//! impacts:    apps/lp/app/layout.tsx

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
