import "server-only";
import { crivoExecution, CrivoError } from "./access";
import type { ScoreItem, TopicScore, ScoringModel } from "./scoring";
export async function loadCrivoReport(id: string) {
  const context = await crivoExecution(id),
    { db, execution } = context;
  const [template, local, unit, responses, actions, employees, topics] =
    await Promise.all([
      db
        .schema("mise")
        .from("checklist_templates")
        .select("nome,modulo,scoring_model")
        .eq("id", execution.template_id)
        .single(),
      execution.local_id
        ? db
            .schema("mise")
            .from("crivo_locais")
            .select("nome,endereco")
            .eq("id", execution.local_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      db.from("units").select("name").eq("id", execution.unit_id).single(),
      db
        .schema("mise")
        .from("checklist_responses")
        .select(
          "id,item_id,resposta,nao_aplicavel,comentario,foto_url,orientacao_corretiva,responsavel_orientado",
        )
        .eq("execution_id", id),
      db
        .schema("mise")
        .from("crivo_plano_acao")
        .select("*")
        .eq("execution_id", id)
        .order("prazo"),
      db
        .from("employees")
        .select("id,nome")
        .eq("unit_id", execution.unit_id)
        .eq("ativo", true)
        .order("nome"),
      db
        .schema("mise")
        .from("checklist_execution_topicos")
        .select("*")
        .eq("execution_id", id)
        .order("topico_ordem"),
    ]);
  if (
    [template, unit, responses, actions, employees, topics].some((r) => r.error)
  )
    throw new CrivoError("Dados do laudo indisponíveis. Tente novamente.", 503);
  if (template.data?.modulo !== "CRIVO")
    throw new CrivoError("Esta execução não pertence ao CRIVO.", 404);
  const responseIds = (responses.data ?? []).map((r) => r.id);
  const photos = responseIds.length
    ? await db
        .schema("mise")
        .from("crivo_response_fotos")
        .select("id,response_id,url,legenda,ordem")
        .in("response_id", responseIds)
        .order("ordem")
    : { data: [], error: null };
  if (photos.error) throw new CrivoError("Fotos indisponíveis.", 503);
  let items: ScoreItem[] = execution.crivo_snapshot?.items ?? [];
  if (!execution.crivo_snapshot) {
    const legacy = await db
      .schema("mise")
      .from("checklist_template_items")
      .select("*")
      .eq("template_id", execution.template_id)
      .order("ordem");
    if (legacy.error)
      throw new CrivoError("Itens históricos indisponíveis.", 503);
    items = legacy.data;
  }
  return {
    ...context,
    report: {
      execution: {
        id: execution.id,
        status: execution.status,
        percentual: execution.percentual,
        concluido_em: execution.concluido_em,
        agendado_para: execution.agendado_para,
        avaliador_nome: execution.avaliador_nome,
        avaliador_registro: execution.avaliador_registro,
        assinatura_avaliador_url: execution.assinatura_avaliador_url,
        responsavel_unidade_nome: execution.responsavel_unidade_nome,
        observacoes_gerais: execution.observacoes_gerais,
        report_version: execution.report_version,
      },
      title: execution.crivo_snapshot?.nome ?? template.data.nome,
      unit: unit.data?.name ?? "",
      local: local.data?.nome ?? "",
      address: local.data?.endereco ?? "",
      model: (execution.crivo_snapshot?.model ??
        "ff_ponderado") as ScoringModel,
      legacy: !execution.crivo_snapshot,
      topics: (execution.crivo_result?.topicos ??
        topics.data ??
        []) as TopicScore[],
      items,
      responses: responses.data ?? [],
      photos: photos.data ?? [],
      actions: actions.data ?? [],
      employees: employees.data ?? [],
      canEdit: context.session.role === "admin",
    },
  };
}
export type CrivoReport = Awaited<ReturnType<typeof loadCrivoReport>>["report"];
