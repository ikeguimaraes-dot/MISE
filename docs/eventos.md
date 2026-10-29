# Eventos no MISE

Aplicação importada de `https://github.com/grupomeeteat-lang/hos-oseventos.git`,
commit `2fbdf0e5a8b37a74991f69ea21f322ccdbf01ac1`, na pasta `eventos/`.
O código está incorporado ao repositório do MISE, sem submódulo Git.

## Interface nativa

O menu e o cartão inicial abrem `/eventos`, renderizado em React dentro do layout
MISE, sem iframe, segundo menu ou login separado. A listagem reúne busca, filtros
por casa/status, indicadores, consulta, criação, edição, exclusão e impressão.
Os formulários preservam ambientes antigos, brigada, menus e anexos.

O menu Eventos expande quatro submenus nativos: Dashboard (`/eventos/dashboard`),
Eventos (`/eventos/lista`), Nova O.S. (`/eventos/nova`) e Equipe no MISE
(`/eventos/equipe`). Dashboard apresenta indicadores e os oito eventos mais recentes;
a lista apresenta todas as OS. Nova O.S. e Equipe exigem perfil gestor também
no servidor. A equipe reutiliza o cadastro do MISE dentro da navegação de Eventos.

As leituras e alterações de O.S. passam por `/api/eventos/data`, com sessão e
permissões verificadas no servidor: administrador pode consultar/criar/editar/excluir;
gerente pode consultar/criar/editar; cozinheiro pode consultar e imprimir.
A autoria é definida pela sessão. As rotas HTML e de sessão legadas permanecem
por compatibilidade, mas não são carregadas pela página nativa.

## Valores financeiros

Cada O.S. tem `custo_evento` e `valor_cobrado`, ambos `numeric(12,2)` opcionais,
em reais. Estão disponíveis no cadastro, edição, consulta, impressão e em duas
colunas da listagem. Ausência aparece como “Não informado”; zero é R$ 0,00.
O formulário aceita valores brasileiros, por exemplo `1.250,50`. A API e o banco
rejeitam valores negativos; a API rejeita mais de duas casas decimais.

A migração está em `eventos/supabase/migrations/20261029190936_eventos_valores.sql`
e foi aplicada ao projeto de **Eventos** `rpavxnjchfmeiacnumpk`. Não aplicar essa
migração ao projeto principal do MISE. Registros existentes não foram alterados.

## Configuração

Preserve as variáveis existentes do banco do MISE. Configure também no servidor
(localmente em `.env.local` e no ambiente de implantação):

```dotenv
EVENTOS_SUPABASE_SERVICE_ROLE_KEY=<chave de serviço do projeto de eventos>
```

A chave nunca deve usar prefixo `NEXT_PUBLIC_`. Agora ela é necessária para todas
as consultas de Eventos. O servidor acessa o projeto `rpavxnjchfmeiacnumpk`;
os registros continuam no banco de Eventos, com as duas novas colunas financeiras. O navegador não recebe a chave nem um
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

## Verificação desta alteração

- 21 testes de Eventos aprovados; TypeScript e build com Webpack aprovados.
- Prévia isolada no navegador: edição, salvamento, reabertura e colunas monetárias,
  incluindo custo zero e preservação das informações gerais do menu.
- Consulta ao banco confirmou 58 OS e ambas as novas colunas sem valores iniciais.
- Teste de escrita em registro real foi bloqueado pela revisão automática e não
  executado; a validação de escrita utilizou API simulada e testes unitários.
- Advisor apontou condição preexistente: `public.eventos` sem RLS. A integração
  MISE valida acesso no servidor, mas isso não protege acesso direto ao banco.
  Revisar as integrações legadas e habilitar RLS antes de inserir dados financeiros
  confidenciais. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
