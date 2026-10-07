import assert from 'node:assert/strict'
import ts from 'typescript'
import fs from 'node:fs'
import Module from 'node:module'
const load=file=>{const m=new Module(file);m.paths=modulePaths;m.require=id=>id==='./alcada'?load('src/lib/extras/alcada.ts'):require(id);m._compile(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}),file);return m.exports}
const modulePaths=[]
const {leadBand,leadMix,leadWeeks}=load('src/lib/extras/anticipation.ts')
const row=(date,urgent=false)=>({unit_id:'one',data_solicitacao:date,data_trabalho:'2026-10-01',emergencial:urgent})
assert.equal(leadBand(row('2026-09-29')),'planejado');assert.equal(leadBand(row('2026-09-30')),'curto');assert.equal(leadBand(row('2026-10-01')),'reativo');assert.equal(leadBand(row('2026-10-01',true)),'emergencial');assert.equal(leadBand(row(null)),'desconhecido');assert.equal(leadBand(row('2026-10-02')),'desconhecido');assert.equal(leadBand(row('2026-02-31')),'desconhecido');assert.equal(leadMix([row(null),row('2026-10-01')]).reactivePct,50);assert.equal(leadWeeks([row('2026-09-29')])[0].week,'2026-09-28');console.log('PASS lead-time bands, emergency precedence, invalid/missing dates and cross-month weeks')
