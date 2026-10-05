import { crivoContext, crivoError, CrivoError } from "@/lib/crivo/access";
import { SCORING_MODELS } from "@/lib/crivo/scoring";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, session } = await crivoContext();
    if (session.role !== "admin") throw new CrivoError("Acesso restrito.", 403);
    const { id } = await params,
      b = await request.json();
    if (!SCORING_MODELS.includes(b.model) || typeof b.active !== "boolean")
      throw new CrivoError("Metodologia inválida.");
    if (b.active) {
      const items = await db
        .schema("mise")
        .from("checklist_template_items")
        .select("id,tipo_resposta")
        .eq("template_id", id);
      if (items.error || !items.data?.length)
        throw new CrivoError(
          "Cadastre os itens completos antes de ativar o template.",
        );
      if (
        b.model === "headchef_conformidade" &&
        !items.data.some((i) => i.tipo_resposta === "sim_nao")
      )
        throw new CrivoError(
          "A avaliação de conformidade exige itens Sim/Não.",
        );
    }
    const update = await db
      .schema("mise")
      .from("checklist_templates")
      .update({ scoring_model: b.model, ativo: b.active })
      .eq("id", id)
      .eq("modulo", "CRIVO")
      .select("id")
      .single();
    if (update.error) throw new CrivoError("Template indisponível.", 409);
    return Response.json({ ok: true });
  } catch (e) {
    return crivoError(e);
  }
}
