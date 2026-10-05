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
    const { db } = await crivoExecution(id, true);
    const b = await request.json();
    const response = await db
      .schema("mise")
      .from("checklist_responses")
      .select("id")
      .eq("id", b.response_id)
      .eq("execution_id", id)
      .single();
    if (response.error) throw new CrivoError("Resposta inválida.");
    if (b.asset_id) {
      const asset = await db
        .schema("mise")
        .from("crivo_assets")
        .select("object_path")
        .eq("id", b.asset_id)
        .eq("execution_id", id)
        .eq("kind", "foto")
        .single();
      if (asset.error) throw new CrivoError("Foto inválida.");
      const photo = await db
        .schema("mise")
        .from("crivo_response_fotos")
        .insert({
          response_id: b.response_id,
          url: asset.data.object_path,
          legenda: String(b.legenda || "").slice(0, 1000),
          ordem: 0,
        });
      if (photo.error)
        throw new CrivoError("Não foi possível guardar a legenda.", 503);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return crivoError(e);
  }
}
