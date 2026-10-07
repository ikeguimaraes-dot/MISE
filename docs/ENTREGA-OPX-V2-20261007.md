# OPX / MISE — Super Prompt v2 · 07/10/2026

Escopo: somente MISE / mise-backoffice. Integração com o banco compartilhado autorizada pelo usuário; nenhum arquivo do KPH-OS alterado. Nenhum pagamento real, importação histórica ou encerramento de auditoria real foi feito nos testes.

## A — Extras antecipado

- Função agrupada por `setor_padrao`, ordenada por `ordem`. Setor derivado novamente no banco; o navegador não pode forjá-lo. Os seis valores de referência nulos continuam vazios e obrigatórios, sem estimativa inventada. Máscara reaproveita `moedaAoDigitar` / `moedaParaExibicao` do TURNO.
- “Seu papel” lista gerentes ativos da casa. Escolha define papel líder e solicitante declarado; trocar de casa limpa a identificação. Demais papéis dependem da permissão de acesso. A conta executora e o nome declarado continuam distintos.
- “Planejar semana” permite múltiplas demandas nos sete dias, mostra total e consumo projetado com pedidos existentes. Até 70 demandas por envio; transação única, trava semanal e chaves estáveis para repetição segura. Falha não grava parte do plano. O servidor verifica a alçada novamente no envio.
- Percentual de alçada vem da configuração versionada do banco (0,85% nas quatro casas), sem constante 0,85 no código. Preservada regra de consumo: estimativa do pedido antes da nomeação; pessoas efetivamente nomeadas depois; sem somar pessoas vinculadas em duplicidade.
- Caixa pode identificar pessoas de uma emergência antes do RH, inclusive sem CPF conhecido. Anexa recibo e informa pagamento. Sem regularização cadastral, fica `pagamento_informado`; RH regulariza sem alterar o valor já pago. Diretoria revisa posteriormente. Ausência de recibo impede pagamento; dados ausentes nunca são fabricados.
- Mix de antecedência e evolução semanal nos relatórios: planejado (2+ dias), curto (1), reativo (0), emergencial (flag). Datas ausentes/invertidas têm categoria própria. Unidade de contagem é solicitação, não posição; histórico anterior sem solicitação conta por lançamento. Essa diferença é explicitada na tela.
- Alerta semanal dispara **estritamente acima de 80%** de solicitações reativas. Configurável por `EXTRAS_REACTIVE_THRESHOLD_PERCENT`, default 80. Inclui espera >24h em cada etapa individual sem duplicar alerta de emergência de pedido/pessoa.
- Canal externo continua pendente de `EXTRAS_NOTIFICATION_WEBHOOK` e agendamento autenticado, descritos em `ENTREGA-OPX-20261005.md`. A fila durável e a retentativa estão implementadas/testadas; entrega externa real não foi ativada nem declarada como enviada.

## B e D — Laudo e plano

- Preservadas geração transacional de ações, revisão com orientação/dono/prazo, resolução com evidência, múltiplas fotos/legendas, nota anterior, geolocalização e assinaturas.
- Renderização e impressão A4 comparadas visualmente com o PDF FF Nutri. Capa mais compacta; tabelas com cabeçalho repetido, linhas preservadas e espaço para gráficos.
- Respostas reais da Casa de Apoio calculam **55,85%**; Refeitório **66,73%**. Relatório de conferência marcado provisório. Original classifica 55,85 como Regular; MISE segue as faixas solicitadas e classifica como Ruim.
- **Aceite B incompleto:** execução real segue `em_andamento`; seis não conformidades ainda não têm os comentários exigidos. Fotos de inspeção são opcionais para concluir, conforme decisão de 02/09 reafirmada nesta revisão; ausências aparecem como “SEM FOTO”. O teste de impressão dispensa apenas comentários na fixture de conferência, nunca na API de conclusão. Nenhuma auditoria real foi encerrada automaticamente.
- HeadChef quantitativo e narrativo renderizam sem seção crítica vazia. Nenhum template de Madonna/Frêneze foi inventado ou ativado: questionários completos continuam necessários.

## C — Equipamentos

