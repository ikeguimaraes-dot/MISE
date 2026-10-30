-- Target: Eventos project rpavxnjchfmeiacnumpk.
ALTER TABLE public.eventos ADD COLUMN versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1);
CREATE FUNCTION public.eventos_incrementar_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.versao := 1;
  ELSE
    NEW.versao := OLD.versao + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER eventos_versao_before_write BEFORE INSERT OR UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.eventos_incrementar_versao();
COMMENT ON COLUMN public.eventos.versao IS 'V1 no cadastro ou início do controle; incrementada automaticamente a cada atualização.';
NOTIFY pgrst, 'reload schema';
