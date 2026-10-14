import { crivoExecution, crivoError, CrivoError } from "@/lib/crivo/access";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, session, execution } = await crivoExecution(id);
    const form = await request.formData();
    const file = form.get("file"),
      kind = String(form.get("kind"));
    if (
      !["foto", "assinatura", "evidencia"].includes(kind) ||
      !(file instanceof File) ||
      !file.size ||
      file.size > 4194304
    )
      throw new CrivoError("Envie foto JPEG ou PNG até 4 MB.");
    if (kind !== "evidencia" && session.role !== "admin")
      throw new CrivoError("Somente o auditor pode alterar o laudo.", 403);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71,
      jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    const type = png
      ? "image/png"
      : jpg
        ? "image/jpeg"
        : null;
    if (!type || type !== file.type)
      throw new CrivoError("Formato de arquivo inválido.");
    const assetId = crypto.randomUUID(),
      path = `${execution.unit_id}/${id}/${assetId}.${png ? "png" : jpg ? "jpg" : "pdf"}`;
    const upload = await db.storage
      .from("mise-crivo-evidence")
      .upload(path, bytes, { contentType: type });
    if (upload.error) throw new CrivoError("Falha ao guardar arquivo.", 503);
    const insert = await db
      .schema("mise")
      .from("crivo_assets")
      .insert({
        id: assetId,
        execution_id: id,
        uploaded_by: session.employeeId,
        kind,
        object_path: path,
        content_type: type,
        size_bytes: file.size,
      });
    if (insert.error) {
      await db.storage.from("mise-crivo-evidence").remove([path]);
      throw new CrivoError("Falha ao vincular arquivo.", 503);
    }
    return Response.json({ id: assetId, path });
  } catch (e) {
    return crivoError(e);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db } = await crivoExecution(id);
    const path = new URL(request.url).searchParams.get("path");
    const asset = await db
      .schema("mise")
      .from("crivo_assets")
      .select("object_path")
      .eq("execution_id", id)
      .eq("object_path", path)
      .single();
    if (asset.error) throw new CrivoError("Arquivo não encontrado.", 404);
    const signed = await db.storage
      .from("mise-crivo-evidence")
      .createSignedUrl(asset.data.object_path, 60);
    if (signed.error) throw new CrivoError("Arquivo indisponível.", 503);
    if(new URL(request.url).searchParams.get("redirect")==="1")return new Response(null,{status:302,headers:{Location:signed.data.signedUrl,"Cache-Control":"private, no-store"}});
    return Response.json(
      { url: signed.data.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return crivoError(e);
  }
}
