-- Target: Eventos project rpavxnjchfmeiacnumpk (not the MISE database).
ALTER TABLE public.eventos
  ADD COLUMN custo_evento numeric(12,2) CHECK (custo_evento >= 0 AND custo_evento <= 9999999999.99),
  ADD COLUMN valor_cobrado numeric(12,2) CHECK (valor_cobrado >= 0 AND valor_cobrado <= 9999999999.99);
COMMENT ON COLUMN public.eventos.custo_evento IS 'Custo total do evento em BRL; NULL significa não informado.';
COMMENT ON COLUMN public.eventos.valor_cobrado IS 'Valor total cobrado pelo evento em BRL; NULL significa não informado.';
NOTIFY pgrst, 'reload schema';
