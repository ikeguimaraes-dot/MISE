import {
  extrasContext,
  requireExtraAccess,
  requireUuid,
  ExtraError,
  extraResponseError,
  EXTRA_SELECT,
  EXTRA_ROLES,
  type ExtraRole,
} from "@/lib/extras/access";
import { validDate } from "@/lib/extras/alcada";
export async function GET(request: Request) {
  try {
    const { db, grants } = await extrasContext();
    const params = new URL(request.url).searchParams;
    const unit = requireUuid(params.get("unit_id"));
    requireExtraAccess(grants, unit);
    const offset = Number(params.get("offset") || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
      throw new ExtraError("Página inválida.");
    const from = params.get("from"),
      to = params.get("to");
    if (!from || !to || !validDate(from) || !validDate(to) || from > to)
      throw new ExtraError("Período inválido.");
    const { data, error } = await db
      .from("op_extra")
      .select(EXTRA_SELECT)
      .eq("unit_id", unit)
      .gte("data_trabalho", from)
      .lte("data_trabalho", to)
      .order("data_trabalho", { ascending: false })
      .order("id")
      .range(offset, offset + 100);
    if (error)
      throw new ExtraError("Não foi possível carregar as solicitações.", 503);
    return Response.json(
      { items: data?.slice(0, 100), hasMore: (data?.length ?? 0) > 100 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return extraResponseError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db, grants, session } = await extrasContext();
    const body = await request.json();
    const unit = requireUuid(body.data?.unit_id),
      role = body.role as ExtraRole;
    if (!EXTRA_ROLES.includes(role)) throw new ExtraError("Papel inválido.");
    requireExtraAccess(grants, unit, role);
    if (!validDate(body.data?.data_trabalho ?? ""))
      throw new ExtraError("Data inválida.");
    const { data, error } = await db
      .schema("mise")
      .rpc("extra_command", {
        p_actor: session.employeeId,
        p_role: role,
        p_command: requireUuid(body.command_id),
        p_action: "solicitar",
        p_extra: requireUuid(body.id),
        p_version: 0,
        p_data: body.data,
      });
    if (error)
      throw new ExtraError(
        error.code === "P0001"
          ? error.message
          : "Não foi possível registrar. Confira os dados.",
        409,
      );
    return Response.json(data, { status: 201 });
  } catch (error) {
    return extraResponseError(error);
  }
}
