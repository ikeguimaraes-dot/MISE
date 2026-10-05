import {
  extrasContext,
  requireExtraRead,
  requireExtraAccess,
  requireUuid,
  ExtraError,
  extraResponseError,
  EXTRA_SELECT,
} from "@/lib/extras/access";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, grants, session } = await extrasContext();
    const { id } = await params;
    requireUuid(id);
    const item = await db
      .from("op_extra")
      .select(EXTRA_SELECT)
      .eq("id", id)
      .single();
    if (item.error || !item.data)
      throw new ExtraError("Solicitação não encontrada.", 404);
    requireExtraRead(grants, item.data.unit_id, item.data.mise_requested_by, session.employeeId);
    const events = await db
      .schema("mise")
      .from("extra_events")
      .select(
        "id,actor_role,action,from_status,to_status,note,allowance,created_at",
      )
      .eq("extra_id", id)
      .order("created_at");
    if (events.error) throw new ExtraError("Histórico indisponível.", 503);
    let cpf: string | null = null;
    if (
      grants.some(
        (g) =>
          g.unit_id === item.data.unit_id &&
          ["rh", "financeiro", "caixa"].includes(g.role),
      )
    ) {
      const identity = await db
        .from("op_extra")
        .select("cpf")
        .eq("id", id)
        .single();
      if (identity.error)
        throw new ExtraError("Identificação indisponível.", 503);
      cpf = identity.data.cpf;
    }
    return Response.json(
      { item: item.data, events: events.data, cpf },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return extraResponseError(error);
  }
}
