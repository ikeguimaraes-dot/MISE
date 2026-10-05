# Extras real e CRIVO — implementação

Escopo solicitado em 05/10/2026: Extras real (papéis, alçada, recibos), CRIVO laudo/PDF e plano de ação, formatos HeadChef preservando FF Nutri.

Ordem: contrato e testes de Extras → API/telas/recibos → contrato de pontuação CRIVO → laudo/plano → templates HeadChef → validação integrada.

Extras deve usar a tabela existente, identificar os registros geridos pelo MISE, verificar papel/unidade no servidor e novamente na transação, serializar consumo por unidade/semana, registrar todas as decisões e impedir replay de pagamento. Papéis operacionais não serão atribuídos por suposição. Histórico de 709 extras permanece um lote separado; recebimento do SQL não significa que tenha sido importado ou conciliado.

HeadChef exige dois formatos: conformidade simples para inspeções e visita narrativa sem nota. O PDF disponível da Madonna não contém as perguntas conformes, portanto não é suficiente para reconstruir um checklist completo de 67 itens. Preservar achados/orientações sem inventar perguntas ausentes. FF Nutri mantém pesos por tópico e zeragem por item crítico. Fórmula/modelo precisam ficar fixados na execução, sem recálculo retroativo pela edição de template.

Pendências de ativação: usuários por papel de Extras; checklist completo HeadChef para reproduzir toda a inspeção quantitativa, quando não constar nos anexos.


## Entrega implementada

- `/extras`: fluxo real com permissões explícitas por colaborador, casa e papel. `/extras/acessos`: administração dos acessos. A avaliação permanece em `/extras/avaliacao`.
- Solicitação com valor estimado; alçada decide RH ou Diretor de Operação. Aprovação fica vinculada ao valor. Aumento pelo RH pode exigir nova aprovação.
- Financeiro reserva, Caixa informa pagamento da casa com recibo; terceirizada fica no Financeiro. Financeiro confere e encerra. Emergência permite registrar/pagar e exige regularização posterior.
- Comandos transacionais, bloqueio por casa/semana, versão otimista, chave de reenvio, CPF validado somente em cadastros novos, histórico sem cópia do CPF e recibos privados.
- Notificações imediatas são internas, para diretores explicitamente atribuídos com conta Auth. Não há disparo externo por e-mail/WhatsApp nesta entrega.
- `/crivo/relatorios/[id]`: resultado por tópico, parecer, identificação, upload de assinatura, fotos/legendas, PDF e plano com dono/prazo/evidência. A conclusão da visita preserva resultado e respostas; parecer/anexos posteriores complementam o laudo.
- Modelos `ff_ponderado`, `headchef_conformidade` e `headchef_narrativo`. Snapshot guarda modelo, perguntas e pesos em novas visitas. Visitas concluídas anteriores mantêm nota histórica e indicam falta de snapshot.
- Madonna e Frêneze disponíveis como rascunhos inativos no editor. Madonna aguarda checklist completo; Frêneze tem estrutura inicial descritiva de Bar/Cozinha para validação, sem alegar transcrição integral de um checklist.

## Banco

Alinhamento KPH-OS confirmado pelo usuário em 05/10/2026: MISE pode gravar. As migrações foram aplicadas no projeto existente, com 13 visitas abertas recebendo snapshot do cadastro corrente. Nenhum extra foi inserido, pago ou importado; nenhuma permissão operacional foi concedida. Recibos e evidências usam buckets privados. O acesso direto de usuários aos novos extras geridos pelo MISE é restrito; a API devolve apenas campos permitidos.

## Validação

- 29 testes de alçada, avaliação anterior e três metodologias CRIVO.
- PostgreSQL local isolado: ciclo normal, excesso/aprovação, emergência/regularização, CPF inválido, recibo de outra solicitação, concorrência semanal, reenvio, controle de versão e fechamento imutável.
- PostgreSQL local: metodologia congelada, conclusão atômica com verificação de respostas concorrentes, plano com responsável/prazo/evidência e auditoria.
- PDF: geração quantitativa e narrativa, múltiplas páginas, caracteres acentuados, imagens/legendas, plano e assinatura pendente. Exemplo inteiramente fictício em `/tmp/mise-crivo-laudo-exemplo.pdf`.
- TypeScript sem erros. Auditoria npm de dependências de produção sem vulnerabilidades reportadas.
- A sessão disponível no navegador está na tela de login; a validação autenticada pelos usuários de cada papel ainda precisa ocorrer.

## Pendências do usuário

1. Atribuir os colaboradores de cada papel em `/extras/acessos` (nenhum acesso concedido por suposição).
2. Validar e completar os rascunhos HeadChef antes de ativá-los, sobretudo as 67 perguntas da Madonna.
3. Importação dos 709 lançamentos e conciliação/DRE continuam separadas desta implantação.

## Publicação e limites

Uploads via API aceitam até 4 MB por arquivo (PDF, PNG ou JPEG; assinatura apenas imagem). O PDF final é salvo em bucket privado próprio e entregue por URL assinada de 60 segundos. A escolha evita o limite de payload das funções descrito em https://vercel.com/docs/functions/limitations. Dados de recibos não aparecem na listagem geral.

O build local passou com as variáveis disponíveis; segredos de produção não são exportáveis pela Vercel e a verificação de dados reais foi feita pelo conector do banco. As telas autenticadas por papel ainda precisam do teste operacional após atribuição dos usuários.
