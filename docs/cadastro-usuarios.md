# Cadastro de usuários pelo MISE

Administradores podem abrir **Cadastros → Funcionários → Cadastrar novo usuário** e informar nome, sobrenome opcional, e-mail, senha inicial, unidade e cargo. A unidade e o cargo são carregados do banco da instalação, sem IDs fixos no código. A senha deve ter pelo menos seis caracteres e atender às demais regras do Supabase do projeto.

O cadastro cria a conta no Supabase Auth, confirma o e-mail administrativamente e vincula o funcionário em `public.employees`, com acesso ao MISE ativo e o cargo selecionado. Não envia e-mail. A senha é enviada somente ao Auth e não é gravada no cadastro do funcionário nem retornada pela API. O cargo `founder` aparece como **Administrador master**. A interpretação de cargos existente no MISE permanece: `founder` ou permissão `*` dá acesso de administrador; os demais cargos de login por e-mail dão acesso de gerente. Os cargos disponíveis são os que já existem em `public.roles` no banco da instalação.

Somente administradores podem criar contas ou ativar/desativar acesso. Gerentes continuam consultando a lista, sem controles de alteração. A API valida a sessão e o cargo do operador, a unidade ativa e o cargo escolhido antes de criar a conta. Um e-mail duplicado é rejeitado. Se o funcionário não puder ser salvo, o cadastro no Auth é desfeito; uma falha nessa compensação dispara bloqueio do login órfão e um registro para revisão operacional.

A desativação em Funcionários passa a ser conferida nas sessões por e-mail e PIN e em novas tentativas de login por PIN. O operador não pode desativar o próprio acesso. O PATCH de funcionário aceita somente `mise_ativo`, impedindo alterações arbitrárias de cargo ou vínculo de login nesse endpoint.

Validação: `node --test tests/employee-accounts.test.mjs`, suites de regressão de identidade/cadastros/sessão, `npx tsc --noEmit --incremental false` e leitura autenticada da tela local conectada ao Maza. Nenhum cadastro temporário foi criado no banco de produção para os testes; criação/compensação e bloqueio de perfis são cobertos por testes simulados.
