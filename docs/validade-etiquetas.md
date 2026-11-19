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

Não há prazo genérico de 30 dias em temperatura ambiente. Categorias de perecíveis continuam bloqueadas nesse método. As novas categorias de farinhas/féculas (incluindo farinha de amêndoa), oleaginosas/sementes, grãos/massas secas, açúcares, temperos secos, óleos/gorduras e chocolates/cacau não recebem os prazos de alimentos preparados. São agrupamentos operacionais, não uma declaração de estabilidade de todos os produtos incluídos.

Para esses ingredientes e para ovos, o administrador cadastra a conservação e o prazo após abertura indicado pelo fabricante em horas. O funcionário usa os valores salvos. O servidor exige prazo positivo e finito, aplica eventual prazo menor já configurado para o produto e limita a validade pela data original quando informada. Referência: [Guia da Anvisa sobre prazos de validade](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2018/guia-orienta-sobre-prazos-de-validade-de-alimentos/).

## Cálculo e integração

O cadastro manual em **Cadastro → Produtos → Novo produto** e a edição do produto exibem o campo **Categoria sanitária (CVS / ANVISA)**. A seleção é persistida em `ingredients.categoria_anvisa`; o formulário mostra o método e o prazo sugeridos. A lista de produtos apresenta o nome legível da categoria salva. A validade final é calculada na emissão, a partir da manipulação e dos limites aplicáveis, não como uma data fixa no cadastro.

`src/lib/shelf-life.ts` centraliza as categorias, métodos e limites. O formulário e o cadastro usam a mesma lista. Ao escolher uma categoria, o formulário preenche a refrigeração correspondente (2, 4 ou 5 °C) e consulta a validade. O mesmo ocorre quando o produto já possui categoria no cadastro ou é aberto pela lista de grupos. Somente administradores definem categoria sanitária, conservação, prazo, SIF e marca no cadastro. O funcionário seleciona o produto e usa essa configuração. Produtos antigos sem conservação padronizada precisam de configuração administrativa antes da emissão por funcionários. Preparações sem padrão cadastrado permanecem disponíveis apenas para administradores; para a operação, devem ser cadastradas como produtos com conservação definida.

A regra de produto de `mise.ingredient_shelf_life` só reduz o limite da categoria, nunca o amplia ou autoriza temperatura incompatível. A antiga tabela `mise.shelf_life_rules` deixa de determinar o prazo: a regra versionada evita depender de registros ausentes ou desatualizados.

A manipulação recebe automaticamente a data/hora do servidor na emissão. Somente administradores podem ajustar essa data. A validade parte desse instante, exibido em America/Sao_Paulo. Quando informada, a validade original do fornecedor limita a data calculada; uma data sem hora é interpretada como fim daquele dia. Isso não substitui as instruções do fabricante após abertura. O POST recalcula a validade antes de persistir, e a impressão usa a data retornada pelo servidor, com hora de vencimento na impressão web e Bluetooth. Nenhuma etiqueta antiga é recalculada.

Não se aplicam automaticamente mudanças futuras de legislação. Revisar este perfil com o responsável técnico antes da vigência da CVS 3/2026 informada para fevereiro de 2027, incluindo o texto republicado e os atos de prorrogação. Esta implementação não declara que a CVS 5 e a CVS 3 têm tabelas idênticas.

Validação: `node --test tests/shelf-life.test.mjs` e `npx tsc --noEmit --incremental false`.


## Exceção operacional para produtos sem categoria

Por configuração solicitada pela operação, produtos sem categoria sanitária e com método **Temperatura ambiente** recebem automaticamente **168 horas (7 dias)** a partir da manipulação. A interface identifica o prazo como regra operacional, sem atribuí-lo à CVS/Anvisa. Uma regra específica de produto menor e a validade original do fornecedor, quando informada, continuam limitando o vencimento. A categoria cadastrada prevalece no servidor; categorias conhecidas, categorias inválidas e outros métodos não usam essa exceção. Selecionar uma categoria na emissão aplica a regra dessa categoria.


## Prazos em horas, edição administrativa e SIF — 17/11/2026

