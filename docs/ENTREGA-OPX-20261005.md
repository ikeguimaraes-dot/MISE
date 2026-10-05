# Entrega OPX / MISE — complemento operacional (05/10/2026)

Escopo: repositório MISE / mise-backoffice. Nenhuma alteração no repositório KPH-OS. Alinhamento para uso de `op_extra` confirmado pelo usuário. Nenhum lançamento histórico importado e nenhum pagamento real registrado durante os testes.

## Extras

- Diretoria: administradores da plataforma. Gerente: solicita na própria unidade. RH, Financeiro e Caixa continuam sendo atribuídos nominalmente em `/extras/acessos`.
- `/extras` mostra a fila do papel, incluindo pedidos antigos. Líder consulta somente as próprias solicitações. Histórico semanal é uma opção separada. Casas disponíveis vêm de `op_extra_alcada`; HOS não aparece.
- Estimativa desconhecida fica nula, com aviso na alçada; o RH define o valor e a transação reavalia a necessidade de aprovação antes da liberação financeira. Não há percentual de alçada fixo no código.
- Fluxo normal: solicitação → Diretoria quando excede → RH → Financeiro → Caixa (Casa) / Financeiro (Estaff) → pago, com recibo. O novo prompt elimina a antiga conferência financeira adicional no fluxo normal; a ação antiga permanece compatível com registros já em `pagamento_informado`.
- Emergência: Caixa registra, anexa recibo e informa pagamento sem aguardar autorização; RH regulariza o cadastro. A diretoria aprova ou registra não ratificação posteriormente. Essa decisão é auditada e nunca apaga uma despesa já paga.
- CPF somente no detalhe de RH/Financeiro/Caixa. Listas, relatórios e payloads externos não contêm CPF. Recibos privados também restritos a esses três papéis, pois podem conter CPF.
- `/extras/envio-caixa`: lista diária imprimível, pagadora e etapa visíveis. Somente “Liberado para pagamento” autoriza o fluxo normal do caixa.
- Painel Geral: custo do dia e quantidade ainda sem valor. `/extras/relatorios`: mês × setor, custo e % sobre faturamento realizado da DRE. Sem receita confirmada, percentual vazio. Metas e orçamento de receita não são usados como faturamento.
- Central de Alertas: emergência ainda não revisada, estouro e pedidos há mais de 24 horas em qualquer etapa. Emergência paga continua visível até revisão da diretoria.

### Alertas externos: configuração ainda pendente

A integração Microsoft 365 conectada exige reautenticação. Um conector usado pelo assistente não fornece automaticamente credenciais ao aplicativo publicado.

A entrega inclui outbox transacional (`mise.extra_notification_outbox`), envio após a gravação, trava de processamento, confirmação por evento e nova tentativa com intervalo progressivo. Falhas não desfazem solicitações nem desaparecem da fila.

Configurar no ambiente de produção, sem colocar credenciais no repositório:

- `EXTRAS_NOTIFICATION_WEBHOOK`: HTTPS de Power Automate ou serviço aprovado que encaminhe o aviso à diretoria.
- `EXTRAS_NOTIFICATION_TOKEN`: token Bearer opcional, se exigido pelo receptor.
- `APP_URL`: URL pública do MISE (há fallback para a URL publicada).
- `EXTRAS_NOTIFICATION_CRON_SECRET`: segredo de um agendador que chame `GET /api/extras/notifications` com Bearer para retentar pendências mesmo quando ninguém usa o app. Agendar a cada minuto no serviço escolhido.

O webhook recebe `event_id`, tipo, unidade, dia de trabalho, total e link autenticado. Deve deduplicar por `event_id` (entrega pelo menos uma vez). Um administrador também pode chamar `POST /api/extras/notifications` autenticado. Sem configuração, a UI avisa explicitamente; não há promessa de e-mail enviado.

## CRIVO

- Cada resposta não conforme gera ação automaticamente na conclusão, na mesma transação. Dono e prazo permanecem vazios até revisão; não são fabricados.
- Auditor revisa orientação, responsável e prazo e libera o plano. Gerente só acessa plano liberado da própria unidade. Resolver exige imagem PNG/JPEG registrada na mesma auditoria.
- `/crivo/plano-acao`: filtros por local, status e vencidas. Alertas: vencidas (crítico) e cinco ou mais abertas no local (atenção), sem limitar a idade da auditoria.
- `/crivo/execucao/[id]/laudo`: impressão A4, nota anterior comparável, datas, auditor/cargo/registro, gráfico de conformidade, pontos perdidos, tabela Possível/Obtido/%, críticos quando existem, geolocalização, itens por tópico, orientações, pessoa orientada, fotos/legendas, parecer, ações e assinaturas.
- Fotos privadas múltiplas por resposta; a primeira preenche `foto_url`. Complementos fotográficos e orientações não permitem reescrever respostas nem a nota de uma visita concluída.
- Visitas abertas podem mostrar nota provisória calculada com as respostas atuais. Evidências e comentários continuam obrigatórios para concluir. A prévia não grava conclusão, nota definitiva ou ações reais.

