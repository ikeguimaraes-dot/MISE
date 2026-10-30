-- Target: Eventos project rpavxnjchfmeiacnumpk.
ALTER TABLE public.eventos
  ADD COLUMN pagamento_status text CHECK (pagamento_status IN ('Pago', 'A pagar')),
  ADD COLUMN pagamento_meio text CHECK (pagamento_meio IN ('Cartão', 'Pix', 'Boleto'));
COMMENT ON COLUMN public.eventos.situacao_pagamento IS 'Forma de pagamento: via financeiro administrativo ou caixa do restaurante (nome legado da coluna).';
COMMENT ON COLUMN public.eventos.pagamento_status IS 'Situação do pagamento: Pago ou A pagar; NULL significa não informado.';
COMMENT ON COLUMN public.eventos.pagamento_meio IS 'Meio de pagamento: Cartão, Pix ou Boleto.';
CREATE OR REPLACE FUNCTION public.eventos_incrementar_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  financial_fields text[] := ARRAY['versao', 'updated_at', 'custo_evento', 'valor_cobrado', 'situacao_pagamento', 'pagamento_status', 'pagamento_meio', 'comprovantes_pagamento'];
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
COMMENT ON COLUMN public.eventos.versao IS 'Versão operacional; alterações exclusivamente financeiras não incrementam a versão.';
NOTIFY pgrst, 'reload schema';
