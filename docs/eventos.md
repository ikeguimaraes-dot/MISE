# Eventos no MISE

Aplicação importada de `https://github.com/grupomeeteat-lang/hos-oseventos.git`,
commit `2fbdf0e5a8b37a74991f69ea21f322ccdbf01ac1`, na pasta `eventos/`.
O código está incorporado ao repositório do MISE, sem depender de submódulo Git.

O menu e o cartão da página inicial abrem `/eventos`. A página exige sessão do
MISE e incorpora o HTML servido pela rota autenticada `/api/eventos/app`.
O login do sistema de eventos é independente e continua usando as contas do
projeto Supabase `rpavxnjchfmeiacnumpk`. Nenhuma tabela foi migrada ou alterada.

## Configuração

Preserve as variáveis existentes do banco do MISE. O HTML já utiliza a URL e a
chave pública do projeto de eventos. Para administrar usuários, configure no
servidor (localmente em `.env.local` e também no ambiente de implantação):

```dotenv
EVENTOS_SUPABASE_SERVICE_ROLE_KEY=<chave de serviço do projeto de eventos>
```

A chave nunca deve usar prefixo `NEXT_PUBLIC_`. As chamadas administrativas
passam por `/api/eventos/admin`, que exige administrador do MISE, token válido
do Supabase de eventos e perfil `admin` ou `master` em Eventos. A rota permite
somente criação, consulta, alteração de senha e exclusão de usuários, com
campos limitados e bloqueio de exclusão do próprio usuário e do perfil master.

O arquivo HTML é incluído no pacote do servidor via `outputFileTracingIncludes`.
Não copie a pasta `eventos` para `public`: o acesso ao HTML deve continuar
passando pela verificação de sessão.

## Diferenças em relação ao original

- Chave de serviço removida do HTML; operações privilegiadas passam pelo servidor.
- Senha fixa removida de `setup-master.js`; o script de manutenção usa
  `EVENTOS_MASTER_PASSWORD` e não é executado pela integração.
- O documento legado `eventos/CLAUDE.md` descreve o estado anterior à integração.
  As referências a uma chave de serviço no frontend não se aplicam ao MISE.

O repositório original continha uma chave de serviço exposta. É necessário
rotacioná-la no Supabase e atualizar os ambientes que a utilizam. As políticas
de dados legadas não foram alteradas; o controle de sessão do MISE não substitui
as políticas RLS do banco de eventos.

## Validação

```sh
npx tsc --noEmit
node --test tests/eventos.test.mjs
npm run build
```

Para validar o fluxo completo, entrar no MISE, abrir Eventos e autenticar com
uma conta existente de Eventos. Conferir listagem, formulário, impressão e,
para administradores dos dois sistemas, gerenciamento de usuários.
