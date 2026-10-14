"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoringModel } from "@/lib/crivo/scoring";
export function ScoringModelSelector({
  id,
  model,
  active,
}: {
  id: string;
  model: ScoringModel;
  active: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(model),
    [enabled, setEnabled] = useState(active),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="rounded-lg border border-edge p-5 mb-6 space-y-3">
      <h2 className="font-semibold">Metodologia da auditoria</h2>
      <label className="block text-sm">
        Cálculo do resultado
        <select
          className="block w-full rounded border border-edge bg-surface p-3 mt-2"
          value={value}
          onChange={(e) => setValue(e.target.value as ScoringModel)}
        >
          <option value="ff_ponderado">
            FF Nutri · pesos por tópico e itens críticos
          </option>
          <option value="headchef_conformidade">
            HeadChef · conformidade simples, sem pesos ou críticos
          </option>
          <option value="headchef_narrativo">
            HeadChef · relatório descritivo, sem nota
          </option>
        </select>
      </label>
      <p className="text-xs text-ink-muted">
        A metodologia fica guardada em cada nova visita. Visitas já iniciadas
        preservam seu modelo. Nos modelos HeadChef, os campos de peso e item
        crítico do editor não alteram o resultado.
      </p>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Template validado e disponível para agendamento
      </label>
      <button
        className="rounded bg-ember px-4 py-2 text-white"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch(`/api/crivo/templates/${id}/model`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: value, active: enabled }),
            });
            const b = await r.json();
            if (!r.ok) throw new Error(b.error);
            setMessage("Metodologia salva para novas visitas.");
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Salvando…" : "Salvar metodologia"}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
