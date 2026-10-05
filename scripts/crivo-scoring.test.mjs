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
test('required photos and comments validated on server',()=>{assert.throws(()=>scoreCrivo('ff_ponderado',[item('a',1,{requer_foto:'sim'})],[response('a')]),/foto/);assert.throws(()=>scoreCrivo('ff_ponderado',[item('a',1,{requer_comentario:'se_nao'})],[response('a','nao')]),/comentário/)})
