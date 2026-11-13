-- Cadastro MISE de empresas e vínculo das unidades operacionais existentes.
create table mise.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null,
  cnpj text not null unique,
  state_registration text,
  municipal_registration text,
  cnae text,
  postal_code text not null,
  street text not null,
  street_number text not null,
  complement text,
  district text not null,
  city text not null,
  state text not null,
  phone text,
  email text,
  website text,
  contact_name text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_cnpj_format check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  constraint companies_postal_code_format check (postal_code ~ '^[0-9]{8}$'),
  constraint companies_state_format check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);
alter table mise.companies enable row level security;
revoke all on mise.companies from public, anon, authenticated;
grant usage on schema mise to service_role;
grant select, insert, update, delete on mise.companies to service_role;

-- Colunas opcionais mantêm as unidades legadas e seus vínculos operacionais intactos.
alter table public.units
  add column company_id uuid references mise.companies(id) on delete restrict,
  add column legal_name text,
  add column state_registration text,
  add column municipal_registration text,
  add column cnae text,
  add column postal_code text,
  add column street text,
  add column street_number text,
  add column complement text,
  add column district text,
  add column city text,
  add column state text,
  add column phone text,
  add column email text,
  add column website text,
  add column contact_name text,
  add column notes text,
  add column updated_at timestamptz default now();
create index units_company_id_idx on public.units(company_id);
create unique index units_registered_cnpj_unique on public.units ((upper(regexp_replace(cnpj, '[^A-Za-z0-9]', '', 'g')))) where company_id is not null and cnpj is not null;
alter table public.units add constraint units_registered_cnpj_format check (company_id is null or (cnpj is not null and cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'));
comment on column public.units.company_id is 'Empresa cadastrada no MISE. Unidades legadas permanecem sem vínculo até revisão administrativa.';
notify pgrst, 'reload schema';
