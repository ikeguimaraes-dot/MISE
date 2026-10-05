export function expectedDays(from:string,to:string,schedule:{dia_semana:number;periodo:string}[]):string[] {
  const result:string[]=[];
  for(let d=new Date(`${from}T12:00:00Z`);d.toISOString().slice(0,10)<=to;d.setUTCDate(d.getUTCDate()+1))
    if(schedule.some(s=>s.dia_semana===d.getUTCDay()))result.push(d.toISOString().slice(0,10));
  return result;
}