### Conferência FF Nutri

A execução de teste da Casa de Apoio continha todas as respostas, mas ainda não os comentários/fotos exigidos. O cálculo anterior contava itens igualmente e produzia 56,26%. Foi corrigido para respeitar os pesos dos itens dentro de cada tópico.

Conferência das respostas reais em leitura, sem concluir a visita: **55,85%**. Refeitório: **3,33 / 4,99 = 66,73%**. Tópicos 2, 5 e 6 zerados por críticos; Planilhas em zero. Demais tópicos pontuáveis em 100%. Tópico descritivo de peso zero não participa da nota.

A classificação visual segue o pedido atual: <50 Crítico; <60 Ruim; <75 Regular; <90 Bom; ≥90 Excelente. O PDF original chama 55,85% de “Regular”; a plataforma chama “Ruim” segundo essas faixas explicitamente solicitadas.

### Revisão dos templates Meet

Contagem direta dos identificadores de questões nos PDFs, além da revisão de `docs/analise-relatorios-nutri.md` na cópia de trabalho original:

| Fonte | Questões numeradas no PDF | Cadastro atual |
|---|---:|---:|
| IPH Meet | 222 | 231: 222 originais + 9 de Boas Práticas / Normativa |
| IM Meet | 188 | 188 |
| Casa de Apoio | 59 | 59 |

Os totais 203 e 189 do resumo anterior não correspondem à soma dos tópicos nem aos identificadores de questões do PDF. Não se devem criar/remover questões para alcançar esses totais incorretos.

No IPH Meet, os pesos dos itens extraídos conferem com a fonte; um item tem impressão de peso que não entrou no extrator automático. O tópico adicional de Boas Práticas soma 10 pontos; o cadastro atual soma 110. Ele foi preservado, pois não é parte do documento original nem um erro a ser apagado por suposição. A comparabilidade com o relatório FF exige escolher a versão apropriada.

No IM Meet, a exceção identificada é Confeitaria: fonte mostra zero nos demais itens e 4,09 no forno elétrico; cadastro distribui 0,341 por item (4,092 no total). Continua dependendo de confirmação da consultoria. Nenhum peso do Meet foi alterado nesta entrega.

## HeadChef

Suporte de conformidade simples (conformes / itens aplicáveis), sem pesos ou penalidade crítica, e relatório descritivo sem nota. Uma média de tópicos igualmente ponderados não equivale à proporção de itens quando há quantidades diferentes de perguntas; o motor preserva essa distinção.

Nenhum novo template foi semeado. As duas referências incompletas criadas anteriormente permanecem inativas, marcadas “aguarda questionário completo”, com ativação impedida enquanto estiverem nessa condição.

## Histórico e permissões

- Resumo Operacional gera os dias previstos a partir de `op_horario_padrao`. Datas nunca abertas aparecem como “Não preenchido”, com círculo vazado, e geram alerta. Horário inexistente não fabrica dias de operação.
- APIs e páginas de consulta/execução do RITMO conferem sessão ativa e unidade. Mutações administrativas exigem administrador. Resposta não aceita item de outro template/visita.
- Itens e tópicos são desativados, sem apagar respostas. Reordenação é transacional e limitada ao template informado. Cópia preserva pesos/metodologia e fica inativa se falhar.
- A exclusão física de um relatório diário foi desabilitada; correções e “não se aplica” com justificativa mantêm rastreabilidade.

## Validação

- TypeScript e builds Next nas frentes A, B e C.
- Banco local isolado, dados sintéticos: cinco papéis, pagamento com recibo, emergência, alçada concorrente, reenvio idempotente, versões e tentativas de pular etapas/unidades; nenhum teste grava pagamentos em produção.
- CRIVO: conclusão atômica, snapshot, criação automática/revisão de ações, gerente com PIN, foto obrigatória, nota imutável, preservação da primeira foto e desativação sem exclusão.
- Renderização do componente real de impressão com casos de conformidade, narrativo e respostas da Casa de Apoio. Testes de gráficos/assinaturas e ausência de seções críticas vazias.
- Canal externo testado com receptor simulado: entrega, falha, retentativa e trava. Entrega real depende da configuração acima.
- O navegador de validação não respondeu nesta sessão. A conferência do laudo foi numérica e por renderização automatizada; o aceite visual e a navegação autenticada com os usuários reais continuam pendentes.

