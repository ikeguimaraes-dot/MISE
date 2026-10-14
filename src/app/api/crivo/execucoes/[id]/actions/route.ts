import { crivoExecution, crivoError, CrivoError } from "@/lib/crivo/access";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, session } = await crivoExecution(id);
    const b = await request.json();
    const result = await db
      .schema("mise")
      .rpc("crivo_action_save", {
        p_actor: session.employeeId,
        p_id: b.id,
        p_execution: id,
        p_version: b.version ?? 0,
        p_data: b.data,
      });
    if (result.error)
      throw new CrivoError(
        result.error.code === "P0001"
          ? result.error.message
          : "Não foi possível salvar a ação.",
        409,
      );
    return Response.json({ ok: true });
  } catch (e) {
    return crivoError(e);
  }
}
