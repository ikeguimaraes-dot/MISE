# MISE Backoffice — Guia Completo para Claude Code

> **Leia este arquivo inteiro antes de fazer qualquer coisa.** Contém tudo que você precisa para trabalhar neste projeto sem perguntar nada.

---

## 1. CONTEXTO DE NEGÓCIO

**MISE** é um sistema de gestão de cozinha profissional para o grupo **KPH Participações**, fundado por **Ike (Henrique Roisin Guimarães)**. Opera restaurantes em Porto Alegre/RS:

| Unidade | Status |
|---------|--------|
| Meet & Eat | Ativa |
| Madonna Cucina | Ativa |
| Match Point | Ativa |
| KLAUSS | Em desenvolvimento |

**Problema resolvido:** O software atual (Suflex) não tem CMV, não controla peso, não funciona para múltiplas unidades e tem UX ruim.

### Dois produtos
| Produto | Plataforma | Usuários | Status |
|---------|-----------|---------|--------|
| **MISE Backoffice** (este repo) | Web (Next.js) | Gestores e donos | Em desenvolvimento |
| **MISE Kitchen** (futuro) | App mobile/tablet | Cozinheiros | Não iniciado |

### Módulos implementados (resumo rápido)

| Módulo | Rota | Status |
|--------|------|--------|
| Etiquetas | `/etiquetas` | ✅ 100% funcional |
| Validades | `/validades` | ✅ 100% funcional |
| Cadastros — Produtos | `/cadastros/produtos` | ✅ 100% funcional |
| Cadastros — Grupos | `/cadastros/grupos` | ✅ 100% funcional |
| Cadastros — Funcionários | `/cadastros/funcionarios` | ✅ 100% funcional |
| Configurações — Pontos de Impressão | `/configuracoes/pontos-impressao` | ✅ 100% funcional |
| Configurações — PINs de Acesso | `/configuracoes/pins` | ✅ 100% funcional |
| PIN Login | `/pin-login` | ✅ 100% funcional |
| Níveis de Acesso (auth) | middleware + layout + sidebar | ✅ 100% funcional |
| Relatório de Produção | `/relatorios` | ✅ 100% funcional |
| Dashboard | `/` | ✅ 100% funcional |
| Produção | `/producao` | ⏳ Stub |
| Recebimento | `/recebimento` | ⏳ Stub |
| Inventário | `/inventario` | ⏳ Stub |

---

## 2. STACK TÉCNICA

### Dependências de produção

| Pacote | Versão | Uso |
|--------|--------|-----|
| `next` | 16.2.6 | Framework — App Router |
| `react` | 19.2.4 | UI |
| `react-dom` | 19.2.4 | Renderização |
| `@supabase/supabase-js` | ^2.105.3 | Cliente Supabase (queries, auth) |
| `@supabase/ssr` | ^0.10.3 | Supabase SSR/cookies para Next.js |
| `qrcode.react` | ^4.2.0 | QR Code — exports: `QRCodeCanvas`, `QRCodeSVG` |
| `lucide-react` | ^1.14.0 | Ícones |
| `tailwind-merge` | ^3.5.0 | Merge de classes via `cn()` |
| `clsx` | ^2.1.1 | Classes condicionais via `cn()` |
| `class-variance-authority` | ^0.7.1 | Variantes shadcn/ui |
| `@base-ui/react` | ^1.4.1 | Primitivas acessíveis (instalado, pouco usado) |
| `tw-animate-css` | ^1.4.0 | Animações Tailwind |
| `bcryptjs` | ^2.4.3 | Hash de PINs |

### Dependências de desenvolvimento

| Pacote | Versão |
|--------|--------|
| `typescript` | ^5 |
| `tailwindcss` | ^4 |
| `@tailwindcss/postcss` | ^4 |
| `eslint` | ^9 |
| `eslint-config-next` | 16.2.6 |
| `@types/node` | ^20 |
| `@types/react` | ^19 |
| `@types/react-dom` | ^19 |
| `@types/bcryptjs` | ^2.4.6 |

