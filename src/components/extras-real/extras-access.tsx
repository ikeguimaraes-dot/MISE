"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ROLE_LABELS, type OperationalRole } from "@/lib/extras/workflow";
import "./extras-real.css";
type Grant = { employee_id: string; unit_id: string; role: string };
export function ExtrasAccess({
  people,
  units,
  initial,
}: {
  people: { id: string; nome: string; unit_id: string | null }[];
  units: { id: string; name: string }[];
  initial: Grant[];
}) {
  const [grants, setGrants] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function change(grant: Grant, enabled: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/extras/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...grant, enabled }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setGrants((prev) => [
        ...prev.filter(
          (g) =>
            !(
              g.employee_id === grant.employee_id &&
              g.unit_id === grant.unit_id &&
              g.role === grant.role
            ),
        ),
        ...(enabled ? [grant] : []),
      ]);
      setMessage("Acesso atualizado.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void change(
      {
        employee_id: String(f.get("employee_id")),
        unit_id: String(f.get("unit_id")),
        role: String(f.get("role")),
      },
      true,
    );
  }
  return (
    <section className="er er-access">
      <Link className="er-back-link" href="/extras">← Voltar para Extras</Link>
      <h1 className="er-access-title">Acessos de Extras</h1>
      <p>
        Cada atribuição libera ações reais naquela unidade. O papel Líder exige
        vínculo com a própria casa.
      </p>
      <form onSubmit={submit} className="er-filters">
        <label>
          Colaborador
          <select className="block border p-2" name="employee_id" defaultValue="" required>
            <option value="" disabled>Selecione o colaborador</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unidade
          <select className="block border p-2" name="unit_id" defaultValue="" required>
            <option value="" disabled>Selecione a unidade</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Papel
          <select className="block border p-2" name="role">
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="border rounded p-3">
          Conceder acesso
        </button>
      </form>
      <p role="status">{message}</p>
      <ul className="er-access-list">
        {grants.map((g) => (
          <li
            className="er-panel"
            key={`${g.employee_id}-${g.unit_id}-${g.role}`}
          >
            <span>
              {people.find((p) => p.id === g.employee_id)?.nome ??
                "Colaborador"}{" "}
              · {units.find((u) => u.id === g.unit_id)?.name} ·{" "}
              {ROLE_LABELS[g.role as OperationalRole]}
            </span>
            <button aria-label={`Revogar acesso de ${people.find(p=>p.id===g.employee_id)?.nome??"colaborador"} como ${ROLE_LABELS[g.role as OperationalRole]}`} disabled={busy} onClick={() => void change(g, false)}>
              Revogar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