- `/crivo/[localId]/equipamentos`: administrador cadastra, edita, desativa/reativa. Sem exclusão. API confere sessão ativa, papel e local, com campos permitidos explícitos.
- Editor de itens CRIVO permite “por equipamento” e tipo. Uma nova execução congela equipamentos ativos e expande o item por tipo/local; peso original dividido por N.
- Snapshot guarda identidade lógica por equipamento; resposta persiste item original + `equipamento_id`. Fotos, edição, nota, relatório e geração de ações resolvem a mesma identidade. Respostas de equipamentos diferentes não se sobrescrevem.
- Equipamento inativo não entra; local sem aquele tipo omite o item. Renomear/desativar depois não muda auditorias abertas ou concluídas. Nenhum equipamento real foi semeado.

## Apêndice

- Mantidas exclusão operacional de HOS, geração de dias não preenchidos pelo horário e verificação de unidade no RITMO.
- TURNO registra `enviado_employee_id` da sessão no período e no fechamento diário, inclusive quando `employees.user_id` é nulo. `enviado_por` continua reservado à identidade Auth quando existe. Sem ligação artificial entre contas, sem preencher autores históricos por suposição. Conta compartilhada não autentica a pessoa física.
- Histórico privado regenerado: `../entregas/extras-historico-corrigido-20261007.sql`, 709 linhas, **R$ 113.535,00**, sem `comissao`, `sequencia` ou `total` no INSERT. Enum `quadro_clt`; 145 CPF nulos (144 ausentes + 1 curto), sem inventar zeros; pagamentos anteriores ao trabalho anulados. **Não importado**. Quitação histórica e autorização de importação ainda precisam ser confirmadas.
- Revisão Meet preservada: PDF IPH 222 questões, banco 231 (9 normativas extras); IM 188 em ambos. Confeitaria IM e versão comparável do IPH dependem da consultoria; nenhum peso alterado.

## Validação e publicação

- PostgreSQL local isolado: planejamento atômico/repetível, cinco papéis, alçada, nomeação parcial 2/3, emergência sem CPF, recibo obrigatório e regularização. CRIVO: 12 versus 3 equipamentos com mesmo peso, identidades independentes, duplicação/forja rejeitada, snapshots imutáveis e ação por equipamento.
- APIs: limite por unidade/papel, CPF protegido, gestão de equipamentos administrativa e desativação no local correto; autoria do TURNO persistida sem vínculo Auth inventado.
- 25 testes de alçada, calendário, pontuação e PDF passaram, além dos testes de APIs, notificações, antecedência e banco.
- Navegador isolado em **320, 390, 768, 1024 e 1440 px**: sem transbordamento horizontal, filas/detalhes, voltar com foco, busca, formulários de gerente/RH/Caixa, moeda/estimativa, planejamento e referências vazias; gestão de acesso/equipamentos e impressão do caixa em celular/desktop. Dados sintéticos e APIs interceptadas: não equivale a aceite operacional dos cinco usuários reais.
- `tsc --noEmit` e `next build` executados nas etapas e novamente antes de publicar. Aviso conhecido do Next sobre migração futura de middleware para proxy permanece não bloqueante.
- Quatro migrações v2 aplicadas em 07/10/2026: planejamento, regularização emergencial, expansão por equipamentos e autoria TURNO. Schema existente introspectado antes, funções comparadas com as originais antes da aplicação. Contagens após migração: zero solicitações/zero equipamentos reais (testes não poluíram produção).

## Correção — foto de inspeção não bloqueia conclusão

Decisão de 02/09 reafirmada pelo usuário: `requer_foto` orienta o registro visual e não impede concluir CRIVO. A validação de foto foi removida do motor usado pela API de conclusão; respostas e comentários obrigatórios continuam validados e a pontuação não muda pela presença/ausência da foto.

Não conformidades sem imagem exibem “SEM FOTO” na execução, revisão e laudos HTML/PDF. O resumo deixa explícito que é possível concluir sem fotos. Nenhum template, snapshot ou dado histórico foi alterado.

A resolução de `crivo_plano_acao` continua exigindo imagem de evidência válida, vinculada à auditoria, que alimenta `evidencia_url`. Testes de regressão: conclusão via API sem foto com flag `sim`; igualdade de nota com/sem fotos nos três estilos; ausência de resposta/comentário exigido ainda rejeitada; PostgreSQL isolado rejeita resolver ação sem evidência e aceita com evidência. A mudança não conclui automaticamente execuções existentes.

## Ajuste de uso — responsável e contexto emergencial

