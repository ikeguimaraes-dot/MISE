export const SCORING_MODELS = [
  "ff_ponderado",
  "headchef_conformidade",
  "headchef_narrativo",
] as const;
export type ScoringModel = (typeof SCORING_MODELS)[number];
export type ScoreItem = {
  id: string;
  topico_ordem: number | null;
  topico_nome: string | null;
  tipo_resposta: string;
  opcoes?: unknown;
  peso: number | null;
  critico?: boolean;
  titulo?: string;
  requer_comentario?: string;
  requer_foto?: string;
};
export type ScoreResponse = {
  item_id: string;
  resposta: Record<string, unknown> | null;
  nao_aplicavel: boolean;
  comentario?: string | null;
  foto_url?: string | null;
};
export type TopicScore = {
  topico_ordem: number;
  topico_nome: string;
  percentual: number | null;
  peso: number;
  zerado_por_critico: boolean;
  conformes: number;
  avaliados: number;
  possivel?: number;
  obtido?: number;
};
const round = (n: number) => Math.round(n * 100) / 100;
function answered(item: ScoreItem, r: ScoreResponse | undefined) {
  if (r?.nao_aplicavel) return true;
  if (item.tipo_resposta === "texto_livre") return true;
  const a = r?.resposta;
  if (!a) return false;
  switch (item.tipo_resposta) {
    case "sim_nao":
      return ["sim", "nao"].includes(String(a.valor));
    case "assinatura":
      return !!a.assinatura;
    case "checklist_multiplo":
      return Array.isArray(a.selecionados);
    case "texto":
      return typeof a.texto === "string" && !!a.texto.trim();
    case "data":
      return !!a.data;
    default:
      return !!a.valor;
  }
}
function conforming(item: ScoreItem, r: ScoreResponse | undefined) {
  const a = r?.resposta;
  if (!a) return false;
  switch (item.tipo_resposta) {
    case "sim_nao":
      return a.valor === "sim";
    case "checklist_multiplo":
      return (
        Array.isArray(item.opcoes) &&
        item.opcoes.length > 0 &&
        Array.isArray(a.selecionados) &&
        item.opcoes.length === a.selecionados.length
      );
    case "assinatura":
      return !!a.assinatura;
    default:
      return Object.keys(a).length > 0;
  }
}
export function scoreCrivo(
  model: ScoringModel,
  items: ScoreItem[],
  responses: ScoreResponse[],
  weights: { topico_ordem: number; peso: number }[] = [],
  options: { validateEvidence?: boolean } = {},
) {
  const map = new Map(responses.map((r) => [r.item_id, r]));
  const missing = items
    .filter((i) => !answered(i, map.get(i.id)))
    .map((i) => i.id);
  if (missing.length)
    throw new Error(
      `Responda os ${missing.length} itens pendentes antes de concluir.`,
    );
  if (!items.length) throw new Error("O template não tem itens para avaliar.");
  for (const i of options.validateEvidence === false ? [] : items) {
    const r = map.get(i.id);
    if (r?.nao_aplicavel) continue;
    const no = r?.resposta?.valor === "nao";
    if (
      (["sempre", "sim"].includes(i.requer_comentario || "") ||
        (i.requer_comentario === "se_nao" && no)) &&
      !r?.comentario?.trim()
    )
      throw new Error("Há itens com comentário obrigatório pendente.");
    if (
      (["sempre", "sim"].includes(i.requer_foto || "") ||
        (i.requer_foto === "se_nao" && no)) &&
      !r?.foto_url
    )
      throw new Error("Há itens com foto obrigatória pendente.");
  }
  const topics: TopicScore[] = [];
  const ordens = [...new Set(items.map((i) => i.topico_ordem ?? 0))].sort(
    (a, b) => a - b,
  );
  let total = 0,
    obtained = 0;
  for (const ordem of ordens) {
    const group = items.filter((i) => (i.topico_ordem ?? 0) === ordem);
    const eligible = group.filter(
      (i) =>
        !map.get(i.id)?.nao_aplicavel &&
        (model === "ff_ponderado"
          ? (i.peso ?? 1) > 0
          : i.tipo_resposta === "sim_nao"),
    );
    const conformes = eligible.filter((i) =>
      conforming(i, map.get(i.id)),
    ).length;
    const critical =
      model === "ff_ponderado" &&
      group.filter(i => !map.get(i.id)?.nao_aplicavel).some(
        (i) => i.critico && map.get(i.id)?.resposta?.valor === "nao",
      );
    const weight =
      model === "ff_ponderado"
        ? Number(weights.find((t) => t.topico_ordem === ordem)?.peso ?? 1)
        : eligible.length;
    const applicablePoints = eligible.reduce((sum,i)=>sum+Number(i.peso??1),0);
    const conformingPoints = eligible.filter(i=>conforming(i,map.get(i.id))).reduce((sum,i)=>sum+Number(i.peso??1),0);
    const fraction = eligible.length
      ? critical
        ? 0
        : model === "ff_ponderado" ? conformingPoints / applicablePoints : conformes / eligible.length
      : null;
    topics.push({
      topico_ordem: ordem,
      topico_nome: group[0].topico_nome || `Tópico ${ordem}`,
      percentual:
        model === "headchef_narrativo" || fraction === null
          ? null
          : round(fraction * 100),
      peso: model === "headchef_narrativo" ? 0 : weight,
      zerado_por_critico: critical,
      conformes,
      avaliados: eligible.length,
      possivel: model === "headchef_narrativo" || fraction === null ? 0 : weight,
      obtido: model === "headchef_narrativo" || fraction === null ? 0 : round(fraction * weight),
    });
    if (fraction !== null && model !== "headchef_narrativo") {
      total += weight;
      obtained += fraction * weight;
    }
  }
  const percentual =
    model === "headchef_narrativo" || !total
      ? null
      : round((obtained / total) * 100);
  return {
    model,
    pontuacao_total: model === "headchef_narrativo" ? null : total,
    pontuacao_obtida:
      model === "headchef_narrativo"
        ? null
        : Math.round(obtained * 10000) / 10000,
    percentual,
    classificacao: classify(percentual, model),
    topicos: topics,
  };
}
export function classify(pct: number | null, model: ScoringModel): string {
  if (pct === null)
    return model === "headchef_narrativo"
      ? "Relatório descritivo"
      : "Sem itens aplicáveis";
  if (pct >= 90) return "Excelente";
  if (pct >= 75) return "Bom";
  if (pct >= 60) return "Regular";
  return pct < 50 ? "Crítico" : "Ruim";
}