### Design
- **Fontes**: Geist Sans + Geist Mono (via `next/font/google`)
- **Tema**: Dark — `neutral-950` background, `neutral-900` cards, `neutral-800` borders, texto branco
- **Componentes shadcn instalados**: apenas `button.tsx` — o resto é Tailwind puro
- **Ícones**: Lucide React

---

## 3. VARIÁVEIS DE AMBIENTE

Arquivo: `.env.local` na raiz do projeto. **Nunca commitar este arquivo.**

```env
NEXT_PUBLIC_SUPABASE_URL=https://iqgrvptrtphvbmvrqntm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Variável | Prefixo `NEXT_PUBLIC_` | Onde buscar | Para que serve |
|----------|------------------------|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim (exposta ao browser) | Supabase Dashboard → Settings → API → Project URL | URL base de todas as queries |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim (exposta ao browser) | Supabase Dashboard → Settings → API → `anon` public | Auth no browser, Client Components |
| `SUPABASE_SERVICE_ROLE_KEY` | **Não** (server-only) | Supabase Dashboard → Settings → API → `service_role` secret | Queries de dados em Server Components — bypassa RLS e tem acesso ao schema `mise` |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` é crítica.** Sem ela, todas as queries ao schema `mise` retornam `permission denied for schema mise` mesmo com a key correta. A anon key não tem GRANT de USAGE no schema `mise`. Após adicionar ou alterar `.env.local`, **reiniciar o servidor** (`Ctrl+C` → `npm run dev`) é obrigatório — Next.js lê env vars apenas na inicialização.

---

## 4. PRÉ-REQUISITOS NO SUPABASE

Dois passos obrigatórios antes do app funcionar. Sem eles, queries ao schema `mise` retornam vazio ou erro.

### 4.1 Expor o schema `mise` no PostgREST

**Via Dashboard:** Settings → API → Exposed schemas → adicionar `mise` à lista (junto com `public`).

**Via SQL (alternativa):**
```sql
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,mise';
NOTIFY pgrst, 'reload config';
```

### 4.2 Conceder permissões PostgreSQL ao schema `mise`

Rodar no **Supabase Dashboard → SQL Editor**:

```sql
-- service_role: acesso total (usado pelos Server Components do backoffice)
GRANT USAGE ON SCHEMA mise TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA mise TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mise TO service_role;

-- authenticated: usuários logados (para uso futuro em prod)
GRANT USAGE ON SCHEMA mise TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mise TO authenticated;

-- anon: leitura pública (para uso futuro no MISE Kitchen)
GRANT USAGE ON SCHEMA mise TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA mise TO anon;

-- Garantir permissões em tabelas criadas no futuro dentro do schema mise
ALTER DEFAULT PRIVILEGES IN SCHEMA mise GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mise GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mise GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA mise GRANT SELECT ON TABLES TO anon;
```

### 4.3 Migrations rodadas em produção

```sql
-- Adicionadas em public.units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS address TEXT;

-- mise.print_points criada via migration-print-points.sql
-- ⚠️ A coluna foi criada como 'nome' e depois renomeada:
ALTER TABLE mise.print_points RENAME COLUMN nome TO name;
-- Coluna definitiva confirmada: 'name' (inglês)

-- mise.labels — colunas adicionadas
ALTER TABLE mise.labels ADD COLUMN IF NOT EXISTS print_point_id uuid REFERENCES mise.print_points(id);
ALTER TABLE mise.labels ADD COLUMN IF NOT EXISTS setor text;
ALTER TABLE mise.labels ADD COLUMN IF NOT EXISTS selo text;
ALTER TABLE mise.labels ADD COLUMN IF NOT EXISTS validade_fornecedor date;
-- ingredient_id já existia na tabela original

-- public.employees — coluna adicionada via migration-employees-mise.sql
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mise_ativo boolean DEFAULT false;
-- 31 funcionários ativados: departamento IN ('COZINHA', 'GERAL')
UPDATE public.employees SET mise_ativo = true WHERE ativo = true AND departamento IN ('COZINHA', 'GERAL');

-- Níveis de acesso — migration-access-control.sql ✅ JÁ RODADA
-- mise.user_pins: employee_id (FK), pin_hash (bcrypt), role CHECK ('admin'|'gerente'|'cozinheiro')
-- mise.sessions: employee_id, role, expires_at (12h)

-- mise.ingredient_shelf_life ✅ JÁ CRIADA E POPULADA
-- 798 validades customizadas importadas do Suflex
-- Colunas: ingredient_id (FK public.ingredients), metodo_conservacao, prazo_horas
```

