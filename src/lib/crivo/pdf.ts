import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import type { CrivoReport } from "./report";
import { classify } from "./scoring.ts";
export type ReportImage = {
  key: string;
  bytes: Uint8Array;
  type: "png" | "jpg";
};
export async function buildCrivoPdf(r: CrivoReport, images: ReportImage[]) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${r.title} — ${r.unit}`);
  doc.setAuthor(r.execution.avaliador_nome || "MISE / CRIVO");
  doc.setSubject("Laudo de inspeção e plano de ação");
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.12, 0.11),
    muted = rgb(0.43, 0.42, 0.38),
    orange = rgb(1, 0.45, 0.28),
    line = rgb(0.86, 0.84, 0.79);
  let page!: PDFPage,
    y = 0;
  function newPage(title?: string) {
    page = doc.addPage([595.28, 841.89]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
      color: rgb(1, 1, 1),
    });
    page.drawRectangle({ x: 44, y: 827, width: 34, height: 3, color: orange });
    y = 785;
    page.drawText("MISE / CRIVO", {
      x: 44,
      y: 810,
      size: 9,
      font: bold,
      color: muted,
    });
    if (title) {
      text(title, 21, true);
      y -= 12;
    }
  }
  function ensure(height: number) {
    if (y - height < 55) newPage();
  }
  function clean(value: unknown) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
      .split("")
      .map((c) => {
        try {
          regular.encodeText(c);
          return c;
        } catch {
          return c === "→" ? ">" : " ";
        }
      })
      .join("");
  }
  function wrap(value: string, font: PDFFont, size: number, width: number) {
    const output: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) {
          current = next;
          continue;
        }
        if (current) output.push(current);
        current = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > width) {
            output.push(current);
            current = "";
          }
          current += char;
        }
      }
      output.push(current);
    }
    return output;
  }
  function text(value: unknown, size = 11, strong = false, color = ink) {
    const font = strong ? bold : regular;
    for (const row of wrap(clean(value), font, size, 507)) {
      ensure(size * 1.5);
      page.drawText(row, { x: 44, y: y - size, size, font, color });
      y -= size * 1.5;
    }
    y -= 5;
  }
  function rule() {
    ensure(20);
    page.drawLine({
      start: { x: 44, y },
      end: { x: 551, y },
      thickness: 0.6,
      color: line,
    });
    y -= 20;
  }
  async function photo(key: string, caption: string, maxHeight = 235) {
    const src = images.find((i) => i.key === key);
    if (!src) {
      text(`Registro indisponível: ${caption}`, 10, false, muted);
      return;
    }
    const embedded =
      src.type === "png"
        ? await doc.embedPng(src.bytes)
        : await doc.embedJpg(src.bytes);
    const scale = Math.min(
      507 / embedded.width,
      maxHeight / embedded.height,
      1,
    );
    const w = embedded.width * scale,
      h = embedded.height * scale;
    ensure(h + 65);
    page.drawImage(embedded, { x: 44, y: y - h, width: w, height: h });
    y -= h + 16;
    text(caption, 10, false, muted);
  }
  newPage();
  y -= 25;
  text(
    r.execution.status === "concluido"
      ? "LAUDO DE INSPEÇÃO"
      : "LAUDO EM ELABORAÇÃO",
    10,
    true,
    orange,
  );
  text(r.title, 30, true);
  text(r.unit, 20, true);
  text([r.local, r.address].filter(Boolean).join(" · "), 11);
  text(
    `Visita: ${(r.execution.concluido_em || r.execution.agendado_para || "").slice(0, 10).split("-").reverse().join("/")}`,
  );
  y -= 15;
  text(
    r.model === "headchef_narrativo"
      ? "Relatório descritivo"
      : r.execution.percentual === null
        ? "Sem itens aplicáveis"
        : `${Number(r.execution.percentual).toFixed(2)}%`,
    40,
    true,
    orange,
  );
  text(classify(r.execution.percentual, r.model), 15, true);
  text(
    r.model === "ff_ponderado"
      ? "FF Nutri · média ponderada por tópico; não conformidade crítica zera o tópico."
      : r.model === "headchef_conformidade"
        ? "HeadChef · conformes / itens aplicáveis; sem pesos por tópico ou item crítico."
        : "HeadChef · observações e orientações corretivas, sem atribuição de nota.",
    10,
    false,
    muted,
  );
  if (r.legacy)
    text(
      "Registro anterior ao versionamento. Nota histórica preservada; textos dos itens provenientes do cadastro disponível.",
      10,
      false,
      muted,
    );
  y -= 10;
  text("Resumo por tópico", 16, true);
  for (const t of r.topics) {
    ensure(48);
    text(
      `${t.topico_nome}  ${t.percentual === null ? "Descritivo" : `${Number(t.percentual).toFixed(1)}%`}`,
      10,
      true,
    );
    if (t.percentual !== null) {
      page.drawRectangle({
        x: 44,
        y: y - 5,
        width: 507,
        height: 6,
        color: line,
      });
      page.drawRectangle({
        x: 44,
        y: y - 5,
        width: (507 * Math.max(0, Math.min(100, t.percentual))) / 100,
        height: 6,
        color: orange,
      });
      y -= 19;
    }
    if (t.zerado_por_critico)
      text("Tópico zerado por item crítico não conforme.", 9, false, muted);
  }
  newPage("Parecer e identificação");
  text(`Auditor: ${r.execution.avaliador_nome || "Não informado"}`);
  text(
    `Registro profissional: ${r.execution.avaliador_registro || "Não informado"}`,
  );
  text(
    `Responsável da unidade: ${r.execution.responsavel_unidade_nome || "Não informado"}`,
  );
  rule();
  text(r.execution.observacoes_gerais || "Parecer ainda não preenchido.", 11);
  newPage("Constatações da visita");
  for (const item of r.items) {
    const response = r.responses.find((a) => a.item_id === item.id);
    if (!response) continue;
    ensure(100);
    text(item.topico_nome || "Observações", 9, true, orange);
    text(item.titulo || "Item da visita", 13, true);
    text(
      response.nao_aplicavel
        ? "Não aplicável"
        : response.resposta?.valor === "sim"
          ? "Conforme"
          : response.resposta?.valor === "nao"
            ? "Não conforme"
            : String(response.resposta?.texto || "Registro descritivo"),
      10,
      true,
    );
    if (response.comentario) text(response.comentario);
    if (response.orientacao_corretiva)
      text(`Orientação: ${response.orientacao_corretiva}`);
    const linked = r.actions.filter((a) => a.response_id === response.id);
    for (const a of linked)
      text(
        `Correção: ${a.orientacao} — ${a.responsavel_nome}, prazo ${a.prazo || "a definir"}`,
        10,
        false,
        muted,
      );
    if (!response.nao_aplicavel && response.resposta?.valor === "nao" && !response.foto_url && !r.photos.some(p => p.response_id === response.id)) text("SEM FOTO", 10, true, muted);
    if (response.foto_url)
      await photo(
        response.foto_url,
        response.comentario || item.titulo || "Registro da inspeção",
      );
    for (const p of r.photos.filter((p) => p.response_id === response.id))
      await photo(p.url, p.legenda || item.titulo || "Registro da inspeção");
    rule();
  }
  newPage("Plano de ação");
  if (!r.actions.length) text("Nenhuma ação cadastrada para esta visita.");
  for (const [index, a] of r.actions.entries()) {
    ensure(120);
    text(`${index + 1}. ${a.descricao}`, 13, true);
    text(a.orientacao);
    text(
      `Responsável: ${a.responsavel_nome || "Não definido"} | Prazo: ${a.prazo?.split("-").reverse().join("/") || "Não definido"}`,
      10,
    );
    text(
      `Status: ${a.status.replaceAll("_", " ")} | Evidência: ${a.evidencia_url ? "anexada à ação na plataforma" : "pendente"}`,
      10,
      false,
      muted,
    );
    rule();
  }
  newPage("Responsáveis pela visita");
  text(r.execution.avaliador_nome || "Auditor não informado", 16, true);
  text(r.execution.avaliador_registro || "", 11);
  if (r.execution.assinatura_avaliador_url)
    await photo(
      r.execution.assinatura_avaliador_url,
      "Assinatura do auditor",
      110,
    );
  else {
    text("Assinatura do auditor pendente", 11, false, muted);
    y -= 40;
    rule();
  }
  y -= 30;
  text(
    r.execution.responsavel_unidade_nome || "Responsável pela unidade",
    16,
    true,
  );
  text("Ciência do responsável pela unidade", 11, false, muted);
  y -= 60;
  rule();
  text("Assinatura / data", 10, false, muted);
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      `${r.unit} · ${r.execution.id.slice(0, 8)} · versão ${r.execution.report_version}`,
      { x: 44, y: 26, size: 8, font: regular, color: muted },
    );
    p.drawText(`${index + 1} / ${pages.length}`, {
      x: 515,
      y: 26,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return doc.save();
}
