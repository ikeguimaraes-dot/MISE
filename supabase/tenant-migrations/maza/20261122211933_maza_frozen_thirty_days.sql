-- Maza only: apply to dncqjezvndoxeqpklefy, never to KPH.
-- Catalog eligibility only; existing products and printed labels retain their values.
alter table public.ingredients drop constraint if exists ingredients_categoria_check;
alter table public.ingredients add constraint ingredients_categoria_check check (categoria in (
  'proteina','verdura','legume','fruta','graos','laticinios','panificacao',
  'bebida_alcoolica','bebida_nao_alcoolica','tempero','oleo_gordura','descartavel','limpeza','outro',
  'molhos','ovos','shari','feitos_empanados','congelados_30_dias'
));
notify pgrst, 'reload schema';