### 4.4 Migration do módulo de Cadastros

Arquivo `migration-cadastros.sql` na raiz. **Rodar antes de usar Cadastros → Grupos.**

```sql
-- Campos necessários para hierarquia e ícone nos grupos
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS icone TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.groups(id);
```

> ⚠️ Sem esta migration, salvar um grupo com ícone ou subgrupo retorna erro do PostgREST. A listagem e criação sem ícone/subgrupo funcionam normalmente.

### 4.5 Seed de dados de teste

Arquivo `seed.sql` na raiz do projeto. Contém:
- 3 unidades (`public.units`)
- 3 funcionários (`public.employees`)
- 3 ingredientes (`public.ingredients`)
- 2 pratos (`public.menu_items`)
- 10 etiquetas (`mise.labels`) — variados status e datas
- 3 ordens de produção (`mise.production_orders`)

Rodar no Supabase SQL Editor depois dos passos 4.1 e 4.2.

---

## 5. PADRÃO DE ACESSO AO BANCO — REGRA CRÍTICA

### Qual client usar onde

| Contexto | Client | Por quê |
|----------|--------|---------|
| **Server Component (dados)** | `createServiceClient()` | Bypassa RLS, tem GRANT no schema `mise`, não é async |
| **Server Component (auth only)** | `await createClient()` | Usa cookies SSR para validar sessão — é async |
| **Client Component (browser)** | `createClient()` de `@/lib/supabase/client` | Usa anon key no browser |
| **Middleware** | `updateSession()` de `@/lib/supabase/middleware` | Valida e renova sessão |

### Como usar `createServiceClient()` em Server Components

```typescript
import { createServiceClient } from '@/lib/supabase/server'

// NÃO await — createServiceClient() NÃO é async (não precisa de cookies)
const supabase = createServiceClient()

// Schema mise
const { data, error } = await supabase.schema('mise').from('labels').select('*')

// Schema public (sem .schema())
const { data } = await supabase.from('units').select('id, name')
```

### Como usar API Routes para INSERTs (padrão para mise schema)

```typescript
// src/app/api/labels/route.ts  ← exemplo real em produção
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const supabase = createServiceClient()
  const { data, error } = await supabase.schema('mise').from('labels').insert(body).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}
```

---

## 6. BANCO DE DADOS — SUPABASE

### Conexão
- **Projeto**: `kph-os`
- **URL**: `https://iqgrvptrtphvbmvrqntm.supabase.co`

### Cross-schema joins (mise → public)

PostgREST não suporta joins cross-schema via select. **Padrão: queries separadas + merge em código.**

```typescript
// ❌ Não funciona
await supabase.schema('mise').from('labels').select('*, units(*)')

// ✅ Padrão correto
const { data: labels } = await supabase.schema('mise').from('labels').select('unit_id')
const unitIds = Array.from(new Set(labels?.map(l => l.unit_id) ?? []))
const { data: units } = await supabase.from('units').select('id, name').in('id', unitIds)
const unitsMap = Object.fromEntries(units?.map(u => [u.id, u.name]) ?? [])
```

> ⚠️ **Nunca use `[...new Set(...)]`** — causa erro TS2802. Sempre use `Array.from(new Set(...))`.

---

### Schema `mise` — tabelas do MISE

