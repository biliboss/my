//! As quatro composições, por rota.
//!
//! Barril de conveniência pro `apps/lp`: a rota importa UMA coisa, e o nome
//! dela é o nome da fatia. Sem isto cada `page.tsx` decoraria o caminho
//! interno do pacote, e mover um arquivo aqui dentro quebraria quatro rotas.
//!
//! depends_on: packages/lp-slices/src/pages/
//! impacts:    apps/lp/app/

export { CodigoSlice } from "./codigo";
export { DesignSlice } from "./design";
export { EmpresaSlice } from "./empresa";
export { KanbanSlice } from "./kanban";
