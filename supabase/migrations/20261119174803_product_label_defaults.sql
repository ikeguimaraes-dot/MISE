-- Global catalog defaults; no unit/company rows are changed.
alter table public.ingredients
  add column if not exists lote text,
  add column if not exists metodo_conservacao text,
  add column if not exists prazo_validade_horas numeric check (prazo_validade_horas > 0 and prazo_validade_horas <= 87600);
alter table public.ingredients drop constraint if exists ingredients_categoria_check;
alter table public.ingredients add constraint ingredients_categoria_check check (categoria in (
  'proteina','verdura','legume','fruta','graos','laticinios','panificacao',
  'bebida_alcoolica','bebida_nao_alcoolica','tempero','oleo_gordura','descartavel','limpeza','outro',
  'molhos','ovos','shari','feitos_empanados'
));
alter table mise.labels add column if not exists marca text;
comment on column public.ingredients.prazo_validade_horas is 'Admin-configured duration, counted from server-generated manipulation time; category limits still apply.';
comment on column mise.labels.marca is 'Brand captured at issuance for consistent reprints.';
notify pgrst, 'reload schema';