#### `mise.labels` — etiquetas de validade (TABELA PRINCIPAL)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `id` | uuid | PK | Gerado automaticamente |
| `unit_id` | uuid | Sim | FK → `public.units.id` |
| `employee_id` | uuid | Não | FK → `public.employees.id` |
| `production_order_id` | uuid | Não | FK → `mise.production_orders.id` |
| `ingredient_id` | uuid | Não | FK → `public.ingredients.id` (tipo=ingrediente) |
| `menu_item_id` | uuid | Não | FK → `public.menu_items.id` (tipo=preparacao/porcao) |
| `tipo` | text | Sim | `'ingrediente'` \| `'preparacao'` \| `'porcao'` |
| `nome` | text | Sim | Nome do produto na etiqueta |
| `peso_kg` | numeric | Não | Peso do lote em kg |
| `setor` | text | Não | Setor interno (ex: "Cozinha Quente") |
| `lote` | text | Não | Lote do fornecedor (ex: "L2024001") |
| `selo` | text | Não | Selo de inspeção: `'SIF'` \| `'SISP'` \| `'SIM'` \| `null` |
| `validade_fornecedor` | date | Não | Validade original impressa na embalagem do fornecedor |
| `metodo_conservacao` | text | Não | `'Resfriado 0-5°C'` \| `'Refrigerado 5-10°C'` \| `'Congelado -18°C'` \| `'Temperatura ambiente'` |
| `data_manipulacao` | timestamptz | Sim | Quando o produto foi manipulado |
| `validade` | timestamptz | Sim | Data/hora de vencimento |
| `status` | text | Sim | `'ativa'` \| `'consumida'` \| `'descartada'` \| `'vencida'` |
| `print_point_id` | uuid | Não | FK → `mise.print_points.id` — ponto de impressão selecionado |
| `printed_at` | timestamptz | Não | Quando a etiqueta foi impressa |
| `created_at` | timestamptz | Auto | Timestamp de criação |

#### `mise.ingredient_shelf_life` — validades customizadas por produto (Suflex)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `ingredient_id` | uuid | FK → `public.ingredients.id` |
| `metodo_conservacao` | text | Mesmos valores de `mise.labels.metodo_conservacao` |
| `prazo_horas` | numeric | Prazo em horas a partir da manipulação |

> **798 registros importados do Suflex.** Combinação `ingredient_id + metodo_conservacao` é única.
> Tem precedência sobre `mise.shelf_life_rules` (ANVISA) na lógica de cálculo de validade.

#### `mise.shelf_life_rules` — regras de validade ANVISA

32 linhas pré-populadas com as regras da **Portaria 2619/2011 (SP)**.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `categoria` | text | Categoria do alimento — mesmos valores de `public.ingredients.categoria_anvisa` |
| `metodo_conservacao` | text | Método de conservação |
| `prazo_horas` | numeric | Prazo em horas a partir da manipulação |

#### `mise.print_points` — pontos de impressão

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `unit_id` | uuid | FK → public.units.id |
| `name` | text | Nome da impressora |
| `rede` | text | Nome da rede (ex: KPH-Interno) — opcional |
| `ip_address` | text | IP na rede local — opcional |
| `icone` | text | Emoji opcional |
| `ativo` | boolean | `true` → badge "Online", `false` → "Offline" |
| `created_at` | timestamptz | Auto |

> ⚠️ A coluna `name` foi criada originalmente como `nome` no banco e renomeada. O código usa `name` em todos os lugares.

#### `mise.production_orders` — ordens de produção

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `unit_id` | uuid | FK → public.units |
| `menu_item_id` | uuid | Opcional |
| `quantity` | numeric | Quantidade |
| `unit` | text | Unidade de medida |
| `scheduled_for` | timestamptz | Quando programado |
| `assigned_to` | uuid | Opcional — FK → public.employees |
| `status` | text | `'pending'` \| `'in_progress'` \| `'completed'` \| `'cancelled'` |
| `notes` | text | Observações |
| `created_at` | timestamptz | Auto |

