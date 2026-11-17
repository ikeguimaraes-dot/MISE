# Cadastro de empresas e unidades

Administradores acessam **Cadastro → Empresas** e **Cadastro → Unidades da empresa**, também disponíveis no menu Gestão.

1. Cadastrar a empresa com nome fantasia, razão social, CNPJ e endereço completo.
2. Cadastrar cada unidade escolhendo a empresa à qual pertence e informando os dados próprios da unidade.
3. Para as unidades já existentes, usar **Editar** e completar os dados e o vínculo com a empresa. Não criar outra unidade para representar o mesmo local.

Os formulários incluem inscrição estadual, inscrição municipal, CNAE principal, CEP, logradouro, número, complemento, bairro, cidade, UF, telefone/WhatsApp, e-mail, site, responsável pelo contato e observações. Nome, razão social, CNPJ e os campos principais de endereço são obrigatórios. A empresa também é obrigatória para uma unidade.

O CNPJ é normalizado e tem os dígitos verificadores conferidos, aceitando as formas numérica e alfanumérica. Isso valida o número digitado; o cadastro não consulta a situação cadastral na Receita nem preenche dados fiscais por consulta externa. Referência do algoritmo: [manual oficial de dígitos verificadores da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).

## Persistência e operação

- `mise.companies`: dados completos da empresa, CNPJ único, RLS ativa e acesso direto negado a `anon` e `authenticated`. O backend usa `service_role` após validar a sessão de administrador. O aviso informativo de RLS sem políticas é intencional: o acesso dos clientes é negado por padrão.
- `public.units`: registro operacional existente, com `company_id` referenciando `mise.companies` e colunas adicionais para os dados cadastrais. A migração não altera IDs nem vínculos existentes; as unidades legadas começam sem empresa vinculada.
- A gravação de unidade atualiza `name`, `cnpj`, `address`, `whatsapp_number` e `active`, consumidos pelos módulos atuais. Campos de marca, geolocalização e treinamento permanecem fora do payload do cadastro.
- As unidades vinculadas têm índice único de CNPJ. A API também verifica duplicidades contra unidades legadas com CNPJ pontuado ou normalizado.
- Cadastro/edição usam `POST /api/empresas`, `PATCH /api/empresas/[id]`, `POST /api/unidades` e `PATCH /api/unidades/[id]`. A API permite apenas campos conhecidos e exige administrador independentemente da navegação.
- Empresas e unidades podem ser inativadas pelo formulário. Inativar a empresa não inativa automaticamente suas unidades. Inativar uma unidade a remove dos seletores operacionais que já filtram `active = true`.
- Não há exclusão definitiva no novo fluxo. O banco impede remover uma empresa enquanto houver unidades vinculadas.

Migração: `supabase/migrations/20261113144754_company_unit_registration.sql`. Essa migração deve ser aplicada em cada banco usado pelas instalações do MISE antes de usar o cadastro. Publicar o código na Vercel não aplica a migração no Supabase.

## Verificação

`node --test tests/business-registration.test.mjs tests/shelf-life.test.mjs` e `npx tsc --noEmit --incremental false`.

Testes de CNPJ, validação, autorização, duplicidade, criação, edição e carregamento de formulário. Na validação original da implementação, a estrutura real foi verificada com inserção e vínculo em transação desfeita por `ROLLBACK`, confirmando a preservação das 12 unidades anteriores e a ausência de registros de teste persistidos.


## Aplicação no Maza — 17/11/2026

A instalação em `mise-opal-nu.vercel.app` usa o projeto Supabase `maza` (`dncqjezvndoxeqpklefy`). O erro de servidor ao abrir Empresas e Unidades ocorria porque esse banco ainda não tinha `mise.companies` nem as colunas adicionais de `public.units` esperadas pelo código.

Foi aplicada a migração já versionada `20261113144754_company_unit_registration.sql`, em transação, e registrada a versão `20261113144754` em `supabase_migrations.schema_migrations`. As duas unidades existentes foram preservadas, com os mesmos IDs e status; nenhuma empresa ou unidade de teste foi criada. As unidades legadas continuam sem empresa vinculada até que um administrador complete o cadastro.

Verificações concluídas:

- Tabela `mise.companies`, vínculo `public.units.company_id` e campos cadastrais disponíveis.
- RLS habilitada e permissões da tabela de empresas limitadas ao backend (`service_role`), sem acesso direto de `anon` ou `authenticated`.
- Leitura autenticada em produção das listas de empresas e unidades, dos dois formulários de criação e da edição das duas unidades existentes: seis páginas retornaram HTTP 200 e renderizaram o conteúdo esperado.
- Sete testes de `tests/business-registration.test.mjs` passaram; nenhum erro nos logs da janela de verificação após a correção.

A correção foi feita no banco Maza, usando a migração existente; não exigiu alteração do código da aplicação ou novo deploy. Antes de reaplicar a migração, consulte o histórico para evitar recriar tabelas, colunas e índices já existentes:

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20261113144754';

select to_regclass('mise.companies') as companies_table;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'units'
  and column_name = 'company_id';
```
