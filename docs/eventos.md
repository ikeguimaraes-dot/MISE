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

## Nomes e total na interface

`custo_evento` aparece como **Custo A&B** e `valor_cobrado` como **Locação**.
Os campos existentes são preservados, inclusive os valores já cadastrados.
A coluna **Total** soma Custo A&B + Locação em centavos; o mesmo total aparece
no formulário e na consulta/impressão. Não é um campo editável ou persistido.
Se apenas um valor foi informado, o outro contribui zero; se ambos estão vazios,
o total mostra “Não informado”.

## Edição e versões

A edição usa um alvo explícito e PATCH por ID, sem fallback para criação se a
identidade estiver ausente. POST com ID existente é rejeitado. O formulário
bloqueia envios simultâneos; o HTML legado também bloqueia novo envio depois do
sucesso (antes ele limpava o ID e aguardava 1,2 segundo para sair do formulário).

A coluna `versao` inicia em 1. Um trigger incrementa atomicamente a versão em
cada alteração operacional, mantendo o ID e o registro. Alterações financeiras não incrementam a versão. A interface mostra V1/V2/V3 após Status,
na consulta e edição. A API compara a versão carregada antes de atualizar:
edições concorrentes desatualizadas recebem erro 409 e devem reabrir a OS.
As OS anteriores começam em V1, sem inferir um histórico que não foi registrado.
A migração `20261030123718_eventos_versao.sql` foi aplicada ao banco de Eventos.
O trigger foi testado em tabela temporária: duas edições mantiveram um registro
com o mesmo ID e versão 3, sem alterar OS reais.


## Financeiro independente

A seção Valores do evento fica depois do botão Salvar O.S., em um formulário
separado com Salvar valores. O primeiro cadastro mantém a tela aberta e habilita
os campos financeiros depois de obter o ID da OS. Salvar O.S. envia somente os
dados operacionais; Salvar valores envia somente os campos financeiros, incluindo
comprovantes, por PATCH com `section=financeiro`. Alterações ainda não salvas no
outro formulário permanecem na tela.

- Forma de pagamento: Via Financeiro Adm / Via Caixa Restaurante (coluna legada
  `situacao_pagamento`, preservada).
- Situação do pagamento: Pago / A pagar (`pagamento_status`).
- Meio de pagamento: Cartão / Pix / Boleto (`pagamento_meio`).

O trigger compara os campos operacionais e ignora valores, os três campos de
pagamento, comprovantes e `updated_at` para calcular a versão. Mesmo uma chamada
legada que altere apenas o financeiro preserva a versão. Salvar sem mudança
operacional também mantém a versão. Campos novos de OS antigas ficam sem
preenchimento, sem inferir se o pagamento já ocorreu.

Migração aplicada: `20261030125031_eventos_financeiro_independente.sql` no banco
de Eventos. Validação: 30 testes, build e teste em tabela temporária no banco;
prévia de navegador confirmou cadastro V1, salvamento financeiro V1, edição
operacional V2 e novo salvamento financeiro mantendo V2.

## Pagamento parcial

Situação do pagamento oferece também **Pagamento parcial**. Ao selecionar essa
opção, o formulário exibe **Valor pago parcial (R$)**, obrigatório e maior que zero.
O valor representa o total acumulado já pago e aceita centavos. Fica armazenado
em `valor_pago_parcial`, pertence apenas ao financeiro e não aumenta a versão.
Se a situação mudar depois, o valor já registrado é preservado e continua visível.
Migração aplicada: `20261030125903_eventos_pagamento_parcial.sql`.
Validação: testes de parsing, separação dos formulários e validação da API;
uma tabela temporária confirmou que atualizar o parcial de R$ 1.250,50 para
R$ 1.500,75 manteve V1, sem alterar registros reais.

## Documento / contrato

A seção Documento permite anexar contratos depois do primeiro salvamento da OS.
O envio é imediato e independente dos formulários operacional e financeiro.
Contratos ficam listados com nome, tamanho e link Ver contrato (abre em nova aba),
inclusive no modo de consulta. PDF, JPG e PNG são aceitos, até 3 MB por arquivo.
Novos envios recebem nomes únicos e não sobrescrevem contratos anteriores.

A API `/api/eventos/documento` exige sessão MISE e existência da OS. Administrador
e gerente podem enviar; operação pode consultar. O servidor valida origem, tipo,
assinatura inicial e tamanho do arquivo. Nenhuma chave de serviço vai ao navegador.
O bucket `mise-eventos-documentos` é privado, sem políticas de acesso direto para
anon/authenticated. A consulta passa pela sessão e gera link assinado de 60 segundos.
Os documentos não são armazenados na tabela pública de eventos e não incrementam
a versão operacional. Migração: `20261030130336_eventos_documentos_privados.sql`.

Validação: 36 testes de Eventos e build aprovados; PDF sintético enviado, lido por
URL assinada, acesso público bloqueado e arquivo sintético removido ao concluir.

## Extras e posição do salvamento

Salvar O.S. fica depois de Documento. Valores do evento inclui um valor de extras,
com pagamento integral, parcial ou não pago, valor parcial, meio, local e detalhes.
O total da listagem, consulta e impressão soma A&B + Locação + Extras.
Os seis campos `extras_*` são exclusivos do financeiro e não incrementam a versão.
Pagamento parcial exige valor maior que zero e menor que o valor dos extras.
Migração aplicada ao projeto de Eventos: `20261030194858_eventos_extras.sql`.
Validação: 38 testes, TypeScript, build Webpack e teste de persistência/versão em
uma tabela temporária, sem modificar OS reais.

Consultas de Eventos repetem uma vez em caso de falha de rede no envio ou na
leitura da resposta. Escritas não repetem automaticamente para evitar duplicação;
a mensagem orienta conferir o registro antes de reenviar. Erros da API, incluindo
sessão expirada, preservam a mensagem e não são repetidos. Validação: 41 testes.

## Diagramação da impressão

A impressão da OS usa `event-print.tsx`, uma composição própria para A4 com
margens de 10/11 mm, fontes de 9 pt, resumo no topo e seções compactas. O formulário
interativo fica oculto no papel. Dados financeiros e comprovantes nunca são
incluídos nessa composição. Campos e seções operacionais sem conteúdo são omitidos;
zero continua sendo um valor válido, inclusive para convidados e quantidades.

Brigada usa três pares de função/Qtd. por linha, com cabeçalho único. Menus usam
tabelas com categoria/serviço, horário e descrição/observações, repetindo o
cabeçalho entre páginas. Textos completos e informações gerais são preservados.
As seções podem continuar na página seguinte; a prevenção de quebra fica nos
itens e títulos, em vez de empurrar seções inteiras. Os nomes dos contratos e
anexos são incluídos quando há arquivos, reutilizando a consulta já existente.

Validação: prévia visual em largura A4, 45 testes de Eventos, TypeScript e build.

## Campos obrigatórios do evento

Todos os campos de Dados do evento, exceto Tema, são obrigatórios no formulário
para criar ou salvar a OS. Campos obrigatórios têm asterisco e usam validação
nativa do navegador; a validação compartilhada também rejeita textos só com
espaços e quantidades inválidas. Zero é uma quantidade informada válida.
A API exige todos esses dados no cadastro e rejeita apagar um campo obrigatório
em edições parciais. O salvamento financeiro continua independente.
Validação: 48 testes de Eventos, TypeScript e build.
