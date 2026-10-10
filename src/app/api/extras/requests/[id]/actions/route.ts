export const maxDuration=60;
import { after } from "next/server";
import { dispatchExtraNotifications } from "@/lib/extras/notifications";
import {
  extrasContext,
  requireExtraAccess,
  requireUuid,
  ExtraError,
  extraResponseError,
  EXTRA_ROLES,
  type ExtraRole,
} from "@/lib/extras/access";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, grants, session } = await extrasContext();
    const { id } = await params;
    requireUuid(id);
    const body = await request.json();
    const role = body.role as ExtraRole;
    if (
      !EXTRA_ROLES.includes(role) ||
      ![
        "aprovar",
        "ratificar_emergencia",
        "nao_ratificar_emergencia",
        "recusar",
        "cancelar",
        "preparar_rh",
        "reservar",
        "informar_pagamento",
        "conferir",
      ].includes(body.action) ||
      !Number.isInteger(body.version)
    )
      throw new ExtraError("Comando inválido.");
    const item = await db
      .from("op_extra")
      .select("unit_id")
      .eq("id", id)
      .single();
    if (item.error || !item.data)
      throw new ExtraError("Solicitação não encontrada.", 404);
    requireExtraAccess(grants, item.data.unit_id, role);
    const { data, error } = await db
      .schema("mise")
      .rpc("extra_command", {
        p_actor: session.employeeId,
        p_role: role,
        p_command: requireUuid(body.command_id),
        p_action: body.action,
        p_extra: id,
        p_version: body.version,
        p_data: body.data ?? {},
      });
    if (error)
      throw new ExtraError(
        error.code === "P0001"
          ? error.message
          : "Etapa não concluída. Recarregue a solicitação.",
        409,
      );
    after(async () => { try { await dispatchExtraNotifications(); } catch { console.error("Extras: fila externa pendente; nova tentativa necessária."); } });
    return Response.json(data);
  } catch (error) {
    return extraResponseError(error);
  }
}