## Pendências do negócio

1. Nomear RH, Financeiro e Caixa em `/extras/acessos`.
2. Configurar receptor e agendador dos alertas externos; renovar Microsoft 365 se esse for o canal escolhido.
3. Obter questionários completos da HeadChef.
4. Confirmar a regra da Confeitaria do IM e a versão comparável do IPH Meet com o tópico adicional.
5. Histórico de 709 extras continua aguardando autorização específica de importação e conciliação financeira; alinhamento KPH-OS já concluído.

## Solicitantes por casa — complemento

- Cadastro existente `public.op_extra_solicitante` reutilizado; os nove nomes existentes não foram alterados nem duplicados.
- Formulário de solicitação/emergência exige seleção explícita entre os nomes ativos da casa, ordenados por nome. Não seleciona automaticamente o primeiro nome.
- O comando transacional confere cadastro ativo e unidade e copia o nome para `op_extra.solicitante_nome`. Não confia em um nome enviado pelo navegador. O bloqueio de leitura mantém a cópia consistente com uma renomeação/desativação concorrente.
- `mise_requested_by`, `solicitante_id` e eventos continuam identificando a conta executora. O novo campo é **autodeclarado** e não autentica a identidade de quem usou um login compartilhado.
- `/extras/solicitantes`: apenas administradores; adicionar, renomear, desativar e reativar. Não há exclusão física. A API limita mudanças a nome e situação, sem alterar vínculo de colaborador ou unidade.
- Leitura direta do cadastro pela chave pública bloqueada; o aplicativo usa rotas autenticadas com verificação de unidade/papel.
- Filas e detalhes exibem solicitante, assim como Envio Caixa e o resumo mensal por solicitante nos relatórios. Registros anteriores sem nome permanecem como não informados.
- Testes PostgreSQL isolados: seleção obrigatória, unidade, ativo, cópia do nome, renomeação/desativação sem mudar histórico, rejeição de nome forjado e reenvio após desativação. Testes da API: permissões, ordenação, filtro de ativos, cadastro, edição e desativação.

### Ajuste do processo de Extras — valor único

- Comissão e sequência removidas da operação, avaliação, projeções e impressão do Envio Caixa.
- RPC não envia comissão no INSERT nem permite alterá-la no RH; mantém a coluna compartilhada com default zero e o total gerado pelo banco.
- Migração `20261005_extras_value_only.sql` substitui somente a função de comando. A coluna de sequência já foi removida do banco pelo responsável.
- Histórico privado: 709 lançamentos, R$ 113.535,00. Por decisão explícita do usuário, foram descartados R$ 1.723,50 de comissão (78 registros). INSERT corrigido e validado sem execução; arquivo com dados pessoais permanece fora do Git. Nenhuma importação realizada.
- Validação: testes da alçada e avaliação, fluxo completo em PostgreSQL isolado sem a coluna removida, payload antigo de comissão ignorado na criação e no RH.

### Pedidos de posições e nomeação pelo RH

- Novo pedido grava somente em `op_extra_solicitacao`. Setor/função vêm do catálogo existente; a diária sugerida é editável. Quantidade × diária é calculada no banco, sem enviar `valor_total`.
- Pedidos de posições e Pessoas / pagamentos têm visualizações próprias. RH preenche N blocos e pode salvar parcialmente; cada pessoa gera um extra vinculado, com diária própria e recibo individual. Posições já nomeadas ficam somente para consulta neste formulário, evitando regravar pagamentos.
- A alçada consome o pedido inteiro antes da primeira nomeação e o custo das pessoas nomeadas depois, preservando a quantidade e a estimativa originais. Uma posição preenchida posteriormente recalcula a aprovação. Pessoas vinculadas não são somadas novamente; extras anteriores sem solicitação continuam contando uma única vez.
- Diretoria aprova o pedido. Pessoas ainda não liberadas aguardam aprovação se a nomeação superar o saldo e a autorização anterior. Recursos já liberados/pagos não são reescritos nem podem desaparecer por cancelamento do pedido.
- Emergências geram notificação e alerta já no pedido, antes de existir pessoa. RH nomeia; Caixa ou Financeiro paga por pessoa. O canal externo permanece dependente da configuração já documentada.
- Segurança: comandos transacionais com trava por semana, versão e reenvio idempotente; catálogo e solicitante validados no banco; CPF restrito às permissões existentes. Os testes usam somente PostgreSQL isolado e dados sintéticos.
- Migração `20261005_extras_positions.sql` pressupõe as tabelas públicas de catálogo/solicitação e o vínculo criados pelo responsável do banco. Não importa histórico nem converte registros existentes.
