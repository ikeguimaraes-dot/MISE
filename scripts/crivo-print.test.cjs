// Render the actual printable component with anonymous fixtures, without a database or auth bypass.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const s=fs.readFileSync(file,'utf8');const js=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=(id)=>{if(id.endsWith('.css'))return {};if(id==='next/link')return {default:({href,children,...props})=>React.createElement('a',{href,...props},children)};if(id.includes('botao-exportar'))return {BotaoExportar:()=>React.createElement('button',null,'Exportar')};if(id.startsWith('@/')){let p=path.join(root,'src',id.slice(2));if(!path.extname(p))p+=fs.existsSync(p+'.tsx')?'.tsx':'.ts';return load(p)}return require(id)};m._compile(js,file);cache.set(file,m.exports);return m.exports;}
const {CrivoPrintReport}=load(path.join(root,'src/components/crivo/print-report.tsx'));
const fixturePath=process.env.CRIVO_SOURCE_FIXTURE;
const actual=fixturePath?JSON.parse(fs.readFileSync(fixturePath)):null;
const {scoreCrivo}=load(path.join(root,'src/lib/crivo/scoring.ts'));
const items=actual?.items||[{id:'one',topico_ordem:1,topico_nome:'Armazenamento',titulo:'Identificação',tipo_resposta:'sim_nao',peso:1,requer_foto:'sim'}];
const responses=(actual?.responses||[{item_id:'one',resposta:{valor:'nao'},nao_aplicavel:false}]).map((r,i)=>({...r,id:`response-${i}`,foto_url:null}));
const model=actual?'ff_ponderado':'headchef_conformidade';
const result=scoreCrivo(model,items.map(i=>({...i,requer_comentario:'nao'})),responses,actual?.weights||[]);
const report={execution:{id:'anonymous-validation',status:actual?'em_andamento':'concluido',percentual:result.percentual,iniciado_em:null,concluido_em:null,avaliador_nome:null,avaliador_registro:null,assinatura_avaliador_url:null,plano_revisado_em:null},previous:null,title:actual?'Conferência da pontuação · Casa de Apoio':'Exemplo fictício de inspeção',unit:actual?'Casa de Apoio':'Unidade demonstrativa',local:'',address:'',model,items,responses,photos:[],topics:result.topicos,actions:[],employees:[],canEdit:true};
const html=renderToStaticMarkup(React.createElement(CrivoPrintReport,{report}));
assert.match(html,/SEM FOTO/);assert.match(html,/Conformidade dos itens/);assert.match(html,/Pontos perdidos por tópico/);assert.match(html,/CPF:/);assert.match(html,/Visita anterior/);
if(actual){assert.equal(result.percentual,55.85);assert.match(html,/55,85/);assert.match(html,/66,73/)}else{assert.doesNotMatch(html,/Principais apontamentos críticos/);assert.doesNotMatch(html,/zerada por item crítico/)}
const withPhoto=renderToStaticMarkup(React.createElement(CrivoPrintReport,{report:{...report,responses:report.responses.map(r=>({...r,foto_url:'synthetic-photo'}))}}));assert.doesNotMatch(withPhoto,/SEM FOTO/);
const narrative=renderToStaticMarkup(React.createElement(CrivoPrintReport,{report:{...report,model:'headchef_narrativo',execution:{...report.execution,percentual:null}}}));assert.doesNotMatch(narrative,/Conformidade dos itens|Pontos perdidos por tópico|Principais apontamentos críticos/);
if(process.env.CRIVO_PRINT_HTML){const css=['src/components/extras-real/print.css','src/components/crivo/print-report.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');fs.writeFileSync(process.env.CRIVO_PRINT_HTML,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#e9e3d8;font-family:Arial,sans-serif}*{box-sizing:border-box}a{color:inherit}</style><style>${css}</style><body>${html}</body></html>`)}
console.log('PASS printable cover, conformity chart, lost points, previous score, signatures, narrative/HeadChef without empty critical sections'+(actual?' and real Casa de Apoio 55.85%':''));
