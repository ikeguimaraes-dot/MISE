import "server-only";
import { getMiseSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
export class CrivoError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function crivoContext() {
  const session = await getMiseSession();
  if (!session) throw new CrivoError("Entre para continuar.", 401);
  const db = createServiceClient();
  const employee = await db
    .from("employees")
    .select("ativo,unit_id")
    .eq("id", session.employeeId)
    .single();
  if (employee.error || !employee.data?.ativo)
    throw new CrivoError("Acesso indisponível.", 403);
  return { db, session, unitId: employee.data.unit_id as string };
}
export async function crivoExecution(id: string, write = false) {
  const ctx = await crivoContext();
  const result = await ctx.db
    .schema("mise")
    .from("checklist_executions")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error || !result.data)
    throw new CrivoError("Visita não encontrada.", 404);
  const template = await ctx.db
    .schema("mise")
    .from("checklist_templates")
    .select("modulo")
    .eq("id", result.data.template_id)
    .single();
  if (template.error) throw new CrivoError("Template indisponível.", 503);
  const isCrivo = template.data.modulo === "CRIVO";
  if (
    ctx.session.role !== "admin" &&
    (ctx.unitId !== result.data.unit_id ||
      (isCrivo && (write || ctx.session.role !== "gerente")))
  )
    throw new CrivoError("Sem acesso a esta visita.", 403);
  return { ...ctx, execution: result.data };
}
export function crivoError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof CrivoError
          ? error.message
          : "Não foi possível concluir a operação.",
    },
    { status: error instanceof CrivoError ? error.status : 500 },
  );
}
