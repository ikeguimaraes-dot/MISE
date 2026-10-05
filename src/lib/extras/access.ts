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
  const [employee, grants] = await Promise.all([
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
  ]);
  if (employee.error || !employee.data?.ativo)
    throw new ExtraError("Acesso do colaborador indisponível.", 403);
  if (grants.error)
    throw new ExtraError(
      "O fluxo real de Extras ainda não está configurado.",
      503,
    );
  return {
    session,
    db,
    grants: ((grants.data ?? []) as ExtraAccess[]).filter(
      (g) => g.role !== "lider" || g.unit_id === employee.data.unit_id,
    ),
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
  "id,unit_id,data_solicitacao,data_trabalho,setor,funcao,motivo,motivo_detalhe,nome,valor,comissao,total,pagadora,status,emergencial,periodo,sequencia,pago_em,mise_requested_by,mise_stage_at,mise_version,mise_rh_complete,mise_approved_total,mise_receipt_id,mise_allowance_snapshot,mise_managed";