#### `mise.user_pins` — PINs de acesso por funcionário

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `employee_id` | uuid | FK → public.employees.id — UNIQUE |
| `pin_hash` | text | bcrypt hash (salt 10) |
| `role` | text | CHECK: `'admin'` \| `'gerente'` \| `'cozinheiro'` — default `'cozinheiro'` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Atualizado no upsert |

#### `mise.sessions` — sessões de PIN ativas

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK — usado como valor do cookie `mise-session` |
| `employee_id` | uuid | FK → public.employees.id |
| `role` | text | Role no momento da criação |
| `expires_at` | timestamptz | `now() + 12 horas` |
| `created_at` | timestamptz | Auto |

---

### Schema `public` — tabelas do ERP existente

#### `public.groups` — grupos de produtos

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | ⚠️ É `name` (inglês), NÃO `nome` |
| `slug` | text | Auto-gerado do name via `toSlug()` no POST /api/grupos |
| `icone` | text | Emoji opcional — adicionado via migration-cadastros.sql |
| `parent_id` | uuid | FK → groups.id — adicionado via migration-cadastros.sql |

#### `public.units` — unidades KPH

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | ⚠️ **É `name` (inglês), NÃO `nome`** |
| `active` | boolean | Filtrar com `.eq('active', true)` |
| `cnpj` | text | Adicionada via migration |
| `address` | text | Adicionada via migration |

#### `public.employees` — funcionários

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `nome` | text | É `nome` (português) |
| `departamento` | text | `COZINHA` \| `SALAO` \| `ADMINISTRATIVO` \| `GERAL` \| `null` |
| `ativo` | boolean | Filtrar com `.eq('ativo', true)` |
| `mise_ativo` | boolean | `true` = aparece no MISE. Gerenciado em `/cadastros/funcionarios`. |

#### `public.ingredients` — insumos

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `nome` | text | É `nome` (português) |
| `codigo` | text | Código interno — opcional |
| `group_id` | uuid | FK → public.groups.id |
| `categoria` | text | NOT NULL — 12 valores: `proteina` \| `fruta` \| `legume` \| `verdura` \| `graos` \| `laticinios` \| `panificacao` \| `oleo_gordura` \| `tempero` \| `descartavel` \| `limpeza` \| `outro` |
| `categoria_anvisa` | text | **624 produtos preenchidos.** Valores: `proteina_animal_cozida` \| `proteina_animal_crua` \| `pescado_cru` \| `pescado_cozido` \| `vegetal_cozido` \| `vegetal_cru` \| `arroz_massa_cereais` \| `molho_caldo` \| `laticinios` \| `sobremesa` \| `fritura` |
| `unidade_padrao` | text | Unidade de medida |
| `custo_padrao` | numeric | Custo por unidade |
| `fornecedor_id` | uuid | FK → public.suppliers.id — ⚠️ coluna real é `fornecedor_id` (não `supplier_id`) |
| `perdas_padrao` | numeric | Percentual de perdas |
| `observacoes` | text | Notas livres |
| `ativo` | boolean | Default true |

#### `public.menu_items` — pratos e preparações

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid | PK |
| `nome` | text | |
| `custo` | numeric | Custo de produção |
| `preco_venda` | numeric | Preço de venda |

---

## 7. ESTRUTURA DE ARQUIVOS

