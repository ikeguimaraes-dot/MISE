import "server-only";
import {normalizeEquipmentResponses} from "./equipment";
import { crivoExecution, CrivoError } from "./access";
import {scoreCrivo} from "./scoring";
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
          "id,item_id,equipamento_id,resposta,nao_aplicavel,comentario,foto_url,orientacao_corretiva,responsavel_orientado",
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
  const normalizedResponses=normalizeEquipmentResponses(items,responses.data??[]);
  let preview: ReturnType<typeof scoreCrivo> | null = null;
  if(execution.status !== "concluido" && execution.crivo_snapshot) {
    try {preview=scoreCrivo(execution.crivo_snapshot.model,items,normalizedResponses,execution.crivo_snapshot.weights,{validateEvidence:false});} catch { /* Incomplete answers have no preview score. */ }
  }
  const previous = await db.schema("mise").from("checklist_executions").select("percentual,concluido_em,crivo_snapshot")
    .eq("unit_id",execution.unit_id).eq("template_id",execution.template_id)
    .eq("status","concluido").neq("id",id).lt("concluido_em",execution.iniciado_em)
    .match(execution.local_id ? {local_id:execution.local_id} : {}).order("concluido_em",{ascending:false}).limit(1).maybeSingle();
  if(previous.error) throw new CrivoError("Nota anterior indisponível.",503);
  return {
    ...context,
    report: {
      execution: {
        id: execution.id,
        status: execution.status,
        percentual: preview?.percentual ?? execution.percentual,
        concluido_em: execution.concluido_em,
        iniciado_em: execution.iniciado_em,
        plano_revisado_em: execution.plano_revisado_em,
        avaliador_cargo: execution.avaliador_cargo,
        geo_inicio_lat: execution.geo_inicio_lat, geo_inicio_lng: execution.geo_inicio_lng,
        geo_fim_lat: execution.geo_fim_lat, geo_fim_lng: execution.geo_fim_lng,
        agendado_para: execution.agendado_para,
        avaliador_nome: execution.avaliador_nome,
        avaliador_registro: execution.avaliador_registro,
        assinatura_avaliador_url: execution.assinatura_avaliador_url,
        responsavel_unidade_nome: execution.responsavel_unidade_nome,
        observacoes_gerais: execution.observacoes_gerais,
        report_version: execution.report_version,
      },
      previous: previous.data && (!previous.data.crivo_snapshot || previous.data.crivo_snapshot.model === execution.crivo_snapshot?.model) ? {percentual:previous.data.percentual,concluido_em:previous.data.concluido_em} : null,
      title: execution.crivo_snapshot?.nome ?? template.data.nome,
      unit: unit.data?.name ?? "",
      local: local.data?.nome ?? "",
      address: local.data?.endereco ?? "",
      model: (execution.crivo_snapshot?.model ??
        "ff_ponderado") as ScoringModel,
      legacy: !execution.crivo_snapshot,
      topics: (preview?.topicos ?? execution.crivo_result?.topicos ??
        topics.data ??
        []) as TopicScore[],
      items,
      responses: normalizedResponses,
      photos: photos.data ?? [],
      actions: context.session.role === "admin" || execution.plano_revisado_em ? actions.data ?? [] : [],
      employees: employees.data ?? [],
      canEdit: context.session.role === "admin",
    },
  };
}
export type CrivoReport = Awaited<ReturnType<typeof loadCrivoReport>>["report"];
