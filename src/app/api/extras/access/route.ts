import { getMiseSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import {
  requireUuid,
  EXTRA_ROLES,
  ExtraError,
  extraResponseError,
} from "@/lib/extras/access";
export async function POST(request: Request) {
  try {
    const session = await getMiseSession();
    if (!session || session.role !== "admin")
      throw new ExtraError("Acesso restrito à administração.", 403);
    const body = await request.json();
    if (!EXTRA_ROLES.includes(body.role) || typeof body.enabled !== "boolean")
      throw new ExtraError("Papel inválido.");
    const { error } = await createServiceClient()
      .schema("mise")
      .rpc("extra_access_set", {
        p_admin: session.employeeId,
        p_employee: requireUuid(body.employee_id),
        p_unit: requireUuid(body.unit_id),
        p_role: body.role,
        p_enabled: body.enabled,
      });
    if (error)
      throw new ExtraError(
        error.code === "P0001"
          ? error.message
          : "Não foi possível configurar o acesso.",
        400,
      );
    return Response.json({ ok: true });
  } catch (error) {
    return extraResponseError(error);
  }
}
