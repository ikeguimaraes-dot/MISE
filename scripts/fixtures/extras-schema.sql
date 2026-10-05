-- Isolated database only. Synthetic, minimal copy of the contracts used by Extras.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA mise; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.units(id uuid PRIMARY KEY,name text,active boolean DEFAULT true);
CREATE TABLE public.roles(id uuid PRIMARY KEY,name text,permissions jsonb);
CREATE TABLE public.employees(id uuid PRIMARY KEY,unit_id uuid REFERENCES units, user_id uuid REFERENCES auth.users,role_id uuid REFERENCES roles,ativo boolean DEFAULT true);
CREATE TYPE public.op_extra_status AS ENUM('solicitado','aguardando_diretoria','aprovado_rh','reservado_financeiro','pago','recusado','cancelado');
CREATE TYPE public.op_extra_motivo AS ENUM('teste_vaga','vaga_aberta','falta_atestado','evento','folga');
CREATE TYPE public.op_extra_pagadora AS ENUM('casa','terceirizada');
CREATE TYPE public.op_extra_periodo AS ENUM('manha','almoco','jantar','eventos');
CREATE TABLE public.op_extra(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES units,data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,data_trabalho date NOT NULL,setor text NOT NULL,funcao text NOT NULL,motivo op_extra_motivo NOT NULL,motivo_detalhe text,cpf text CHECK(cpf ~ '^\d{11}$'),nome text NOT NULL,valor numeric NOT NULL,comissao numeric NOT NULL DEFAULT 0,total numeric GENERATED ALWAYS AS (valor+comissao) STORED,pagadora op_extra_pagadora,status op_extra_status NOT NULL DEFAULT 'solicitado',emergencial boolean NOT NULL DEFAULT false,recibo_url text,solicitante_id uuid REFERENCES auth.users,aprovador_rh_id uuid REFERENCES auth.users,pago_em date,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),periodo op_extra_periodo,sequencia int DEFAULT 1);
CREATE TABLE public.op_extra_alcada(unit_id uuid,percentual numeric,vigente_desde date);
CREATE TABLE public.metas_dia_semana(id uuid DEFAULT gen_random_uuid(),unit_id uuid,dia_semana int,meta numeric,competencia text,UNIQUE(unit_id,dia_semana,competencia));
CREATE TABLE public.metas_dia_override(id uuid DEFAULT gen_random_uuid(),unit_id uuid,data date,meta numeric,UNIQUE(unit_id,data));
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,tipo text NOT NULL,titulo text NOT NULL,mensagem text,link text,lida boolean NOT NULL DEFAULT false,criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
