"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  ACTION_LABELS,
  realActions,
  validCpf,
  type OperationalRole,
  type RealExtra,
} from "@/lib/extras/workflow";
import { useWeeklyBudget } from "@/components/extras-evaluation/weekly-budget";
import { usageLevel, weekDays } from "@/lib/extras/alcada";
import "./extras-real.css";
type Unit = { id: string; name: string };
type Grant = { unit_id: string; role: OperationalRole };
type Event = {
  id: string;
  actor_role: OperationalRole;
  action: string;
  note: string | null;
  created_at: string;
};
const money = (n: number | null) => n === null ? "A definir" :
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
async function api(url: string, options?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...options });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
export function ExtrasReal({
  units,
  grants,
  employeeId,
  admin,
  initialUnit,
  initialExtra,
  initialDay,
}: {
  units: Unit[];
  grants: Grant[];
  employeeId: string;
  admin: boolean;
  initialUnit?: string;
  initialExtra?: string;
  initialDay?: string;
}) {
  const [unit, setUnit] = useState(initialUnit || units[0].id),
    [day, setDay] = useState(initialDay || today()),
    [revision, setRevision] = useState(0);
  const roles = grants.filter((g) => g.unit_id === unit).map((g) => g.role);
  const [chosenRole, setRole] = useState<OperationalRole>(roles[0]);
  const role = roles.includes(chosenRole) ? chosenRole : roles[0];
  const [items, setItems] = useState<RealExtra[]>([]),
    [selected, setSelected] = useState<string | null>(initialExtra || null),
    [detail, setDetail] = useState<{
      item: RealExtra;
      events: Event[];
      cpf: string | null;
    } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false),
    [action, setAction] = useState(""),
    [amount, setAmount] = useState(0),
    [commission, setCommission] = useState(0),
    [urgent, setUrgent] = useState(false);
  const [queue, setQueue] = useState(!initialExtra);
  const [hasMore, setHasMore] = useState(false);
  const nextPayment = useRef<string | null>(null);
  const uploadedReceipt = useRef<{ key: string; id: string } | null>(null);
  const pending = useRef<{ payload: string; key: string; id: string } | null>(
    null,
  );
  const budgetState = useWeeklyBudget(
      units.find((u) => u.id === unit),
      day,
      "review",
    ),
    budget = budgetState.budget;
  const dates = weekDays(day),
    from = dates[0],
    to = dates[6];
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    api(`/api/extras/requests?unit_id=${unit}&from=${from}&to=${to}&role=${role}&queue=${queue ? 1 : 0}`, {
      signal: controller.signal,
    })
      .then((d) => {
        setItems(d.items);
        setHasMore(d.hasMore);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [unit, from, to, role, queue, revision]);
  useEffect(() => {
    setDetail(null);
    setAction("");
    if (!selected) return;
    const controller = new AbortController();
    api(`/api/extras/requests/${selected}`, { signal: controller.signal })
      .then((d) => {
        if (d.item.unit_id === unit) {setDetail(d); if(nextPayment.current===d.item.id){setAction("informar_pagamento");nextPayment.current=null;}}
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [selected, unit, revision]);
  function refresh() {
    setRevision((v) => v + 1);
    budgetState.retry();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const data: Record<string, unknown> = Object.fromEntries(f.entries());
      delete data.file;
      let url = "/api/extras/requests",
        body: Record<string, unknown>;
      if (creating) {
        Object.assign(data, {
          unit_id: unit,
          data_trabalho: day,
          valor: data.valor === "" ? null : Number(data.valor),
          comissao: Number(data.comissao || 0),
          sequencia: Number(data.sequencia),
          emergencial: urgent || role === "caixa",
        });
        body = { role, data };
      } else {
        if (!detail) throw new Error("Selecione uma solicitação.");
        url += `/${detail.item.id}/actions`;
        if (action === "preparar_rh") {
          data.cpf = String(data.cpf).replace(/\D/g, "");
          if (!validCpf(String(data.cpf)))
            throw new Error(
              "Confira o CPF: os dígitos verificadores não conferem.",
            );
          data.valor = Number(data.valor);
          data.comissao = Number(data.comissao);
        }
        if (action === "informar_pagamento") {
          const file = f.get("file");
          if (!(file instanceof File) || !file.size)
            throw new Error("Anexe o recibo assinado.");
          if(file.size>4194304)throw new Error("Envie um recibo de até 4 MB.");
          const fileKey = `${detail.item.id}|${detail.item.mise_version}|${file.name}|${file.size}|${file.lastModified}`;
          if (uploadedReceipt.current?.key !== fileKey) {
            const upload = new FormData();
            upload.set("file", file);
            const receipt = await api(
              `/api/extras/requests/${detail.item.id}/receipts`,
              { method: "POST", body: upload },
            );
            uploadedReceipt.current = { key: fileKey, id: receipt.id };
          }
          data.receipt_id = uploadedReceipt.current.id;
        }
        body = { role, action, version: detail.item.mise_version, data };
      }
      const signature = JSON.stringify({ url, body });
      if (pending.current?.payload !== signature)
        pending.current = {
          payload: signature,
          key: crypto.randomUUID(),
          id: crypto.randomUUID(),
        };
      const result = await api(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          command_id: pending.current.key,
          ...(creating ? { id: pending.current.id } : {}),
        }),
      });
      pending.current = null;
      if(creating && role === "caixa") nextPayment.current=result.id;
      setSelected(result.id);
      setCreating(false);
      setAction("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar.");
    } finally {
      setBusy(false);
    }
  }
  const item = detail?.item,
    actions = item ? realActions(item, role, employeeId) : [],
    level = budget ? usageLevel(budget) : null;
  return (
    <main className="er">
      <header className="er-heading">
        <div>
          <p className="er-eyebrow">OPERAÇÃO · PESSOAS</p>
          <h1>Controle de Extras</h1>
          <p>Da necessidade da casa ao pagamento conferido.</p>
        </div>
        <nav>
          {admin && <Link href="/extras/acessos">Gerenciar acessos</Link>}
          <Link href={`/extras/relatorios?unit_id=${unit}`}>Relatórios</Link>
          {["rh", "financeiro", "caixa"].includes(role) && <Link href={`/extras/envio-caixa?unit_id=${unit}&data=${day}`}>Envio Caixa</Link>}
          <Link href="/extras/avaliacao">Ambiente de avaliação</Link>
        </nav>
      </header>
      <div className="er-filters">
        <label>
          Casa
          <select
            value={unit}
            disabled={busy}
            onChange={(e) => {
              setUnit(e.target.value);
              setSelected(null);
              setCreating(false);
            }}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data de referência
          <input
            type="date"
            required
            value={day}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        </label>
        <label>
          Seu papel
          <select
            value={role}
            disabled={busy}
            onChange={(e) => {
              setRole(e.target.value as OperationalRole);
              setCreating(false);
              setAction("");
            }}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        {["lider", "caixa"].includes(role) && (
          <button
            disabled={busy}
            onClick={() => {
              setCreating(true);
              setAmount(0);
              setCommission(0);
              setUrgent(role === "caixa");
              setError("");
            }}
          >
            Solicitar extra
          </button>
        )}
      </div>
      <label className="er-check"><input type="checkbox" checked={queue} onChange={e => setQueue(e.target.checked)} /> Minha fila pendente · inclui outras semanas</label>
      <section className="er-budget" aria-label="Alçada semanal">
        <strong>
          Semana {from.split("-").reverse().slice(0, 2).join("/")}–
          {to.split("-").reverse().slice(0, 2).join("/")}
        </strong>
        {budget ? (
          <>
            <div className="er-values">
              <span>
                Alçada <b>{money(budget.teto / 100)}</b>
              </span>
              <span>
                Usado <b>{money(budget.gasto / 100)}</b>
              </span>
              <span>
                Saldo <b>{money(budget.saldo / 100)}</b>
              </span>
            </div>
            <progress
              aria-label="Consumo da alçada"
              className={`is-${level?.tone}`}
              max={100}
              value={Math.min(100, level?.percentage ?? 100)}
            />
            <small>
              {level?.percentage ?? "Sem teto"}
              {level?.percentage !== null ? "%" : ""} ·{" "}
              {budget.percentual ?? "Sem configuração"}% · saldo não acumula
            </small>
            {budget.avisos.map((a) => (
              <p key={a} role="status">
                {a}
              </p>
            ))}
          </>
        ) : (
          <p>
            {budgetState.error || "Consultando alçada…"}{" "}
            {budgetState.error && (
              <button onClick={budgetState.retry}>Tentar novamente</button>
            )}
          </p>
        )}
      </section>
      {error && (
        <p className="er-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            Recarregar
          </button>
        </p>
      )}
      {creating ? (
        <section className="er-panel">
          <h2>
            {role === "caixa" ? "Registrar emergência" : "Nova solicitação"}
          </h2>
          {role === "caixa" && <p>1. Identifique a emergência. 2. Anexe o recibo assinado e registre o pagamento. A diretoria revisa depois.</p>}
          <form onSubmit={submit} className="er-form">
            <label>
              Setor
              <select name="setor" required><option value="">Selecione</option>{["Bar", "Caixa", "Cozinha Meet", "Cozinha Produção", "Parrilla", "Portaria", "Salão", "Limpeza"].map(s => <option key={s}>{s}</option>)}</select>
            </label>
            <label>
              Função
              <input name="funcao" required maxLength={150} />
            </label>
            <label>
              Motivo
              <select name="motivo">
                <option value="falta_atestado">Falta / atestado</option>
                <option value="vaga_aberta">Vaga aberta</option>
                <option value="teste_vaga">Teste de vaga</option>
                <option value="evento">Evento</option>
                <option value="folga">Folga</option>
              </select>
            </label>
            <label>
              Período
              <select name="periodo">
                <option value="almoco">Almoço</option>
                <option value="jantar">Jantar</option>
                <option value="manha">Manhã</option>
                <option value="eventos">Eventos</option>
              </select>
            </label>
            <label>
              Sequência
              <input
                name="sequencia"
                type="number"
                min="1"
                max="20"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Diária estimada (se conhecida)
              <input
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                required={urgent}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            {!urgent && <p>Sem estimativa, o RH define o valor e a alçada é verificada antes da liberação.</p>}
            <label>
              Comissão
              <input
                name="comissao"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                onChange={(e) => setCommission(Number(e.target.value))}
              />
            </label>
            <label>
              Pessoa {urgent ? "(obrigatório)" : "(se já definida)"}
              <input name="nome" required={urgent} maxLength={200} />
            </label>
            <label className="er-wide">
              Contexto da necessidade
              <textarea name="motivo_detalhe" required maxLength={2000} />
            </label>
            <label className="er-wide er-check">
              <input
                type="checkbox"
                checked={urgent}
                disabled={role === "caixa"}
                onChange={(e) => setUrgent(e.target.checked)}
              />{" "}
              Emergencial · alerta imediato à diretoria
            </label>
            {budget &&
              Math.round((amount + commission) * 100) > budget.saldo && (
                <p className="er-wide" role="status">
                  Esta solicitação excede a alçada da semana em{" "}
                  {money(amount + commission - budget.saldo / 100)}.{" "}
                  {urgent
                    ? "A exceção ficará registrada e a diretoria será alertada."
                    : "Será enviada para aprovação do Diretor de Operação."}
                </p>
              )}
            <div className="er-wide er-buttons">
              <button disabled={busy}>
                {busy ? "Registrando…" : role === "caixa" ? "Continuar para recibo e pagamento" : "Registrar solicitação"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Voltar
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="er-grid">
          <section className="er-panel er-list">
            <h2>Acompanhar solicitações</h2>
            <p>
              {loading
                ? "Carregando…"
                : `${items.length} registros ${queue ? "na sua fila" : "nesta semana"}`}
            </p>
            {!loading && !items.length && (
              <p>Nenhuma solicitação neste período.</p>
            )}
            {items.map((e) => (
              <button
                key={e.id}
                disabled={busy}
                className={selected === e.id ? "selected" : ""}
                onClick={() => setSelected(e.id)}
              >
                <small>
                  {STATUS_LABELS[e.status] || e.status}
                  {e.emergencial ? " · Emergencial" : ""}
                </small>
                <strong>{e.nome || e.funcao}</strong>
                <span>
                  {e.setor} · {e.data_trabalho.split("-").reverse().join("/")}
                </span>
                <b>{money(e.total)}</b>
              </button>
            ))}
            {hasMore && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await api(
                      `/api/extras/requests?unit_id=${unit}&from=${from}&to=${to}&role=${role}&queue=${queue ? 1 : 0}&offset=${items.length}`,
                    );
                    setItems((prev) => [...prev, ...d.items]);
                    setHasMore(d.hasMore);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Carregar mais solicitações
              </button>
            )}
          </section>
          <section className="er-panel">
            {item ? (
              <>
                <p className="er-eyebrow">
                  {STATUS_LABELS[item.status] || item.status}
                </p>
                <h2>{item.nome || "Pessoa a definir pelo RH"}</h2>
                <p>
                  {item.funcao} · {item.setor}
                </p>
                <p>
                  {item.data_trabalho.split("-").reverse().join("/")} ·{" "}
                  {item.periodo} · sequência {item.sequencia ?? "—"}
                </p>
                <blockquote>{item.motivo_detalhe}</blockquote>
                <div className="er-values">
                  <span>
                    Pagadora{" "}
                    <b>
                      {item.pagadora === "terceirizada"
                        ? "Estaff / terceirizada"
                        : "Casa"}
                    </b>
                  </span>
                  <span>
                    Total <b>{money(item.total)}</b>
                  </span>
                </div>
                {!item.mise_managed && (
                  <p>
                    Registro de outro fluxo. Alterações são feitas no sistema de
                    origem.
                  </p>
                )}
                {detail?.cpf && ["rh", "financeiro", "caixa"].includes(role) && <p>CPF: {detail.cpf}</p>}
                {item.emergencial && (
                  <p>
                    Emergência registrada. Diretoria: {item.mise_emergency_decision === "aprovado" ? "aprovada" : item.mise_emergency_decision === "nao_ratificado" ? "não aprovada; pagamento preservado no histórico" : "aprovação posterior pendente"}.
                  </p>
                )}
                {item.mise_receipt_id && ["rh", "financeiro", "caixa"].includes(role) && (
                  <button
                    onClick={async () => {
                      try {
                        const r = await api(
                          `/api/extras/requests/${item.id}/receipts`,
                        );
                        window.open(r.url, "_blank", "noopener,noreferrer");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Abrir recibo
                  </button>
                )}
                {!action ? (
                  <div className="er-buttons">
                    {actions.map((a) => (
                      <button
                        key={a}
                        disabled={busy}
                        onClick={() => setAction(a)}
                      >
                        {ACTION_LABELS[a]}
                      </button>
                    ))}
                    {!actions.length && (
                      <p>
                        Nenhuma ação disponível para {ROLE_LABELS[role]} nesta
                        etapa.
                      </p>
                    )}
                  </div>
                ) : (
                  <form
                    key={`${item.id}-${action}-${item.mise_version}`}
                    className="er-form"
                    onSubmit={submit}
                  >
                    <h3 className="er-wide">{ACTION_LABELS[action]}</h3>
                    {action === "preparar_rh" && (
                      <>
                        <label>
                          Nome
                          <input
                            name="nome"
                            defaultValue={item.nome || ""}
                            required
                          />
                        </label>
                        <label>
                          CPF
                          <input
                            name="cpf"
                            defaultValue={detail?.cpf || ""}
                            inputMode="numeric"
                            required
                            maxLength={14}
                          />
                        </label>
                        <label>
                          Diária
                          <input
                            name="valor"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={item.valor ?? ""}
                            readOnly={item.status === "pagamento_informado"}
                            required
                          />
                        </label>
                        <label>
                          Comissão
                          <input
                            name="comissao"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={item.comissao}
                            readOnly={item.status === "pagamento_informado"}
                            required
                          />
                        </label>
                        <label>
                          Pagadora
                          <select name="pagadora" defaultValue={item.pagadora}>
                            {(item.status === "pagamento_informado"
                              ? [item.pagadora]
                              : ["casa", "terceirizada"]
                            ).map((p) => (
                              <option key={p} value={p}>
                                {p === "casa"
                                  ? "Casa"
                                  : "Estaff / terceirizada"}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    {action === "informar_pagamento" && (
                      <>
                        <label>
                          Data do pagamento
                          <input
                            name="pago_em"
                            type="date"
                            defaultValue={today()}
                            max={today()}
                            required
                          />
                        </label>
                        <label>
                          Recibo assinado (até 4 MB)
                          <input
                            name="file"
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            required
                          />
                        </label>
                      </>
                    )}
                    <label className="er-wide">
                      {["aprovar", "recusar", "cancelar", "ratificar_emergencia", "nao_ratificar_emergencia"].includes(action)
                        ? "Justificativa obrigatória"
                        : "Observação"}
                      <textarea
                        name="note"
                        required={["aprovar", "recusar", "cancelar", "ratificar_emergencia", "nao_ratificar_emergencia"].includes(
                          action,
                        )}
                        maxLength={2000}
                      />
                    </label>
                    <div className="er-wide er-buttons">
                      <button disabled={busy}>
                        {busy ? "Salvando…" : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setAction("")}
                      >
                        Voltar
                      </button>
                    </div>
                  </form>
                )}
                <h3>Histórico do processo</h3>
                <ol className="er-history">
                  {detail.events.map((e) => (
                    <li key={e.id}>
                      <strong>
                        {ACTION_LABELS[e.action] || "Solicitação registrada"}
                      </strong>
                      <p>
                        {ROLE_LABELS[e.actor_role]} ·{" "}
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </p>
                      {e.note && <p>{e.note}</p>}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p>
                {selected
                  ? "Carregando detalhes…"
                  : "Selecione uma solicitação para ver os detalhes e as próximas etapas."}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
