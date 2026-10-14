import { extrasContext, requireExtraAccess, requireUuid, ExtraError, extraResponseError } from '@/lib/extras/access';
const fields = 'id,unit_id,nome,ativo';
const headers = { 'Cache-Control': 'private, no-store' };
function name(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 150)
    throw new ExtraError('Informe um nome de até 150 caracteres.');
  return value.trim();
}
export async function GET(request: Request) {
  try {
    const { db, grants, session } = await extrasContext();
    const params = new URL(request.url).searchParams;
    const unit = requireUuid(params.get('unit_id'));
    requireExtraAccess(grants, unit);
    const all = params.get('all') === '1';
    if (all && session.role !== 'admin') throw new ExtraError('Gestão restrita à administração.', 403);
    let query = db.from('op_extra_solicitante').select(fields).eq('unit_id', unit).order('nome');
    if (!all) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) throw new ExtraError('Não foi possível carregar os solicitantes.', 503);
    return Response.json({ items: data }, { headers });
  } catch (error) { return extraResponseError(error); }
}
async function save(request: Request, editing: boolean) {
  try {
    const { db, session, grants } = await extrasContext();
    if (session.role !== 'admin') throw new ExtraError('Gestão restrita à administração.', 403);
    const body = await request.json();
    const unit = requireUuid(body.unit_id);
    requireExtraAccess(grants, unit);
    const patch: { nome?: string; ativo?: boolean } = {};
    if (!editing || body.nome !== undefined) patch.nome = name(body.nome);
    if (body.ativo !== undefined) {
      if (typeof body.ativo !== 'boolean') throw new ExtraError('Situação inválida.');
      patch.ativo = body.ativo;
    }
    if (!Object.keys(patch).length) throw new ExtraError('Informe a alteração.');
    const query = editing
      ? db.from('op_extra_solicitante').update(patch).eq('id', requireUuid(body.id)).eq('unit_id', unit)
      : db.from('op_extra_solicitante').insert({ unit_id: unit, nome: patch.nome, ativo: true });
    const { data, error } = await query.select(fields).maybeSingle();
    if (error) throw new ExtraError(error.code === '23505' ? 'Este nome já está cadastrado nesta casa. Confira também os inativos.' : 'Não foi possível salvar o solicitante.', error.code === '23505' ? 409 : 503);
    if (!data) throw new ExtraError('Solicitante não encontrado nesta casa.', 404);
    return Response.json({ item: data }, { status: editing ? 200 : 201, headers });
  } catch (error) { return extraResponseError(error); }
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
