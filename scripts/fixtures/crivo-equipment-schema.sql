-- Test-only mirror of columns already present in the live database.
CREATE TABLE IF NOT EXISTS mise.crivo_locais(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES public.units,nome text NOT NULL,ativo boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS mise.crivo_equipamentos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),local_id uuid NOT NULL REFERENCES mise.crivo_locais,codigo text NOT NULL,nome text,tipo text NOT NULL,area text,ativo boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(local_id,codigo));
ALTER TABLE mise.checklist_template_items ADD COLUMN IF NOT EXISTS por_equipamento boolean NOT NULL DEFAULT false;
ALTER TABLE mise.checklist_template_items ADD COLUMN IF NOT EXISTS equipamento_tipo text;
ALTER TABLE mise.checklist_responses ADD COLUMN IF NOT EXISTS equipamento_id uuid REFERENCES mise.crivo_equipamentos;
ALTER TABLE mise.checklist_executions ADD COLUMN IF NOT EXISTS local_id uuid REFERENCES mise.crivo_locais;