```
mise-backoffice/
├── .env.local                          ← Variáveis de ambiente (NÃO commitado)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── CLAUDE.md                           ← Este arquivo
│
└── src/
    ├── middleware.ts                   ← DEV: bypass total. PROD: auth dupla (Supabase + PIN)
    │                                     ⚠️ MANTER como middleware.ts — proxy.ts causa erro
    │
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                  ← Root: Geist fonts, lang="pt-BR", title="MISE Backoffice"
    │   │
    │   ├── api/
    │   │   ├── auth/
    │   │   │   ├── pin-login/route.ts  ← POST — bcrypt.compare, cria mise.sessions, cookie httpOnly
    │   │   │   ├── pin-logout/route.ts ← POST — remove sessão, limpa cookie
    │   │   │   ├── me/route.ts         ← GET — retorna sessão atual
    │   │   │   ├── set-pin/route.ts    ← POST — bcrypt.hash(pin,10), upsert mise.user_pins
    │   │   │   └── pins-list/route.ts  ← GET — lista employee_id + role de mise.user_pins
    │   │   ├── labels/
    │   │   │   ├── route.ts            ← POST — INSERT em mise.labels
    │   │   │   ├── [id]/route.ts       ← PATCH — atualiza status
    │   │   │   └── check-conflict/route.ts ← GET ?ingredient_id=X&unit_id=Y
    │   │   ├── shelf-life-rule/
    │   │   │   └── route.ts            ← GET ?metodo=X&ingredient_id=Y&categoria=Z
    │   │   │                             Prioridade: ingredient_shelf_life → shelf_life_rules
    │   │   │                             Retorna: { prazo_horas, source: 'custom'|'anvisa' }
    │   │   ├── grupos/
    │   │   │   ├── route.ts            ← POST
    │   │   │   └── [id]/route.ts       ← PATCH
    │   │   ├── produtos/
    │   │   │   ├── route.ts            ← POST
    │   │   │   └── [id]/route.ts       ← PATCH
    │   │   ├── print-points/
    │   │   │   ├── route.ts            ← GET ?unit_id=X + POST
    │   │   │   └── [id]/route.ts       ← PATCH
    │   │   ├── relatorios/
    │   │   │   └── producao/route.ts   ← GET ?data_inicio=Y&data_fim=Z&unit_id=X
    │   │   └── employees/
    │   │       ├── [id]/route.ts       ← PATCH — atualiza mise_ativo
    │   │       └── mise-ativos/route.ts ← GET — lista employees com mise_ativo=true
    │   │
    │   ├── pin-login/
    │   │   ├── page.tsx                ← Busca employees MISE ativos com PIN cadastrado
    │   │   └── _components/pin-login-client.tsx ← Grid + teclado PIN, auto-submit 4º dígito
    │   │
    │   ├── (auth)/login/page.tsx       ← Form email/senha Supabase Auth
    │   │
    │   └── (dashboard)/
    │       ├── layout.tsx              ← Detecta Supabase Auth ou mise-session → passa ao Sidebar
    │       ├── page.tsx                ← Dashboard: KPIs + últimas 10 etiquetas + validades críticas
    │       ├── etiquetas/
    │       │   ├── page.tsx            ← Server: listagem com filtros URL + props ao LabelForm
    │       │   └── _components/label-form.tsx ← Client: formulário completo + preview + impressão
    │       ├── validades/
    │       │   ├── page.tsx            ← Server: busca labels ativas, resolve nomes
    │       │   └── _components/validades-client.tsx ← 4 cards, countdown 30s, ações inline
    │       ├── cadastros/
    │       │   ├── funcionarios/page.tsx + _components/employee-toggle.tsx
    │       │   ├── grupos/ (page, novo, [id], _components/grupo-form.tsx)
    │       │   └── produtos/ (page, novo, [id], _components/produto-form.tsx)
    │       ├── configuracoes/
    │       │   ├── pontos-impressao/ (page, novo, [id], _components/print-point-form.tsx)
    │       │   └── pins/ (page, _components/set-pin-modal.tsx)
    │       ├── relatorios/
    │       │   ├── page.tsx
    │       │   └── _components/relatorio-client.tsx
    │       ├── producao/page.tsx       ← ⏳ Stub
    │       ├── recebimento/page.tsx    ← ⏳ Stub
    │       └── inventario/page.tsx     ← ⏳ Stub
    │
    ├── components/
    │   ├── ui/button.tsx               ← Único componente shadcn (sem @radix-ui/react-slot)
    │   └── layout/sidebar.tsx          ← Relatórios visível para TODOS os roles
    │                                     Cadastros + Configurações: apenas admin/gerente
    │
    └── lib/
        ├── utils.ts                    ← cn() = twMerge(clsx(...))
        ├── session.ts                  ← getMiseSession() — lê cookie mise-session
        ├── supabase/
        │   ├── client.ts               ← createClient() — browser
        │   ├── server.ts               ← createClient() (auth) + createServiceClient() (dados)
        │   └── middleware.ts           ← updateSession()
        └── types/mise.ts               ← Types: Label, PrintPoint, ProductionOrder, etc.
```

