# Extras — avaliação do fluxo

Rota `/extras`, disponível para gestores autenticados (`admin` e `gerente`) pelo menu **Extras · avaliação**. Não altera autenticação, papéis existentes ou regras de acesso aos módulos operacionais. O servidor valida a sessão e o papel antes de renderizar a avaliação.

Esta versão utiliza apenas exemplos e estado no navegador, separado por usuário autenticado. Nenhuma operação do módulo grava em `op_extra`, efetua pagamento, coleta CPF, armazena recibos reais ou envia notificações. Os papéis no seletor são simulações, sem efeito sobre permissões reais. Não inserir dados pessoais ou operacionais.

Fluxo normal: Líder solicita → RH completa → Diretor de Operação aprova/recusa → Financeiro libera → Caixa informa pagamento e comprovante demonstrativo → Financeiro confere e encerra. Na emergência, a aprovação do Diretor precisa ocorrer antes do pagamento; o RH pode regularizar depois. O fluxo Estaff é demonstrativo e precisa de validação operacional.

Para testar a decisão: **Aprovações → selecionar solicitação → Simular Diretor de Operação → Aprovar solicitação/Aprovar emergência**. Dados de teste persistem apenas no próprio navegador. “Reiniciar exemplos” restaura os seis registros após confirmação.

Implementação compartilhada: `src/components/extras-evaluation`. A rota `/preview/extras` continua disponível apenas em desenvolvimento. Testes: `node --experimental-strip-types --test scripts/extras-preview.test.mjs` (8 cenários). O fluxo real, suas permissões, integração financeira e eventual importação histórica dependem da avaliação e das decisões de schema; esta entrega não os ativa.
