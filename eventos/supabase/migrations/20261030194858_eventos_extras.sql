-- Target: Eventos project rpavxnjchfmeiacnumpk.
ALTER TABLE public.eventos
  ADD COLUMN extras_valor numeric(12,2) CHECK (extras_valor >= 0),
  ADD COLUMN extras_valor_pago numeric(12,2) CHECK (extras_valor_pago >= 0),
  ADD COLUMN extras_status text CHECK (extras_status IN ('Pago integralmente', 'Pagamento parcial', 'Não pago')),
  ADD COLUMN extras_meio text CHECK (extras_meio IN ('Cartão', 'Pix', 'Boleto', 'Dinheiro', 'Outro')),
  ADD COLUMN extras_local text CHECK (extras_local IN ('Via Financeiro Adm', 'Via Caixa Restaurante', 'Outro')),
  ADD COLUMN extras_observacoes text,
  ADD CONSTRAINT eventos_extras_status_valor CHECK ((extras_valor IS NULL AND extras_status IS NULL) OR (extras_valor IS NOT NULL AND extras_status IS NOT NULL)),
  ADD CONSTRAINT eventos_extras_parcial CHECK (extras_status IS DISTINCT FROM 'Pagamento parcial' OR (extras_valor_pago IS NOT NULL AND extras_valor_pago > 0 AND extras_valor_pago < extras_valor));
CREATE OR REPLACE FUNCTION public.eventos_incrementar_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  financial_fields text[] := ARRAY['extras_valor', 'extras_valor_pago', 'extras_status', 'extras_meio', 'extras_local', 'extras_observacoes', 'versao', 'updated_at', 'custo_evento', 'valor_cobrado', 'situacao_pagamento', 'pagamento_status', 'pagamento_meio', 'valor_pago_parcial', 'comprovantes_pagamento'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.versao := 1;
  ELSIF (to_jsonb(NEW) - financial_fields) IS DISTINCT FROM (to_jsonb(OLD) - financial_fields) THEN
    NEW.versao := OLD.versao + 1;
  ELSE
    NEW.versao := OLD.versao;
  END IF;
  RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
