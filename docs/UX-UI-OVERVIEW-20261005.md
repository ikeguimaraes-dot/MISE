# Overview de UX/UI — MISE

Data: 05/10/2026. Escopo desta entrega: navegação compartilhada, início e fluxo de Extras (pedidos, nomeação, pagamentos, gestão de acessos, relatórios e Envio Caixa).

## Diagnóstico e correções

| Prioridade | Problema observado | Ajuste implementado |
| --- | --- | --- |
| Alta | Lista e detalhe empilhados exigiam procurar a solicitação aberta no celular. | Navegação entre lista e detalhe conforme a largura disponível; foco e rolagem no detalhe; botão para voltar à lista. |
| Alta | Metadados dos cards ocupavam a mesma linha do grid, sobrepondo informações. | Linhas independentes para setor, preenchimento e solicitante; quebra de nomes longos. |
| Alta | Formulários, botões e navegação tinham tipografia e áreas de toque pequenas. | Controles principais com pelo menos 44 px, campos com 16 px e formulários em uma coluna nas áreas estreitas. |
| Alta | Filtros e links administrativos disputavam atenção com a operação. | Contexto da casa/data/papel recolhível no celular; ferramentas agrupadas; ação de solicitar sempre disponível ao papel permitido. |
| Média | Pedido de posições, pagamento individual e filtro de fila tinham aparência semelhante. | Abas de objeto separadas dos filtros de fila, ação principal em laranja e histórico recolhível. |
| Média | Encontrar um registro exigia percorrer a fila. | Busca local por função, setor, solicitante ou pessoa, com mensagem de resultado vazio. A busca abrange os registros carregados. |
| Média | Tabela do caixa era difícil de consultar no celular. | Cards por pessoa na tela estreita, preservando a tabela na impressão e o acesso ao pagamento individual. |
| Média | Tabelas de relatório e gestão de acesso podiam alargar a página. | Rolagem horizontal restrita à tabela, filtros flexíveis e linhas de acesso com quebra. |
| Média | Cards da página inicial ficavam pequenos no celular. | Uma coluna, textos maiores e melhor área de toque; menu e busca compartilhados com identificação acessível. |

A paleta existente foi preservada. A seleção na fila mantém a mesma superfície do painel de detalhes. As alterações não modificam alçada, permissões, regras de aprovação ou pagamentos.

## Validação

Teste de navegador em Chromium, contra servidor local com APIs interceptadas e dados sintéticos, nas larguras 320, 390, 768, 1024 e 1440 px:

- Ausência de rolagem horizontal da página e sobreposição de metadados.
- Abertura e retorno do detalhe, mudança de papel, busca e estado sem resultado.
- Formulário do gerente: seleção de setor/função, três posições e estimativa de R$ 450.
- RH: três blocos de nomeação; Caixa: formulário de pagamento e recibo.
- Menu móvel, fechamento com Escape e busca de módulos.
- Início, gestão de acessos e Envio Caixa nas larguras 390 e 1440 px.
- Impressão mantém tabela e cabeçalho do Envio Caixa.

O roteiro está em `scripts/extras-responsive.test.cjs`. Requer Playwright externo ao projeto ou disponível no ambiente. A rota de teste `/preview/extras-ux` só renderiza em desenvolvimento. As chamadas de gravação são bloqueadas pelo roteiro; nenhum pagamento é executado.

## Limites e continuidade

Esta é uma revisão dos componentes compartilhados e do módulo de Extras. Os demais módulos recebem os ajustes da navegação e dos campos compartilhados, mas seus fluxos internos não foram integralmente auditados nesta entrega. A validação usa tamanhos de viewport no Chromium; não substitui teste em aparelhos físicos Safari/iOS e Android nem uma auditoria completa de acessibilidade.

Na avaliação com a operação, observar três tarefas: gerente pedir posições, RH preencher parte delas e Caixa localizar a pessoa para pagar. Medir onde há hesitação, retorno de tela ou pedido de ajuda antes de ampliar o redesenho a outros módulos.

## Capturas com dados fictícios

- [Fila de pedidos no celular](ux-20261005/extras-celular.png)
- [Formulário do gerente no celular](ux-20261005/formulario-celular.png)