A emissão oferece **Prazo de validade (horas)**. Exemplo: manipulação às 10:15 com prazo de 8h vence às 18:15 do mesmo dia; manipulação às 20:15 vence às 04:15 do dia seguinte. O cálculo soma milissegundos ao instante de manipulação, sem arredondar para o fim do dia. Datas sem offset nos formulários são interpretadas no horário de São Paulo, independentemente do fuso do dispositivo. O fim do dia permanece somente para a validade original do fornecedor quando informada sem horário.

Somente administradores podem alterar o prazo. Administradores podem definir outro prazo em horas ou uma data/hora explícita, inclusive em etiquetas já emitidas, por **Validades → Alterar validade (admin)** ou pelo histórico de etiquetas. Etiquetas consumidas/descartadas não podem ser alteradas. A validade original do fornecedor continua limitando o vencimento. Edições registram a validade anterior, o administrador e o instante da alteração; uma gravação concorrente exige atualizar a lista. Uma alteração administrativa não é apresentada como prazo definido pela CVS.

O painel agrupa vencimentos nas próximas 24h, entre 24–48h e entre 48–72h, contando a partir do instante da consulta. As chaves internas dos filtros foram preservadas para compatibilidade. A mudança de data à meia-noite não equivale a transcorrer 24 horas.

O cadastro de produto inclui **Registro SIF** e **Marca**. O SIF preenchido é carregado na seleção do produto e confirmado novamente pelo servidor. Uma cópia do registro é salva na etiqueta e usada na impressão web, na prévia, na impressão Bluetooth e nas reimpressões. Marca e lote também são copiados para a etiqueta e usados na impressão e reimpressão. Etiquetas antigas permanecem com os dados originalmente registrados. Bluetooth passa a mostrar também a hora de manipulação, além da hora de vencimento.

A migração `20261117200037_label_hours_product_sif_brand.sql` deve ser aplicada antes de publicar o código em cada banco utilizado pelo MISE. Ela adiciona campos opcionais, sem alterar validades ou cadastros existentes.

Verificação: `node --test tests/hourly-labels.test.mjs tests/shelf-life.test.mjs tests/validities-persistence.test.mjs`, `npx tsc --noEmit --incremental false` e build de produção. Os testes incluem 8h, virada de dia/ano, fuso do dispositivo, permissão de administrador, prazo do fornecedor, concorrência, SIF vindo do cadastro, limpeza de marca/SIF e limites físicos da etiqueta Bluetooth.


## Padrões globais de produto — 19/11/2026

As categorias comerciais incluem **Molhos**, **Ovos**, **Shari (arroz japonês)** e **Feitos / empanados**. No cadastro administrativo, essas opções preenchem a categoria sanitária correspondente. Shari tem limite operacional de **8 horas**, inclusive em temperatura ambiente; feitos/empanados têm **24 horas** em refrigeração ou congelamento. Essas duas regras são operacionais solicitadas pela administração, sem atribuição à CVS. Um prazo cadastrado menor continua prevalecendo.

Em **Cadastro → Produtos**, o admin define `metodo_conservacao` e `prazo_validade_horas`. Temperatura ambiente pode ser o único modo cadastrado; sem categoria sanitária, mantém o limite operacional de 168h já existente. Para categorias que dependem do fabricante, o prazo é obrigatório ao padronizar a conservação. Os demais limites sanitários continuam sendo aplicados. Gerentes mantêm acesso aos campos gerais, mas a API rejeita alterações nas configurações protegidas. A importação Everest preserva essas configurações.

`ingredients.lote` serve como lote inicial da emissão e pode ser ajustado para o lote efetivamente manipulado. Marca, SIF e lote são capturados na etiqueta; reimpressões usam essa cópia. A emissão retorna também a manipulação e o método efetivamente persistidos, usados na prévia e impressão. Funcionários não podem enviar prazos ou datas finais próprias, e o servidor ignora métodos, categorias e datas de manipulação enviados por eles.

Migração **20261119180245_product_label_defaults.sql** aplicada no banco do MISE em 19/11/2026, com colunas, categorias e limites verificados após a execução. Ela amplia o CHECK de categorias e adiciona colunas opcionais no catálogo e na etiqueta; não modifica registros de empresas, unidades, produtos ou etiquetas existentes. Nenhuma configuração de conservação é presumida para produtos antigos.

Verificação adicional: `node --test tests/product-label-defaults.test.mjs` cobre relógio do servidor, falsificação de configurações, permissões, conservação ambiente, prazo do fabricante, lote, limites de shari/empanados e impressão de 60mm com metadados.
