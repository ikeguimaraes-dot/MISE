// Logical snapshot IDs are unique per equipment; item_id in storage stays the source item.
export type SnapshotIdentity={id:string;base_item_id?:string;equipamento_id?:string|null;expansion_count?:number}
export function responseSnapshotId(items:SnapshotIdentity[],row:{item_id:string;equipamento_id?:string|null}){
 return items.find(i=>(i.base_item_id??i.id)===row.item_id&&(i.equipamento_id??null)===(row.equipamento_id??null))?.id??row.item_id
}
export function normalizeEquipmentResponses<T extends {item_id:string;equipamento_id?:string|null}>(items:SnapshotIdentity[],rows:T[]):T[]{return rows.map(row=>({...row,item_id:responseSnapshotId(items,row)}))}
