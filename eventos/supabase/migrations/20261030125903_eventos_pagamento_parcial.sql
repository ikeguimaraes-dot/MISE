-- Target: Eventos project rpavxnjchfmeiacnumpk.
ALTER TABLE public.eventos
  ADD COLUMN valor_pago_parcial numeric(12,2) CHECK (valor_pago_parcial >= 0 AND valor_pago_parcial <= 9999999999.99),
  DROP CONSTRAINT eventos_pagamento_status_check,
  ADD CONSTRAINT eventos_pagamento_status_check CHECK (pagamento_status IN ('Pago', 'A pagar', 'Pagamento parcial')),
  ADD CONSTRAINT eventos_pagamento_parcial_valor_check CHECK (pagamento_status IS DISTINCT FROM 'Pagamento parcial' OR (valor_pago_parcial IS NOT NULL AND valor_pago_parcial > 0));
COMMENT ON COLUMN public.eventos.valor_pago_parcial IS 'Valor acumulado já pago parcialmente, em reais; alteração não incrementa versão operacional.';
CREATE OR REPLACE FUNCTION public.eventos_incrementar_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  financial_fields text[] := ARRAY['versao', 'updated_at', 'custo_evento', 'valor_cobrado', 'situacao_pagamento', 'pagamento_status', 'pagamento_meio', 'valor_pago_parcial', 'comprovantes_pagamento'];
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
