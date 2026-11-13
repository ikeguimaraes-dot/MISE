# Validade automática das etiquetas

Perfil operacional de São Paulo, conferido em 13/11/2026. A tabela de referência é a Portaria CVS 5/2013, art. 34, dentro do contexto da RDC 216/2004. Os prazos pressupõem boas práticas, processamento adequado e manutenção efetiva da temperatura selecionada. A categoria descreve o estado do alimento, não apenas o ingrediente: pescado cozido difere de pescado cru; carnes temperadas/moídas diferem de cortes crus.

Fontes oficiais:

- [CVS 5/2013, art. 34, página 11 do PDF, cópia oficial da Prefeitura de Jundiaí](https://jundiai.sp.gov.br/saude/wp-content/uploads/sites/17/2017/05/PORTARIA-CVS-5-de-09.04.13-Boas-pr%C3%A1ticas-para-estabelecimentos-comerciais-de-alimentos-e-servi%C3%A7os-de-alimenta%C3%A7%C3%A3o-roteiro.pdf)
- [RDC 216/2004, itens 4.8.15–4.8.18, repositório normativo da Anvisa](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&codTipo=&cod_menu=1696&cod_modulo=134&desItem=&desItemFim=&link=S&numeroAto=00000216&orgao=RDC%2FDC%2FANVISA%2FMS&seqAto=000&tipo=RDC&valorAno=2004)

## Perfil aplicado

| Alimento refrigerado | Máxima | Horas |
| --- | --- | --- |
| Pescado pós-cocção | 2 °C | 24 |
| Pescado cru manipulado | 2 °C | 72 |
| Preparações cárneas cruas, maionese e misturas | 4 °C | 48 |
| Carnes cruas manipuladas, frios fatiados, cozidos sem pescado, sobremesas e preparações com laticínios | 4 °C | 72 |
| Vegetais/frutas higienizados ou fracionados, sucos e polpas | 5 °C | 72 |

O agrupamento de carnes temperadas com as preparações cárneas de 48h é uma opção conservadora solicitada pelo usuário. A categoria de sobremesa inclui confeitaria com recheio/cobertura e mantém 72h a até 4 °C por solicitação do usuário; o art. 34 admite 120h a até 5 °C para certos produtos de panificação/confeitaria, mas essa ampliação não é aplicada. `laticinios` representa preparações com laticínios, não a regra genérica de leite industrializado em embalagem original.

Congelados: 0 a −5 °C = 240h; −6 a −10 °C = 480h; −11 a −18 °C = 720h; abaixo de −18 °C = 2160h. Exatamente −18 °C pertence ao prazo de 30 dias. A seleção representa a faixa efetivamente mantida pelo equipamento. Para categorias explicitamente pós-cocção, as faixas mais quentes são bloqueadas conforme o item 4.8.16 da RDC 216; existe uma opção separada de −18 °C (30 dias), além da opção abaixo de −18 °C (90 dias).

Não há prazo genérico de 30 dias em temperatura ambiente. O sistema informa a falta de regra e impede a emissão nesse método. Produtos estáveis à temperatura ambiente exigem fluxo específico e critério validado pelo responsável técnico; não são classificados automaticamente como seguros.

## Cálculo e integração

O cadastro manual em **Cadastro → Produtos → Novo produto** e a edição do produto exibem o campo **Categoria sanitária (CVS / ANVISA)**. A seleção é persistida em `ingredients.categoria_anvisa`; o formulário mostra o método e o prazo sugeridos. A lista de produtos apresenta o nome legível da categoria salva. A validade final é calculada na emissão, a partir da manipulação e dos limites aplicáveis, não como uma data fixa no cadastro.

`src/lib/shelf-life.ts` centraliza as categorias, métodos e limites. O formulário e o cadastro usam a mesma lista. Ao escolher uma categoria, o formulário preenche a refrigeração correspondente (2, 4 ou 5 °C) e consulta a validade. O mesmo ocorre quando o produto já possui categoria no cadastro ou é aberto pela lista de grupos. O funcionário pode alterar o método conforme o armazenamento efetivo; trocar a categoria ou o produto redefine a sugestão para não manter uma temperatura de outro alimento. A categoria cadastrada prevalece no servidor; se ausente, a categoria escolhida na emissão é usada sem alterar automaticamente o cadastro.

A regra de produto de `mise.ingredient_shelf_life` só reduz o limite da categoria, nunca o amplia ou autoriza temperatura incompatível. A antiga tabela `mise.shelf_life_rules` deixa de determinar o prazo: a regra versionada evita depender de registros ausentes ou desatualizados.

A validade parte da data/hora de manipulação, em America/Sao_Paulo. Quando informada, a validade original do fornecedor limita a data calculada; uma data sem hora é interpretada como fim daquele dia. Isso não substitui as instruções do fabricante após abertura. O POST recalcula a validade antes de persistir, e a impressão usa a data retornada pelo servidor, com hora de vencimento na impressão web e Bluetooth. Nenhuma etiqueta antiga é recalculada.

Não se aplicam automaticamente mudanças futuras de legislação. Revisar este perfil com o responsável técnico antes da vigência da CVS 3/2026 informada para fevereiro de 2027, incluindo o texto republicado e os atos de prorrogação. Esta implementação não declara que a CVS 5 e a CVS 3 têm tabelas idênticas.

Validação: `node --test tests/shelf-life.test.mjs` e `npx tsc --noEmit --incremental false`.
