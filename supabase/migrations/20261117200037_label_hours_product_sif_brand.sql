-- Additive; existing products and printed labels retain their current values.
alter table public.ingredients
  add column if not exists sif text,
  add column if not exists marca text;
alter table mise.labels
  add column if not exists sif text,
  add column if not exists validade_original timestamptz,
  add column if not exists validade_alterada_por uuid references public.employees(id) on delete set null,
  add column if not exists validade_alterada_em timestamptz;
comment on column mise.labels.sif is 'Product inspection registration captured at label creation; retained for reprints.';
notify pgrst, 'reload schema';
