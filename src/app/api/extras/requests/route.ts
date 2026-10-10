export const maxDuration=60;
import {
  extrasContext,
  requireExtraAccess,
  requireUuid,
  ExtraError,
  extraResponseError,
  EXTRA_SELECT,
  type ExtraRole,
} from "@/lib/extras/access";
import { validDate } from "@/lib/extras/alcada";
export async function GET(request: Request) {
  try {
    const { db, grants, session } = await extrasContext();
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
    let query = db
      .from("op_extra")
      .select(EXTRA_SELECT)
      .eq("unit_id", unit)

      .order("data_trabalho", { ascending: false })
      .order("id")
      .range(offset, offset + 100);
    const role = params.get("role") as ExtraRole | null;
    if (role) requireExtraAccess(grants, unit, role);
    if (role === "lider" || !grants.some(g => g.unit_id === unit && g.role !== "lider")) query = query.eq("mise_requested_by", session.employeeId);
    if (params.get("queue") === "1") {
      if (!role) throw new ExtraError("Escolha seu papel.");
      if (role === "rh") query = query.or("status.eq.solicitado,and(status.eq.pagamento_informado,mise_rh_complete.eq.false)");
      else if (role === "financeiro") query = query.in("status", ["aprovado_rh", "pagamento_informado"]);
      else if (role === "caixa") query = query.eq("pagadora", "casa").or("status.eq.reservado_financeiro,and(emergencial.eq.true,status.in.(solicitado,aprovado_rh))");
      else if (role === "diretor") query = query.or("status.eq.aguardando_diretoria,and(emergencial.eq.true,mise_emergency_decision.is.null,status.not.in.(recusado,cancelado))");
      else query = query.not("status", "in", "(pago,cancelado,recusado)");
    } else query = query.gte("data_trabalho", from).lte("data_trabalho", to);
    const { data, error } = await query;
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
export async function POST() {
  return Response.json({ error: "O formulário foi atualizado para pedidos de posições. Recarregue a página antes de solicitar." }, { status: 409 });
}