---

## 8. MÓDULOS — ESTADO ATUAL DETALHADO

### ✅ Etiquetas (`/etiquetas`) — 100% funcional

#### Lógica de cálculo de validade automático

**Prioridade (ordem de busca em `/api/shelf-life-rule`):**

1. **`mise.ingredient_shelf_life`** (customizado Suflex) — se `ingredient_id` fornecido
   - 798 registros importados
   - Badge: `"Suflex · Xh"` (verde)
   - Campo "Categoria ANVISA" some do formulário
2. **`mise.shelf_life_rules`** (ANVISA Portaria 2619/2011) — fallback por `categoria`
   - 32 regras por categoria + método
   - Badge: `"ANVISA · Xh"` (verde)
   - Campo "Categoria ANVISA" visível (auto-preenchido se produto tem `categoria_anvisa`)
3. **Manual** — nenhuma regra encontrada
   - Usuário preenche a validade manualmente

**API `GET /api/shelf-life-rule`:**
- Params: `metodo` (obrigatório), `ingredient_id` (opcional), `categoria` (opcional)
- Retorna: `{ prazo_horas, source: 'custom' | 'anvisa' }` ou 404
- ⚠️ Nunca usar `encodeURIComponent` ao montar `URLSearchParams` — causa double-encoding

**`useEffect` no label-form.tsx:**
- Dependências: `[categoria, metodo, selectedProduct]`
- Dispara quando método muda OU produto muda
- Passa `ingredient_id` automaticamente para ingredientes
- Passa `categoria` para o fallback ANVISA

**624 produtos com `categoria_anvisa` preenchida** — para esses, o fallback ANVISA funciona automaticamente sem interação do usuário.

#### Outros detalhes do formulário

- Busca de produto: combo box, ≥2 caracteres
- Peso: input em gramas → salvo em kg (`÷ 1000`)
- Responsável: grid de cards touch-first com iniciais coloridas
- Conflito: detecta etiqueta ativa duplicada via `/api/labels/check-conflict`
- Ponto de impressão: aparece automaticamente ao selecionar unidade
- Preview 10×6cm + QR Code (UUID completo) + impressão via `window.open()`

### ✅ Sidebar

- Seção "RELATÓRIOS" visível para **todos os roles** (admin, gerente, cozinheiro)
- Posicionada entre Inventário e Cadastros
- Cadastros + Configurações: apenas admin/gerente (`showAdminSections = role !== 'cozinheiro'`)

### ✅ Relatório de Produção (`/relatorios`)

- Filtros: período (Hoje/Ontem/7 dias/30 dias/Personalizado) + unidade
- Tabela agrupada por produto com totais
- Exportação PDF via `window.open()` + `window.print()`
- API: `GET /api/relatorios/producao?data_inicio=Y&data_fim=Z&unit_id=X`
- Timezone SP: `data_inicio T03:00:00Z` até `(data_fim + 1) T03:00:00Z`

### ✅ Validades (`/validades`)

- 4 cards clicáveis: Vencidos / Hoje / Amanhã / Próximos 3 dias
- Countdown 30s via `setInterval`
- Ações inline: Consumida / Descartar com optimistic update
- `startOfDaySP(offsetDays)`: usa `en-CA` locale para calcular limites de dia em SP

---

## 9. DÍVIDAS TÉCNICAS CONHECIDAS

### 🔴 Alta prioridade

