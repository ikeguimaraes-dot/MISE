export type OperationalRole =
  | "lider"
  | "rh"
  | "diretor"
  | "financeiro"
  | "caixa";
export const ROLE_LABELS: Record<OperationalRole, string> = {
  lider: "Líder",
  rh: "RH",
  diretor: "Diretor de Operação",
  financeiro: "Financeiro",
  caixa: "Caixa",
};
export const STATUS_LABELS: Record<string, string> = {
  solicitado: "RH · completar cadastro",
  aguardando_diretoria: "Diretoria · aprovação",
  aprovado_rh: "Financeiro · reserva",
  reservado_financeiro: "Liberado para pagamento",
  pagamento_informado: "Pagamento informado · conferência",
  pago: "Pago e conferido",
  recusado: "Recusado",
  cancelado: "Cancelado",
};
export const ACTION_LABELS: Record<string, string> = {
  aprovar: "Aprovar solicitação",
  recusar: "Recusar solicitação",
  cancelar: "Cancelar solicitação",
  preparar_rh: "Completar cadastro",
  reservar: "Reservar / liberar",
  informar_pagamento: "Informar pagamento",
  conferir: "Conferir e encerrar",
};
export type RealExtra = {
  id: string;
  unit_id: string;
  data_trabalho: string;
  data_solicitacao: string;
  setor: string;
  funcao: string;
  motivo: string;
  motivo_detalhe: string;
  nome: string | null;
  valor: number;
  comissao: number;
  total: number;
  pagadora: string;
  status: string;
  emergencial: boolean;
  periodo: string | null;
  sequencia: number | null;
  pago_em: string | null;
  mise_requested_by: string | null;
  mise_version: number;
  mise_rh_complete: boolean;
  mise_receipt_id: string | null;
  mise_stage_at: string | null;
  mise_managed: boolean;
  mise_allowance_snapshot: Record<string, unknown> | null;
};
export function realActions(
  item: RealExtra,
  role: OperationalRole,
  employeeId: string,
): string[] {
  if (
    !item.mise_managed ||
    ["pago", "recusado", "cancelado"].includes(item.status)
  )
    return [];
  const actions: string[] = [];
  if (
    role === "lider" &&
    item.mise_requested_by === employeeId &&
    ["solicitado", "aguardando_diretoria"].includes(item.status)
  )
    actions.push("cancelar");
  if (role === "diretor" && item.status === "aguardando_diretoria")
    actions.push("aprovar", "recusar");
  if (
    role === "rh" &&
    (item.status === "solicitado" ||
      (item.status === "pagamento_informado" && !item.mise_rh_complete))
  )
    actions.push("preparar_rh");
  if (role === "financeiro" && item.status === "aprovado_rh")
    actions.push("reservar");
  if (
    role === (item.pagadora === "terceirizada" ? "financeiro" : "caixa") &&
    (item.status === "reservado_financeiro" ||
      (item.emergencial && ["solicitado", "aprovado_rh"].includes(item.status)))
  )
    actions.push("informar_pagamento");
  if (
    role === "financeiro" &&
    item.status === "pagamento_informado" &&
    item.mise_rh_complete &&
    item.mise_receipt_id
  )
    actions.push("conferir");
  return actions;
}
export function validCpf(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const digit = (sum * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(d[n])) return false;
  }
  return true;
}
