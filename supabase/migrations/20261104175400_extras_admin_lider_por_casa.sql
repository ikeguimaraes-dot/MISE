-- MISE project iqgrvptrtphvbmvrqntm. No automatic role assignment.
-- Administrators may receive explicit leader grants outside their home unit.
CREATE OR REPLACE FUNCTION mise.extra_has_role(actor uuid, unit uuid, required_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
 SELECT EXISTS(SELECT 1 FROM public.employees e LEFT JOIN public.roles r ON r.id=e.role_id
 WHERE e.id=actor AND e.ativo AND EXISTS(SELECT 1 FROM public.op_extra_alcada WHERE unit_id=unit)
 AND (
 EXISTS(SELECT 1 FROM mise.extra_access a WHERE a.employee_id=actor AND a.unit_id=unit AND a.role=required_role AND (required_role<>'lider' OR e.unit_id=unit OR r.name='founder' OR r.permissions @> '["*"]'::jsonb))
 OR (required_role='diretor' AND (r.name='founder' OR r.permissions @> '["*"]'::jsonb))
 OR (required_role='lider' AND e.unit_id=unit AND (e.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM mise.sessions s WHERE s.employee_id=actor AND s.role='gerente' AND s.expires_at>now())))
 ));
$$;
CREATE OR REPLACE FUNCTION mise.extra_access_set(p_admin uuid,p_employee uuid,p_unit uuid,p_role text,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,mise AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.employees e JOIN public.roles r ON r.id=e.role_id WHERE e.id=p_admin AND e.ativo AND (lower(r.name)='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Somente administrador pode configurar acessos'; END IF;
 IF p_role NOT IN ('lider','rh','diretor','financeiro','caixa') OR p_enabled IS NULL THEN RAISE EXCEPTION 'Papel inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employees e LEFT JOIN public.roles r ON r.id=e.role_id WHERE e.id=p_employee AND e.ativo AND (p_role<>'lider' OR e.unit_id=p_unit OR r.name='founder' OR r.permissions @> '["*"]'::jsonb)) THEN RAISE EXCEPTION 'Colaborador indisponível ou líder fora da própria unidade'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE id=p_unit AND active) THEN RAISE EXCEPTION 'Unidade indisponível'; END IF;
 IF p_enabled THEN
  INSERT INTO mise.extra_access(employee_id,unit_id,role,granted_by) VALUES(p_employee,p_unit,p_role,p_admin) ON CONFLICT(employee_id,unit_id,role) DO NOTHING;
 ELSE DELETE FROM mise.extra_access WHERE employee_id=p_employee AND unit_id=p_unit AND role=p_role;
 END IF;
 INSERT INTO mise.extra_access_events(actor_id,employee_id,unit_id,role,action) VALUES(p_admin,p_employee,p_unit,p_role,CASE WHEN p_enabled THEN 'grant' ELSE 'revoke' END);
END;
$$;
REVOKE ALL ON FUNCTION mise.extra_access_set(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_access_set(uuid,uuid,uuid,text,boolean) TO service_role;

REVOKE ALL ON FUNCTION mise.extra_has_role(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mise.extra_has_role(uuid,uuid,text) TO service_role;