**1. TypeScript types desatualizados em `src/lib/types/mise.ts`**
- `WasteRecord` não tem campo `custo_total` (existe no DB)
- **Fix**: `supabase gen types typescript --project-id iqgrvptrtphvbmvrqntm`

### 🟡 Média prioridade

**2. Página de edição de unidades ausente**
- Não existe `/configuracoes/unidades` — CNPJ e endereço só editáveis via SQL direto

---

## 10. CONVENÇÕES DO PROJETO

### Idioma
- **Código** (variáveis, funções, arquivos): inglês
- **UI** (labels, textos, placeholders, erros): português

### Server vs Client Component

| Server Component | Client Component |
|-----------------|-----------------|
| Busca de dados do Supabase | Forms, estado, eventos DOM |
| `page.tsx` por padrão | Extrair para `_components/` quando precisar de hooks |

### Padrão de queries Supabase

```typescript
// ✅ Server Component — dados
const supabase = createServiceClient() // NÃO await

// Schema mise
const { data } = await supabase.schema('mise').from('labels').select(...)

// Schema public
const { data } = await supabase.from('units').select('id, name')

// Set sem spread (evita erro TS2802)
const ids = Array.from(new Set(items.map(i => i.id)))

// searchParams em page.tsx (Next.js 16 — é uma Promise)
type SearchParams = Promise<{ unit?: string }>
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { unit } = await searchParams
}
```

### Timezone

```typescript
// Início do dia em SP
function getTodayStart(): string {
  const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return `${spDate}T00:00:00-03:00`
}

// Valor padrão para datetime-local input
function nowLocalISO(): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${sp.getFullYear()}-${p(sp.getMonth() + 1)}-${p(sp.getDate())}T${p(sp.getHours())}:${p(sp.getMinutes())}`
}
```

### Design system — classes Tailwind recorrentes

```
// Card
rounded-xl border border-neutral-800 bg-neutral-900

// Input/select dark
w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white
placeholder-neutral-500 focus:border-neutral-500 focus:outline-none

// Botão primário
rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100

// Status badges
ativa:      text-emerald-400 bg-emerald-400/10
consumida:  text-blue-400 bg-blue-400/10
descartada: text-red-400 bg-red-400/10
vencida:    text-orange-400 bg-orange-400/10
```

### Avisos conhecidos do Next.js 16 — NÃO agir sobre eles

- `"The 'middleware' file convention is deprecated."` — **IGNORAR. NÃO renomear para proxy.ts.** Causa Internal Server Error em Next.js 16.2.6.
- `searchParams` e `cookies()` são Promises — sempre `await`.

---

## 11. AUTENTICAÇÃO

### Dois fluxos coexistem

| Usuário | Fluxo | Cookie | Role |
|---------|-------|--------|------|
| Gestor/Dono | Supabase Auth (email + senha) | `sb-*` (Supabase) | `admin` |
| Cozinheiro | PIN 4 dígitos → `mise.sessions` | `mise-session` (httpOnly) | `cozinheiro` ou `gerente` |

### Usuário Supabase Auth criado: `rh@meeteat.com.br` (admin)

### Middleware (`src/middleware.ts`)
- **Dev**: bypass total
- **Prod**: `/pin-login` sempre acessível; cookie `mise-session` bypassa Supabase Auth; fallback → redirect `/login`
- ⚠️ MANTER como `middleware.ts`

### Sessões PIN
- Expiração: 12 horas
- Cookie `mise-session`: httpOnly, sameSite=lax, maxAge=43200
- `getMiseSession()` em `src/lib/session.ts`

---

## 12. COMO RODAR

```bash
npm install
npm run dev     # porta 3000
npm run build
npx tsc --noEmit  # type check sem build
```

**Após editar `.env.local`:** reiniciar obrigatório.

**Para rodar via Claude Code** (quando o terminal do usuário não tem permissão no Desktop):
- Usar `! npm run dev` no prompt — o Claude Code já tem acesso à pasta
