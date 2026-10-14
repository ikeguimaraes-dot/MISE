import { loadCrivoReport } from "@/lib/crivo/report";
import { buildCrivoPdf, type ReportImage } from "@/lib/crivo/pdf";
import { CrivoError, crivoError } from "@/lib/crivo/access";
export const runtime = "nodejs";
export const maxDuration=60;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, report } = await loadCrivoReport(id);
    const keys = [
      ...new Set(
        [
          ...report.responses.map((r) => r.foto_url),
          ...report.photos.map((p) => p.url),
          report.execution.assinatura_avaliador_url,
        ].filter(Boolean),
      ),
    ] as string[];
    if (keys.length > 150)
      throw new CrivoError(
        "O laudo ultrapassa 150 imagens. Divida a visita em relatórios menores.",
        422,
      );
    const images: ReportImage[] = [];
    let totalBytes = 0;
    const assets = await db
      .schema("mise")
      .from("crivo_assets")
      .select("object_path")
      .eq("execution_id", id);
    if (assets.error) throw new CrivoError("Arquivos indisponíveis.", 503);
    for (const key of keys) {
      let bucket = "mise-crivo-evidence",
        path = key;
      if (/^https?:/.test(key)) {
        const url = new URL(key),
          base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
        if (url.origin !== base.origin)
          throw new CrivoError(
            "Há imagem externa no laudo. Reanexe o arquivo na plataforma.",
            422,
          );
        const match = url.pathname.match(
          /^\/storage\/v1\/object\/public\/(checklist-photos)\/(.+)$/,
        );
        if (!match)
          throw new CrivoError(
            "Formato de imagem histórica não suportado. Reanexe a imagem.",
            422,
          );
        bucket = match[1];
        path = decodeURIComponent(match[2]);
      } else if (!assets.data.some((a) => a.object_path === path))
        throw new CrivoError(
          "Arquivo não vinculado à visita. Reanexe a imagem.",
          422,
        );
      const download = await db.storage.from(bucket).download(path);
      if (download.error)
        throw new CrivoError(
          "Uma foto ou assinatura não pôde ser carregada. Confira os anexos.",
          503,
        );
      if (download.data.size > 8388608)
        throw new CrivoError("Uma imagem excede 8 MB.", 422);
      totalBytes += download.data.size;
      if (totalBytes > 64 * 1024 * 1024)
        throw new CrivoError(
          "As imagens do laudo excedem 64 MB. Reduza os arquivos.",
          422,
        );
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const type =
        bytes[0] === 137 && bytes[1] === 80
          ? "png"
          : bytes[0] === 255 && bytes[1] === 216
            ? "jpg"
            : null;
      if (!type)
        throw new CrivoError(
          "Uma imagem não é PNG ou JPEG. Reanexe o arquivo.",
          422,
        );
      images.push({ key, bytes, type });
    }
    const bytes = await buildCrivoPdf(report, images);
    const path=`${id}/relatorio.pdf`;
    const upload=await db.storage.from('mise-crivo-reports').upload(path,bytes,{contentType:'application/pdf',upsert:true,cacheControl:'0'});
    if(upload.error)throw new CrivoError('Não foi possível preparar o PDF para download.',503);
    const signed=await db.storage.from('mise-crivo-reports').createSignedUrl(path,60,{download:`CRIVO-${id.slice(0,8)}.pdf`});
    if(signed.error)throw new CrivoError('Download indisponível. Tente novamente.',503);
    return new Response(null,{status:303,headers:{Location:signed.data.signedUrl,'Cache-Control':'private, no-store'}});

  } catch (e) {
    return crivoError(e);
  }
}
