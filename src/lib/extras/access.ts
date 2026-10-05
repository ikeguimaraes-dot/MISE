import "server-only";
import { getMiseSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
export const EXTRA_ROLES = [
  "lider",
  "rh",
  "diretor",
  "financeiro",
  "caixa",
] as const;
export type ExtraRole = (typeof EXTRA_ROLES)[number];
export type ExtraAccess = { unit_id: string; role: ExtraRole };
export class ExtraError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function extrasContext() {
  const session = await getMiseSession();
  if (!session)
    throw new ExtraError("Entre na plataforma para continuar.", 401);
  const db = createServiceClient();
  const [employee, grants, operational] = await Promise.all([
    db
      .from("employees")
      .select("ativo,unit_id")
      .eq("id", session.employeeId)
      .single(),
    db
      .schema("mise")
      .from("extra_access")
      .select("unit_id,role")
      .eq("employee_id", session.employeeId),
    db.from("op_extra_alcada").select("unit_id"),
  ]);
  if (employee.error || !employee.data?.ativo)
    throw new ExtraError("Acesso do colaborador indisponível.", 403);
  if (grants.error)
    throw new ExtraError(
      "O fluxo real de Extras ainda não está configurado.",
      503,
    );
  if (operational.error) throw new ExtraError("Unidades operacionais indisponíveis.", 503);
  const operationalIds = new Set((operational.data ?? []).map(u => u.unit_id));
  const roles = ((grants.data ?? []) as ExtraAccess[]).filter(g => operationalIds.has(g.unit_id) && (g.role !== "lider" || g.unit_id === employee.data.unit_id));
  if (session.role === "admin") for (const unit_id of operationalIds) roles.push({ unit_id, role: "diretor" });
  if (session.role === "gerente" && operationalIds.has(employee.data.unit_id)) roles.push({ unit_id: employee.data.unit_id, role: "lider" });
  return {
    session,
    db,
    grants: roles.filter((g, i) => roles.findIndex(r => r.unit_id === g.unit_id && r.role === g.role) === i),
  };
}
export function requireExtraAccess(
  grants: ExtraAccess[],
  unit: string,
  role?: ExtraRole,
) {
  if (
    !grants.some(
      (grant) => grant.unit_id === unit && (!role || grant.role === role),
    )
  )
    throw new ExtraError("Sem permissão para esta unidade/etapa.", 403);
}
export function requireUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ExtraError("Identificador inválido.");
  return value;
}
export function extraResponseError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ExtraError
          ? error.message
          : "Não foi possível concluir. Recarregue e tente novamente.",
    },
    { status: error instanceof ExtraError ? error.status : 500 },
  );
}
// Explicit projection: CPF and internal command payload never enter a list response.
export const EXTRA_SELECT =
  "id,solicitacao_id,mise_position,unit_id,solicitante_nome,data_solicitacao,data_trabalho,setor,funcao,motivo,motivo_detalhe,nome,valor,total,pagadora,status,emergencial,periodo,pago_em,mise_requested_by,mise_stage_at,mise_version,mise_rh_complete,mise_approved_total,mise_receipt_id,mise_allowance_snapshot,mise_managed,mise_emergency_decision";

export function requireExtraRead(grants: ExtraAccess[], unit: string, requester: string | null, employee: string) {
  requireExtraAccess(grants, unit);
  if (!grants.some(g => g.unit_id === unit && g.role !== "lider") && requester !== employee)
    throw new ExtraError("Sem acesso a esta solicitação.", 403);
}
