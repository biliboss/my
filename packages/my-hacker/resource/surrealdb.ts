//! O que esta casa mediu do SurrealDB em 20/08, subindo um standalone com rocksdb e
//! ligando o CLI nele. Nada aqui foi lido em documentação: cada linha custou um erro.

import { resource } from "../resource.ts";

export const surrealdb = resource({
	name: "surrealdb",
	lens: "hacker",
	answers: "subir SurrealDB standalone com rocksdb, e as cinco pegadinhas da 3.x",
	at: "2026-08-20",
	context: `# surrealdb standalone, rocksdb

Medido em 20/08 contra o servidor 3.2.3 e o SDK JS 2.0.8, no macOS aarch64.

## Subir

    surreal start rocksdb:~/.me/surreal/me.db --user root --pass root --bind 127.0.0.1:8000

Sobe em ~4s e responde \`GET /health\` com 200. \`/health\` é a sonda certa: a
pergunta é sobre o PROCESSO, e abrir websocket pra descobrir que não tem ninguém
custa o timeout inteiro.

Conectar + autenticar + escolher namespace pelo SDK: **20ms**. Um UPSERT seguido de
um SELECT: **5ms**. HTTP e WebSocket mediram o mesmo tempo de conexão.

## As cinco pegadinhas, em ordem de quanto custaram

**1. \`value\` É PALAVRA RESERVADA.** \`SELECT value FROM pref:x\` sai como
\`Parse error: Unexpected token, expected FROM\` — que parece erro de sintaxe de
record id e não é. Custou três diagnósticos errados. \`SELECT * FROM pref:x\`
funciona, e o campo em crase (\\\`value\\\`) também.

**2. \`type::thing\` VIROU \`type::record\`.** O parser reconhece o nome velho só o
bastante pra sugerir o novo (\`did you maybe mean type::record\`), mas falha. Vale
pra todo record id montado por variável:

    UPSERT type::record("pref", $k) SET value = $v

**3. TABELA INEXISTENTE É ERRO, NÃO VAZIO.** \`SELECT\` numa tabela que ninguém
definiu estoura com \`The table 'pref' does not exist\`. Não existe o
\`CREATE TABLE IF NOT EXISTS\` implícito do SQLite — quem vem de lá espera lista
vazia e recebe exceção. A resposta é rodar os \`DEFINE TABLE IF NOT EXISTS\` na
conexão, que é o que substitui a migração.

**4. O SDK DO NPM É 2.x, E ISSO NÃO É ATRASO.** \`npm view surrealdb dist-tags\`
diz \`latest: 2.0.8\`; não existe 3.x publicado. O 2.0.8 fala com o servidor 3.2.3
sem adaptador. Numeração de SDK e de servidor não andam juntas nesta base — não
espere a 3.x do npm, ela não vem.

**5. O SOCKET SEGURA O PROCESSO.** Aberta a conexão, o loop do Bun não esvazia:
um \`my tasks list\` imprimia a lista e FICAVA — 120s de timeout num comando de
300ms. Vale pra HTTP também, não só WebSocket. Fechar explicitamente no fim do
comando resolve; \`process.exit()\` NÃO, porque com stdout num pipe ele mata antes
do flush.

## Upgrade

\`brew upgrade surreal\` recusa com \`Refusing to load formula from untrusted tap\`.
A saída estreita é confiar a FÓRMULA, não a tap inteira:

    brew trust --formula surrealdb/tap/surreal

Dado escrito pela 3.0.1 foi lido inteiro pela 3.2.3 — o formato do rocksdb
atravessou o upgrade sem migração.

A tap oficial fica um patch atrás do GitHub: 3.2.3 contra 3.2.4 em 20/08.

## Id com caractere fora do comum

Um record id com ponto sai envolto: \`pref:⟨tasks.project⟩\`. É display, não
corrupção — \`type::record("pref", "tasks.project")\` continua achando.

## root/root, e quando isso deixa de servir

Com \`--bind 127.0.0.1\`, só quem já está na máquina alcança a porta — e quem está
na máquina lê o arquivo do rocksdb direto com o próprio \`surreal\`, sem passar por
autenticação. Senha gerada e guardada ao lado do arquivo que ela protege é
cerimônia: protegeria contra um atacante que abre socket local mas não abre arquivo
local, e ele não existe.

Isso MUDA no dia em que o bind sair do loopback. Aí a senha vale.`,
});
