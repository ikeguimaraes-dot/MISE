import { crivoExecution, crivoError, CrivoError } from "@/lib/crivo/access";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, execution } = await crivoExecution(id, true);
    const b = await request.json();
    if (!Number.isInteger(b.version))
      throw new CrivoError("Versão obrigatória.");
    const data: Record<string, unknown> = { report_version: b.version + 1 };
    for (const key of [
      "avaliador_nome",
      "avaliador_registro",
      "avaliador_cargo",
      "responsavel_unidade_nome",
      "observacoes_gerais",
    ])
      if (typeof b[key] === "string")
        data[key] = b[key].slice(0, key === "observacoes_gerais" ? 10000 : 200);
    if (b.signature_id) {
      const asset = await db
        .schema("mise")
        .from("crivo_assets")
        .select("object_path")
        .eq("id", b.signature_id)
        .eq("execution_id", id)
        .eq("kind", "assinatura")
        .single();
      if (asset.error) throw new CrivoError("Assinatura inválida.");
      data.assinatura_avaliador_url = asset.data.object_path;
    }
    const update = await db
      .schema("mise")
      .from("checklist_executions")
      .update(data)
      .eq("id", execution.id)
      .eq("report_version", b.version)
      .select("id")
      .maybeSingle();
    if (update.error || !update.data)
      throw new CrivoError(
        "Laudo atualizado por outra pessoa. Recarregue.",
        409,
      );
    return Response.json({ ok: true });
  } catch (e) {
    return crivoError(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, session } = await crivoExecution(id, true);
    const b = await request.json();
    let response = db.schema("mise").from("checklist_responses").select("id").eq("execution_id",id);
    response = b.response_id ? response.eq("id",b.response_id) : response.eq("item_id",b.item_id);
    const selected=await response.single();
    if(selected.error)throw new CrivoError("Salve a resposta antes de anexar fotos.");
    const result=await db.schema("mise").rpc("crivo_response_media",{p_actor:session.employeeId,p_execution:id,p_response:selected.data.id,p_data:b});
    if(result.error)throw new CrivoError(result.error.code==="P0001"?result.error.message:"Não foi possível salvar a foto/orientação.",409);
    return Response.json(result.data);
  } catch (e) {
    return crivoError(e);
  }
}
