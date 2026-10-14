import {redirect,notFound} from 'next/navigation'
import {crivoContext,CrivoError} from '@/lib/crivo/access'
import {EquipmentClient} from '@/components/crivo/equipment-client'
export default async function Page({params}:{params:Promise<{localId:string}>}){
 let ctx;try{ctx=await crivoContext()}catch(e){if(e instanceof CrivoError&&e.status===401)redirect('/login');throw e}if(ctx.session.role!=='admin')redirect('/crivo')
 const {localId}=await params,db=ctx.db.schema('mise')
 const [local,equipment,types]=await Promise.all([db.from('crivo_locais').select('nome').eq('id',localId).eq('ativo',true).maybeSingle(),db.from('crivo_equipamentos').select('id,codigo,nome,tipo,area,ativo').eq('local_id',localId).order('codigo'),db.from('checklist_template_items').select('equipamento_tipo').eq('ativo',true).eq('por_equipamento',true)])
 if(local.error||equipment.error||types.error)throw Error('Equipamentos indisponíveis.');if(!local.data)notFound()
 return <EquipmentClient localId={localId} localName={local.data.nome} initial={equipment.data} types={[...new Set([...types.data.map(t=>t.equipamento_tipo),...equipment.data.map(e=>e.tipo)].filter((t):t is string=>!!t))]}/>
}
