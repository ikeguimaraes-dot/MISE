import {redirect,notFound} from 'next/navigation';
import {loadCrivoReport} from '@/lib/crivo/report';
import {CrivoError} from '@/lib/crivo/access';
import {CrivoPrintReport} from '@/components/crivo/print-report';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 try {const {report}=await loadCrivoReport(id);return <CrivoPrintReport report={report}/>;}
 catch(e){if(e instanceof CrivoError){if(e.status===401)redirect('/login');if(e.status===404)notFound();return <p className="p-8">{e.message}</p>}throw e;}
}
