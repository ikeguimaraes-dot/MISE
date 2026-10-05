import {notFound} from 'next/navigation'
import {TopNav} from '@/components/layout/topnav'
import {ExtrasAccess} from '@/components/extras-real/extras-access'
import {ExtraCashTable} from '@/components/extras-real/extra-cash-table'
import '@/components/extras-real/print.css'
import {ExtrasReal} from '@/components/extras-real/extras-real'
export const dynamic='force-dynamic'
// Development-only visual harness. API fixtures are intercepted by the browser test;
// this page never authenticates a user or supplies production records.
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound()
 const {view}=await searchParams
 const unit='10000000-0000-4000-8000-000000000001'
 return <><TopNav role="admin" preview previewPath="/extras"/><main id="main-content" className="workspace-main">{view==='access'?<ExtrasAccess units={[{id:unit,name:'Casa de demonstração'}]} people={[{id:'demo',nome:'Gestor de demonstração',unit_id:unit}]} initial={[{employee_id:'demo',unit_id:unit,role:'rh'}]}/>:view==='cash'?<section className="opx-print"><header><h1>Envio Caixa · demonstração</h1></header><ExtraCashTable unit={unit} day="2026-10-05" rows={[{id:'demo',nome:'Pessoa de demonstração',solicitante_nome:'Gestor de demonstração',setor:'Cozinha de Produção',funcao:'Auxiliar de cozinha',periodo:'almoco',valor:150,total:150,status:'reservado_financeiro',pagadora:'casa',emergencial:false}]}/></section>:<ExtrasReal units={[{id:unit,name:'Casa de demonstração'}]} grants={(['lider','rh','financeiro','caixa','diretor'] as const).map(role=>({unit_id:unit,role}))} employeeId="demo" admin initialDay="2026-10-05"/>}</main></>
}