- `/extras`: rótulo “Responsável”, com os mesmos nomes, papéis e permissões.
- Removido seletor “Data de referência”. Cabeçalho e planejamento usam a semana do dia operacional corrente em São Paulo (mesma convenção do TURNO), atualizada ao retornar à janela e a cada minuto. Parâmetro antigo `data` e data futura de uma solicitação não deslocam o cabeçalho. Consultas de outras semanas ficam nos relatórios; links diretos para pedidos antigos continuam abrindo seus detalhes.
- Checkbox Emergencial é o primeiro campo. “Contexto emergencial” aparece imediatamente abaixo, apenas quando marcado, e é opcional. Ausência/branco grava null. Solicitação normal e planejamento semanal não exigem contexto; nenhuma justificativa é inventada e textos históricos são preservados.
- A data do trabalho continua no pedido. A aprovação desse pedido considera sua semana de trabalho, sem alterar a semana corrente exibida no cabeçalho.
- Migração substitui apenas a função MISE de solicitação para remover a exigência do contexto; schema compartilhado já permite null. Testes em PostgreSQL isolado cobrem normal/emergencial sem contexto, branco, texto preenchido e herança pelo RH. Testes de calendário cobrem virada domingo/segunda em São Paulo; navegador cobre ordem/visibilidade, rótulo, envio emergencial vazio e estabilidade da semana ao solicitar data futura.

## Grade semanal de Extras — atualização de 07/10

O gerente abre `/extras` diretamente em **Planejar semana**. O pedido avulso e a emergência do Caixa permanecem disponíveis. A grade permite adicionar funções agrupadas por setor, editar diárias, distribuir quantidades, acompanhar custos por dia e copiar as quantidades da semana anterior sem enviar.

**Decisão posterior ao build:** o usuário pediu “Planejamento diário por período”. Por isso, o seletor **Período da grade** alterna almoço, jantar, manhã e eventos, preservando os rascunhos dos outros períodos. A identidade do pedido passa a ser **casa + data + função + período**; almoço e jantar do mesmo dia não se sobrescrevem. **Enviar semana** envia todos os períodos preenchidos; a alçada soma todos eles e os demais pedidos da casa. Navegação permite a semana corrente e semanas futuras; consultas históricas continuam nos relatórios.

- Dias sem operação, conforme `op_horario_padrao`, ficam desabilitados e o banco rejeita novas quantidades nesses dias. Casa sem horário é explicitamente sinalizada.
- Diárias ausentes no catálogo precisam ser preenchidas. Diárias e motivos salvos são preservados ao reabrir; a edição da diária por função se aplica às suas células editáveis daquele período.
- Reabrir carrega os pedidos persistidos. Reenviar não duplica. Zerar/remover e enviar cancela os pedidos editáveis, preservando o histórico e seus valores originais.
- Solicitações com pessoas nomeadas ficam travadas, inclusive quando voltaram a aguardar diretoria. Emergenciais, registros de outro fluxo/autor e múltiplos pedidos na mesma célula também são preservados como leitura. Ajustes passam pela fila/RH.
- Uma revisão da semana protege contra sobrescrever alterações concorrentes. A transação inteira é validada antes de gravar; tentativas com a mesma chave são idempotentes. A identidade declarada não é tratada como autenticação individual.
- A prévia substitui o custo já salvo das células editáveis pelo rascunho; não soma duas vezes. O servidor recalcula a alçada sob trava da semana. Se o conjunto exceder o teto, os pedidos novos/alterados vão à diretoria; pedidos inalterados mantêm sua etapa.
- Mantidos o percentual configurável no banco, as metas por competência de cada dia, avisos de metas ausentes, antecipação nos relatórios e alerta de reativas acima de 80%.

Migração: `db/migrations/20261007_extras_week_grid.sql`. Somente funções e tabela privada de idempotência em `mise`; sem nova restrição de unicidade na tabela compartilhada, sem importação histórica. A interface usa GET/PUT autenticados em `/api/extras/planejamento`; o POST anterior continua compatível.

Validação específica: `scripts/extras-grid-db.test.mjs`, `scripts/extras-grid-model.test.cjs`, `scripts/extras-grid-ui.test.cjs` e cobertura de API em `scripts/opx-v2-api.test.cjs`. Casos incluem seis solicitações, reload, cancelamento, repetição idempotente, concorrência, separação de períodos, domingo fechado, diária ausente, estouro da alçada e bloqueio após atuação do RH. Testes de banco usam PostgreSQL isolado; testes visuais interceptam APIs com dados fictícios.
