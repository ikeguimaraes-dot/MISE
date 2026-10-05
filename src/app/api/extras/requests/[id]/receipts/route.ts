import {
  extrasContext,
  requireExtraAccess,
  requireUuid,
  ExtraError,
  extraResponseError,
} from "@/lib/extras/access";
const bucket = "mise-extra-receipts";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, grants, session } = await extrasContext();
    const { id } = await params;
    requireUuid(id);
    const item = await db
      .from("op_extra")
      .select("unit_id,status,pagadora,emergencial,mise_managed")
      .eq("id", id)
      .single();
    if (item.error || !item.data?.mise_managed)
      throw new ExtraError("Solicitação indisponível.", 404);
    const e = item.data;
    requireExtraAccess(
      grants,
      e.unit_id,
      e.pagadora === "terceirizada" ? "financeiro" : "caixa",
    );
    if (
      !(
        e.status === "reservado_financeiro" ||
        (e.emergencial && ["solicitado", "aprovado_rh"].includes(e.status))
      )
    )
      throw new ExtraError("Recibo indisponível nesta etapa.", 409);
    if (Number(request.headers.get("content-length") ?? 0) > 4400000)
      throw new ExtraError("Arquivo acima de 4 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 4194304)
      throw new ExtraError("Envie PDF, JPEG ou PNG até 4 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? ["image/jpeg", "jpg"]
        : bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          ? ["image/png", "png"]
          : new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
            ? ["application/pdf", "pdf"]
            : null;
    if (!type || type[0] !== file.type)
      throw new ExtraError("Tipo de arquivo inválido.");
    const receiptId = crypto.randomUUID(),
      path = `${e.unit_id}/${id}/${receiptId}.${type[1]}`;
    const upload = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: type[0], upsert: false });
    if (upload.error)
      throw new ExtraError("Não foi possível guardar o recibo.", 503);
    const saved = await db
      .schema("mise")
      .from("extra_receipts")
      .insert({
        id: receiptId,
        extra_id: id,
        uploaded_by: session.employeeId,
        object_path: path,
        content_type: type[0],
        size_bytes: file.size,
      });
    if (saved.error) {
      await db.storage.from(bucket).remove([path]);
      throw new ExtraError("Não foi possível vincular o recibo.", 503);
    }
    return Response.json({ id: receiptId }, { status: 201 });
  } catch (error) {
    return extraResponseError(error);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, grants } = await extrasContext();
    const { id } = await params;
    requireUuid(id);
    const item = await db
      .from("op_extra")
      .select("unit_id,mise_receipt_id")
      .eq("id", id)
      .single();
    if (item.error || !item.data?.mise_receipt_id)
      throw new ExtraError("Recibo não encontrado.", 404);
    if (
      !grants.some(
        (g) =>
          g.unit_id === item.data.unit_id &&
          ["rh", "diretor", "financeiro", "caixa"].includes(g.role),
      )
    )
      throw new ExtraError("Sem acesso ao recibo.", 403);
    const receipt = await db
      .schema("mise")
      .from("extra_receipts")
      .select("object_path")
      .eq("id", item.data.mise_receipt_id)
      .eq("extra_id", id)
      .single();
    if (receipt.error || !receipt.data)
      throw new ExtraError("Recibo indisponível.", 404);
    const signed = await db.storage
      .from(bucket)
      .createSignedUrl(receipt.data.object_path, 60);
    if (signed.error)
      throw new ExtraError("Não foi possível abrir o recibo.", 503);
    return Response.json(
      { url: signed.data.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return extraResponseError(error);
  }
}
