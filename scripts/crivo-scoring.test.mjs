import test from 'node:test'
import assert from 'node:assert/strict'
import {scoreCrivo} from '../src/lib/crivo/scoring.ts'
const item=(id,topic=1,extra={})=>({id,topico_ordem:topic,topico_nome:`Tópico ${topic}`,tipo_resposta:'sim_nao',peso:1,...extra})
const response=(id,value='sim',extra={})=>({item_id:id,resposta:{valor:value},nao_aplicavel:false,...extra})
test('FF weighted topics retain validated logic and critical zero',()=>{const r=scoreCrivo('ff_ponderado',[item('a',1,{critico:true}),item('b',1),item('c',2)],[response('a','nao'),response('b'),response('c')],[{topico_ordem:1,peso:60},{topico_ordem:2,peso:40}]);assert.equal(r.percentual,40);assert.equal(r.topicos[0].zerado_por_critico,true)})
test('HeadChef uses count, ignores topic weights and critical penalty',()=>{const r=scoreCrivo('headchef_conformidade',[item('a',1,{critico:true}),item('b',1),item('c',2)],[response('a','nao'),response('b'),response('c')],[{topico_ordem:1,peso:90},{topico_ordem:2,peso:10}]);assert.equal(r.percentual,66.67);assert.equal(r.topicos[0].zerado_por_critico,false)})
test('unweighted fractions retain two decimal places',()=>{const items=Array.from({length:67},(_,i)=>item(String(i)));const answers=items.map((x,i)=>response(x.id,i<51?'sim':'nao'));assert.equal(scoreCrivo('headchef_conformidade',items,answers).percentual,76.12)})
test('Freneze narrative never invents a score',()=>{const r=scoreCrivo('headchef_narrativo',[item('a',1,{tipo_resposta:'texto'})],[{item_id:'a',resposta:{texto:'Observação'},nao_aplicavel:false}]);assert.equal(r.percentual,null);assert.equal(r.pontuacao_total,null);assert.equal(r.topicos[0].percentual,null)})
test('NA excluded; FF zero-weight findings do not reduce score',()=>{const r=scoreCrivo('ff_ponderado',[item('a'),item('b'),item('c',1,{peso:0})],[response('a'),response('b','nao',{nao_aplicavel:true}),response('c','nao')]);assert.equal(r.percentual,100)})
test('incomplete answers cannot become silent zeroes',()=>assert.throws(()=>scoreCrivo('headchef_conformidade',[item('a')],[]),/pendentes/))
test('all NA has no denominator, not zero conformity',()=>assert.equal(scoreCrivo('headchef_conformidade',[item('a')],[response('a','nao',{nao_aplicavel:true})]).percentual,null))
test('inspection photo flags never block completion or change scores',()=>{
 for(const model of ['ff_ponderado','headchef_conformidade','headchef_narrativo']) for(const flag of ['sim','sempre','se_nao']){
  const items=[item('a',1,{requer_foto:flag}),item('b')],responses=[response('a','nao'),response('b')];
  assert.deepEqual(scoreCrivo(model,items,responses),scoreCrivo(model,items,[response('a','nao',{foto_url:'photo'}),response('b')]));
 }
})
test('required comments remain validated on server',()=>assert.throws(()=>scoreCrivo('ff_ponderado',[item('a',1,{requer_comentario:'se_nao'})],[response('a','nao')]),/comentário/))

test('FF preserves unequal item weights: refectory 3.33 / 4.99 = 66.73%, total 55.85%',()=>{
 const weights=[12.50,12.47,12.49,12.50,12.51,12.51,4.99,4.99,5.04,5,5];
 const items=weights.flatMap((w,i)=>i===6?[1.66,.5,1.16,1.67].map((p,j)=>item(`7-${j}`,7,{peso:p})):[item(`${i+1}`,i+1,{peso:w,critico:[1,4,5].includes(i)})]);
 const responses=items.map(i=>response(i.id,['2','5','6','10','7-0'].includes(i.id)?'nao':'sim'));
 const r=scoreCrivo('ff_ponderado',items,responses,weights.map((peso,i)=>({topico_ordem:i+1,peso})));
 assert.equal(r.percentual,55.85);assert.equal(r.topicos[6].percentual,66.73);assert.equal(r.topicos[6].obtido,3.33);
});
