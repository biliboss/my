//! O que esta casa mediu do SurrealDB em 20/08, subindo um standalone com rocksdb e
//! ligando o CLI nele. Nada aqui foi lido em documentação: cada linha custou um erro.
//!
//! EMBARCADO E NÃO NA CASA, e a diferença é sobre QUEM é o dono do fato: isto é
//! conhecimento sobre o CÓDIGO, e viaja com ele. Quem instalar `@biliboss/my-resources`
//! leva junto, sem precisar de uma casa privada. O markdown que estava em
//! `03_resources/references/databases/` saiu no mesmo commit — dois lugares com o
//! mesmo texto é a segunda loja que este pacote existe pra recusar.

import { resource } from "../resource.ts";

export const surrealdb = resource({
	name: "databases/surrealdb",
	kind: "references",
	lens: "hacker",
	answers: "SurrealDB standalone com rocksdb: subir, o grafo, as regras no banco, o LIVE, e as armadilhas",
	at: "2026-08-20",
	body: `# SurrealDB standalone com rocksdb — o que foi medido, e as cinco armadilhas

Medido em 20/08 contra o servidor **3.2.3** e o SDK JS **2.0.8**, macOS aarch64,
subindo um standalone de verdade e ligando o \`my\` nele. Nada aqui foi lido em
documentação: cada linha custou um erro.

## Subir

\`\`\`bash
surreal start rocksdb:~/.me/surreal/me.db --user root --pass root --bind 127.0.0.1:8000
\`\`\`

Sobe em ~4s e responde \`GET /health\` com 200. \`/health\` é a sonda certa: a
pergunta é sobre o PROCESSO, e abrir websocket pra descobrir que não tem ninguém
custa o timeout inteiro.

Conectar + autenticar + escolher namespace: **20ms**. Um UPSERT seguido de SELECT:
**5ms**. HTTP e WebSocket mediram o mesmo tempo de conexão.

\`brew upgrade surreal\` recusa com \`Refusing to load formula from untrusted tap\`. A
saída estreita é confiar a FÓRMULA, não a tap:

\`\`\`bash
brew trust --formula surrealdb/tap/surreal
\`\`\`

Dado escrito pela 3.0.1 foi lido inteiro pela 3.2.3 — o rocksdb atravessou o
upgrade sem migração. A tap oficial fica um patch atrás do GitHub.

## As cinco armadilhas, em ordem de quanto custaram

**1. \`value\` É PALAVRA RESERVADA.** \`SELECT value FROM pref:x\` sai como
\`Parse error: Unexpected token, expected FROM\` — que parece erro de record id e não
é. Três diagnósticos errados. \`SELECT * FROM pref:x\` funciona, e o campo em crase
também.

**2. \`type::thing\` VIROU \`type::record\`.** O parser reconhece o nome velho só o
bastante pra sugerir o novo, e falha.

**3. TABELA INEXISTENTE É ERRO, NÃO VAZIO.** \`SELECT\` numa tabela que ninguém
definiu estoura com \`The table 'x' does not exist\`. Não existe o
\`CREATE TABLE IF NOT EXISTS\` implícito do SQLite — quem vem de lá espera lista
vazia e recebe exceção. Rodar os \`DEFINE TABLE IF NOT EXISTS\` na conexão substitui
a migração.

**4. O SDK DO NPM É 2.x, E ISSO NÃO É ATRASO.** \`npm view surrealdb dist-tags\` diz
\`latest: 2.0.8\`; não existe 3.x publicado, e o 2.0.8 fala com o servidor 3.2.3 sem
adaptador. Não espere a 3.x do npm — ela não vem.

**5. O SOCKET SEGURA O PROCESSO.** Aberta a conexão, o loop do Bun não esvazia: um
comando de 300ms ficou pendurado até 120s de timeout. Vale pra HTTP também, não só
WebSocket. Fechar explicitamente no fim resolve; \`process.exit()\` NÃO, porque com
stdout num pipe ele mata antes do flush.

## O grafo: \`RELATE\`, e a armadilha da chave

\`\`\`surql
RELATE thing:t1->labeled->label:bug SET at = time::now();
SELECT ->labeled->label.name AS labels FROM thing:t1;      -- ida
SELECT <-labeled<-thing.title AS coisas FROM label:bug;    -- volta, de graça
SELECT ->labeled.by AS quem FROM thing:t1;                 -- campo NA aresta
SELECT ->labeled[WHERE by='gabriel']->label.name FROM thing:t1;
\`\`\`

**\`RELATE\` DUPLICA EM SILÊNCIO.** Dois \`RELATE\` idênticos deixam DUAS arestas e a
contagem diz 2 — não há unique implícito no par (in, out). A saída é o id
determinístico:

\`\`\`surql
RELATE thing:t1->labeled:['t1','bug']->label:bug;
\`\`\`

Dois desses deixam UMA aresta. Dedup na criação, que é a regra da casa.

## As regras moram no BANCO

Cada uma dispensa código de cliente que todo mundo escreve. Medidas:

\`\`\`surql
DEFINE TABLE label SCHEMAFULL;
DEFINE FIELD means ON label TYPE string ASSERT string::len($value) > 0;
DEFINE TABLE labeled TYPE RELATION IN thing OUT label;
DEFINE FIELD at ON labeled TYPE datetime DEFAULT time::now();
\`\`\`

- **\`ASSERT\`** recusa na escrita, com mensagem útil: *"Found '' for field \`means\`,
  with record \`label:x\`, but field must conform to…"*. Validação no cliente vira
  redundância.
- **\`SCHEMAFULL\`** recusa campo que ninguém declarou: *"Found field 'cor', but no
  such field exists"*. O typo vira erro em vez de coluna nova.
- **\`DEFAULT time::now()\`** preencheu \`at\` sem o cliente mandar nada.
- **\`TYPE RELATION IN x OUT y\`** amarra as pontas da aresta.

## \`DEFINE EVENT\`: o gatilho que faz outbox

\`\`\`surql
DEFINE EVENT lab ON TABLE labeled WHEN $event = "CREATE" THEN
  (CREATE outbox SET kind='labeled', subject=$after.in, label=$after.out);
\`\`\`

Medido: o \`RELATE\` disparou e o outbox tem a linha. \`$event\` é
CREATE/UPDATE/DELETE, e \`$before\`/\`$after\` são o registro.

É o pub/sub DURÁVEL — para quem não estava conectado na hora.

## \`LIVE\`: push pra quem está conectado

\`\`\`ts
const sub = await db.live(new Table("labeled"));
sub.subscribe(m => …);   // m = { action, recordId, value }
\`\`\`

Pega CREATE e DELETE na tabela de aresta, medido.

**O \`.where()\` COM STRING É IGNORADO EM SILÊNCIO** — a pior de todas:

\`\`\`ts
.where("out = label:bug")                            // ← recebe TUDO
.where(surql\`out = \${new RecordId("label","bug")}\`)  // ← filtra
\`\`\`

A primeira forma não estoura, não avisa, e entrega todo evento da tabela pro
assinante que achou que tinha filtrado. Num pub/sub, é cada consumidor reagindo a
tudo.

E \`db.live("labeled")\` com string também falha — \`Cannot execute LIVE statement
using value\`. Precisa de \`new Table(nome)\`.

## Busca full-text

\`\`\`surql
DEFINE ANALYZER pt TOKENIZERS blank,class FILTERS lowercase,ascii,snowball(portuguese);
DEFINE INDEX thing_ft ON thing FIELDS title FULLTEXT ANALYZER pt BM25;
SELECT * FROM thing WHERE title @@ 'parser';
\`\`\`

**\`SEARCH\` VIROU \`FULLTEXT\` na 3.x** — \`DEFINE INDEX … SEARCH\` é parse error, e a
mensagem (\`Unexpected token, expected Eof\`) não diz qual palavra ele não gostou.
Quatro tentativas.

O que o analyzer compra, medido: \`estourar\` acha "o parser ESTOURA em arquivo
vazio" (snowball), e \`arquivos\` acha \`arquivo\` (ascii). Sem os dois filtros, a
busca é \`LIKE\` com outro nome.

**\`search::score()\` DEVOLVEU 0** com a linha casando. Não sei se é o índice, a
query ou o \`@1@\` — fica registrado como NÃO MEDIDO, e ranking que ninguém mediu
não vira contrato.

## Tipos que evitam código

\`record<t>\` (link), \`datetime\`, \`duration\`, \`set<t>\` (único, sem ordem) contra
\`array<t>\`, \`decimal\` (sem erro de ponto flutuante), \`geometry\`. Guardar datetime
como string é o caminho pra comparar data com \`<\` de texto.

## Detalhe de display

Record id com ponto sai envolto: \`pref:⟨tasks.project⟩\`. É display, não corrupção
— \`type::record("pref", "tasks.project")\` continua achando.

## References

- @../../../../my/apps/my_cli/src/home/db.ts — a conexão, o schema e o \`--sql\`
- @../../../../my/packages/interfaces/labels.ts — o contrato que usa aresta e LIVE
`,
});
