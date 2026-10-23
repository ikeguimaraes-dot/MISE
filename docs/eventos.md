# Eventos no MISE

Aplicação importada de `https://github.com/grupomeeteat-lang/hos-oseventos.git`,
commit `2fbdf0e5a8b37a74991f69ea21f322ccdbf01ac1`, na pasta `eventos/`.
O código está incorporado ao repositório do MISE, sem submódulo Git.

## Acesso integrado

O menu e o cartão inicial abrem `/eventos`. A página e `/api/eventos/app`
exigem sessão do MISE. O HTML consulta `/api/eventos/session` e abre diretamente
o dashboard, usando o nome e o nível da pessoa autenticada no MISE, inclusive
para sessões de PIN. Não há segundo login nem dependência de conta em Eventos.

As leituras e alterações de O.S. passam por `/api/eventos/data`. Cada requisição
valida novamente a sessão e as permissões no servidor:

- Administrador: consultar, criar, editar e excluir O.S.
- Gerente: consultar, criar e editar O.S.
- Cozinheiro/equipe operacional: consultar e imprimir.

A API acessa somente a tabela `eventos`, aceita filtros limitados e exige o ID
para editar/excluir. A autoria de novas O.S. vem da sessão, não do navegador.
Usuários e acessos são administrados no MISE. O atalho “Equipe no MISE” leva ao
cadastro existente. Contas e senhas antigas do sistema independente não foram
alteradas. A rota administrativa legada `/api/eventos/admin` permanece restrita
à dupla autorização anterior, mas não participa mais da interface integrada.

## Configuração

Preserve as variáveis existentes do banco do MISE. Configure também no servidor
(localmente em `.env.local` e no ambiente de implantação):

```dotenv
EVENTOS_SUPABASE_SERVICE_ROLE_KEY=<chave de serviço do projeto de eventos>
```

A chave nunca deve usar prefixo `NEXT_PUBLIC_`. Agora ela é necessária para todas
as consultas de Eventos. O servidor acessa o projeto `rpavxnjchfmeiacnumpk`;
nenhuma tabela foi migrada ou alterada. O navegador não recebe a chave nem um
token de autenticação do sistema antigo. Respostas de sessão e dados não são
armazenadas em cache.

O HTML é incluído no pacote do servidor via `outputFileTracingIncludes`.
Não copie a pasta `eventos` para `public`: o acesso deve passar pela sessão.

## Casas e ambientes

O formulário oferece Meet, Match, Madonna e Frêneze, com ambientes dependentes
da casa. Caixas de seleção permitem combinar espaços na mesma O.S. O cabeçalho
mostra a casa acima de todos os espaços selecionados. Os ambientes são gravados
separados por quebras de linha. O campo usa a coluna existente `espacos`, sem migração de banco.
Textos de espaços de O.S. antigas são preservados ao editar. O dashboard permite
filtrar a consulta e os indicadores por casa, com opção de todas as casas.

## Histórico e validação

A senha fixa foi removida de `setup-master.js`; o script de manutenção usa
`EVENTOS_MASTER_PASSWORD` e não é executado pela integração. `eventos/CLAUDE.md`
descreve o estado legado, anterior à integração.

O repositório original continha uma chave de serviço exposta. A necessidade de
rotacioná-la e atualizar os ambientes que a utilizam continua registrada. As
políticas de dados legadas não foram alteradas por esta integração.

```sh
node --test tests/eventos*.test.mjs
npx tsc --noEmit
npm run build
```

Validar no navegador: entrar no MISE, abrir Eventos sem novo login, conferir
listagem, filtro de casas, criação/edição conforme o perfil e impressão.
Sessão expirada deve impedir novas consultas e pedir a entrada no MISE.
