"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CrivoReport } from "@/lib/crivo/report";
import { classify } from "@/lib/crivo/scoring";
import "./report.css";
const models = {
  ff_ponderado: "FF Nutri · tópicos ponderados",
  headchef_conformidade: "HeadChef · conformidade simples",
  headchef_narrativo: "HeadChef · relatório descritivo",
};
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || "Não foi possível concluir.");
  return b;
}
export function CrivoReportClient({ report: r }: { report: CrivoReport }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("laudo"),
    [editing, setEditing] = useState<string | null>(null),
    [response, setResponse] = useState("");
  const base = `/api/crivo/execucoes/${r.execution.id}`;
  const selected = r.actions.find((a) => a.id === editing);
  async function upload(file: File, kind: string) {
    if(file.size>4194304)throw new Error("Envie um arquivo de até 4 MB.");
    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    return api(`${base}/assets`, { method: "POST", body: data });
  }
  async function save(event: FormEvent<HTMLFormElement>, target: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data: Record<string, unknown> = Object.fromEntries(form.entries());
      delete data.file;
      if (target === "metadata") {
        const file = form.get("file");
        if (file instanceof File && file.size)
          data.signature_id = (await upload(file, "assinatura")).id;
        await api(`${base}/report`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            version: r.execution.report_version,
          }),
        });
      }
      if (target === "action") {
        const file = form.get("file");
        if (file instanceof File && file.size)
          data.asset_id = (await upload(file, "evidencia")).id;
        if (!data.response_id) delete data.response_id;
        await api(`${base}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected?.id || crypto.randomUUID(),
            version: selected?.version || 0,
            data,
          }),
        });
        setEditing(null);
        setResponse("");
      }
      if (target === "photo") {
        const file = form.get("file");
        if (!(file instanceof File) || !file.size)
          throw new Error("Selecione uma foto.");
        const asset = await upload(file, "foto");
        await api(`${base}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, asset_id: asset.id }),
        });
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openAsset(path: string) {
    try {
      const b = await api(`${base}/assets?path=${encodeURIComponent(path)}`);
      window.open(b.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="cr">
      <header className="cr-heading">
        <div>
          <Link href="/crivo/relatorios">← Relatórios</Link>
          <p className="cr-kicker">CRIVO · {models[r.model]}</p>
          <h1>{r.title}</h1>
          <p>
            {r.unit} {r.local && `/ ${r.local}`} ·{" "}
            {(r.execution.concluido_em || r.execution.agendado_para || "")
              .slice(0, 10)
              .split("-")
              .reverse()
              .join("/")}
          </p>
        </div>
        <a
          className="cr-button"
          href={`${base}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          Baixar laudo PDF
        </a>
      </header>
      {r.legacy && (
        <p className="cr-notice">
          Visita anterior ao versionamento de templates. A nota original foi
          preservada; a descrição dos itens usa o cadastro disponível.
        </p>
      )}
      {r.execution.status !== "concluido" && (
        <p className="cr-notice">
          Laudo em elaboração · visita ainda não concluída.
        </p>
      )}
      <nav className="cr-tabs" aria-label="Conteúdo da visita">
        <button aria-pressed={tab === "laudo"} onClick={() => setTab("laudo")}>
          Laudo
        </button>
        <button aria-pressed={tab === "plano"} onClick={() => setTab("plano")}>
          Plano de ação ·{" "}
          {
            r.actions.filter(
              (a) => !["resolvido", "cancelado"].includes(a.status),
            ).length
          }{" "}
          abertos
        </button>
      </nav>
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {tab === "laudo" ? (
        <>
          <div className="cr-overview">
            <section className="cr-card">
              <p>Resultado da visita</p>
              <strong className="cr-score">
                {r.execution.percentual === null
                  ? "Descritivo"
                  : `${Number(r.execution.percentual).toFixed(2)}%`}
              </strong>
              <p>{classify(r.execution.percentual, r.model)}</p>
              <p>
                {r.model === "headchef_narrativo"
                  ? "Observações, registros fotográficos e orientações corretivas."
                  : r.model === "headchef_conformidade"
                    ? "Conformes / itens aplicáveis. Sem pesos por tópico ou penalização de item crítico."
                    : "Média ponderada dos tópicos. Uma não conformidade crítica zera o tópico correspondente."}
              </p>
            </section>
            <section className="cr-card">
              <h2>Resumo por tópico</h2>
              {r.topics.map((t) => (
                <div className="cr-topic" key={t.topico_ordem}>
                  <span>{t.topico_nome}</span>
                  <b>
                    {t.percentual === null
                      ? "Descritivo"
                      : `${Number(t.percentual).toFixed(1)}%`}
                  </b>
                  {t.percentual !== null && (
                    <progress
                      max="100"
                      value={t.percentual}
                      aria-label={t.topico_nome}
                    />
                  )}
                  {t.zerado_por_critico && (
                    <small>Nota zerada por item crítico</small>
                  )}
                </div>
              ))}
            </section>
          </div>
          <section className="cr-card">
            <h2>Identificação e parecer</h2>
            {r.canEdit ? (
              <form className="cr-form" onSubmit={(e) => save(e, "metadata")}>
                <label>
                  Auditor / consultor
                  <input
                    name="avaliador_nome"
                    defaultValue={r.execution.avaliador_nome || ""}
                    required
                  />
                </label>
                <label>
                  Registro profissional
                  <input
                    name="avaliador_registro"
                    defaultValue={r.execution.avaliador_registro || ""}
                  />
                </label>
                <label>
                  Responsável pela unidade
                  <input
                    name="responsavel_unidade_nome"
                    defaultValue={r.execution.responsavel_unidade_nome || ""}
                  />
                </label>
                <label>
                  Assinatura do auditor (PNG ou JPEG)
                  <input
                    name="file"
                    type="file"
                    accept="image/png,image/jpeg"
                  />
                  {r.execution.assinatura_avaliador_url && (
                    <small>Assinatura anexada</small>
                  )}
                </label>
                <label className="cr-wide">
                  Parecer / resumo executivo
                  <textarea
                    name="observacoes_gerais"
                    defaultValue={r.execution.observacoes_gerais || ""}
                    rows={5}
                  />
                </label>
                <button disabled={busy}>
                  {busy ? "Salvando…" : "Salvar identificação e parecer"}
                </button>
              </form>
            ) : (
              <>
                <p>
                  {r.execution.avaliador_nome || "Auditor não informado"} ·{" "}
                  {r.execution.avaliador_registro}
                </p>
                <p>
                  {r.execution.observacoes_gerais ||
                    "Parecer ainda não preenchido."}
                </p>
              </>
            )}
          </section>
          <section className="cr-card">
            <h2>Constatações e registros fotográficos</h2>
            {r.responses.map((answer) => {
              const item = r.items.find((i) => i.id === answer.item_id),
                photos = r.photos.filter((p) => p.response_id === answer.id);
              return (
                <article className="cr-finding" key={answer.id}>
                  <p className="cr-kicker">{item?.topico_nome}</p>
                  <h3>{item?.titulo || "Item da visita"}</h3>
                  <p>
                    {answer.nao_aplicavel
                      ? "Não aplicável"
                      : answer.resposta?.valor === "nao"
                        ? "Não conforme"
                        : answer.resposta?.valor === "sim"
                          ? "Conforme"
                          : String(
                              answer.resposta?.texto || "Registro descritivo",
                            )}
                  </p>
                  {answer.comentario && <p>{answer.comentario}</p>}
                  {answer.orientacao_corretiva && (
                    <p>Orientação: {answer.orientacao_corretiva}</p>
                  )}
                  {answer.foto_url && <p>Foto da inspeção incluída no PDF.</p>}
                  {photos.map((p) => (
                    <div key={p.id} className="cr-photo">
                      <button type="button" onClick={() => openAsset(p.url)}>
                        Abrir foto
                      </button>
                      <span>{p.legenda || "Sem legenda"}</span>
                    </div>
                  ))}
                  {r.canEdit && (
                    <>
                      <button
                        onClick={() => {
                          setTab("plano");
                          setEditing("new");
                          setResponse(answer.id);
                        }}
                      >
                        Criar ação para este item
                      </button>
                      <details>
                        <summary>Anexar foto com legenda</summary>
                        <form
                          className="cr-form"
                          onSubmit={(e) => save(e, "photo")}
                        >
                          <input
                            type="hidden"
                            name="response_id"
                            value={answer.id}
                          />
                          <label>
                            Foto
                            <input
                              name="file"
                              type="file"
                              accept="image/png,image/jpeg"
                              required
                            />
                          </label>
                          <label>
                            Legenda
                            <input name="legenda" required maxLength={1000} />
                          </label>
                          <button disabled={busy}>Anexar foto</button>
                        </form>
                      </details>
                    </>
                  )}
                </article>
              );
            })}
          </section>
        </>
      ) : (
        <section className="cr-card">
          <div className="cr-heading">
            <div>
              <h2>Plano de ação</h2>
              <p>Responsável, prazo e evidência para cada correção.</p>
            </div>
            {r.canEdit && (
              <button
                onClick={() => {
                  setEditing("new");
                  setResponse("");
                }}
              >
                Adicionar ação
              </button>
            )}
          </div>
          {editing && (
            <form
              key={editing}
              className="cr-form cr-action-form"
              onSubmit={(e) => save(e, "action")}
            >
              <input
                type="hidden"
                name="response_id"
                value={selected?.response_id || response}
              />
              <label className="cr-wide">
                O que precisa ser corrigido
                <textarea
                  name="descricao"
                  required
                  defaultValue={
                    selected?.descricao ||
                    (response
                      ? r.items.find(
                          (i) =>
                            i.id ===
                            r.responses.find((a) => a.id === response)?.item_id,
                        )?.titulo
                      : "") ||
                    ""
                  }
                  readOnly={!r.canEdit}
                />
              </label>
              <label className="cr-wide">
                Orientação corretiva
                <textarea
                  name="orientacao"
                  required
                  defaultValue={
                    selected?.orientacao ||
                    r.responses.find((a) => a.id === response)
                      ?.orientacao_corretiva ||
                    ""
                  }
                  readOnly={!r.canEdit}
                />
              </label>
              <label>
                Responsável
                <select
                  name="responsavel_employee_id"
                  defaultValue={selected?.responsavel_employee_id || ""}
                  required
                  disabled={!r.canEdit}
                >
                  <option value="">Selecione</option>
                  {r.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo
                <input
                  name="prazo"
                  type="date"
                  required
                  defaultValue={selected?.prazo || ""}
                  readOnly={!r.canEdit}
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={selected?.status || "aberto"}
                >
                  <option value="aberto">Aberto</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="resolvido">Resolvido · exige evidência</option>
                  {r.canEdit && (
                    <option value="cancelado">
                      Cancelado · exige justificativa
                    </option>
                  )}
                </select>
              </label>
              <label>
                Evidência (PDF, PNG ou JPEG)
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                />
              </label>
              <label className="cr-wide">
                Justificativa / observação
                <textarea name="note" />
              </label>
              <div className="cr-wide cr-buttons">
                <button disabled={busy}>
                  {busy ? "Salvando…" : "Salvar ação"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
          {!r.actions.length && (
            <p>
              Nenhuma ação cadastrada. Use as constatações do laudo para definir
              as correções.
            </p>
          )}
          {r.actions.map((a) => (
            <article key={a.id} className="cr-finding">
              <p className="cr-kicker">
                {a.status.replaceAll("_", " ")}
                {!["resolvido", "cancelado"].includes(a.status) &&
                a.prazo &&
                a.prazo < new Date().toISOString().slice(0, 10)
                  ? " · PRAZO VENCIDO"
                  : ""}
              </p>
              <h3>{a.descricao}</h3>
              <p>{a.orientacao}</p>
              <p>
                {a.responsavel_nome || "Sem responsável"} · prazo{" "}
                {a.prazo?.split("-").reverse().join("/") || "não definido"}
              </p>
              <div className="cr-buttons">
                <button onClick={() => setEditing(a.id)}>Atualizar ação</button>
                {a.evidencia_url && (
                  <button onClick={() => openAsset(a.evidencia_url)}>
                    Abrir evidência
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
