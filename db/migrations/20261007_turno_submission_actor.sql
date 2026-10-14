-- Auth users and MISE employees are different identities. Preserve both without
-- guessing historical authors or requiring an artificial auth.users mapping.
ALTER TABLE public.op_relatorio_periodo ADD COLUMN IF NOT EXISTS enviado_employee_id uuid REFERENCES public.employees(id);
ALTER TABLE public.op_relatorio_diario ADD COLUMN IF NOT EXISTS enviado_employee_id uuid REFERENCES public.employees(id);
COMMENT ON COLUMN public.op_relatorio_periodo.enviado_employee_id IS 'Authenticated MISE session employee at submission; shared account, not the declared manager. No historical backfill.';
COMMENT ON COLUMN public.op_relatorio_diario.enviado_employee_id IS 'Authenticated MISE session employee closing the day. No historical backfill.';
