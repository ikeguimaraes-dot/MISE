# Extras — avaliação do fluxo

Rota `/extras`, menu **Extras · avaliação**, disponível para gestores autenticados. Administrador consulta casas ativas; gerente vê sua unidade vinculada. Metas e consumo agregado são consultados apenas por leitura; solicitações de avaliação usam dados fictícios e localStorage por usuário. Não inserir dados pessoais ou operacionais.

## Atualização de 05/10/2026

Alçada semanal de segunda a domingo com percentual versionado por casa e metas por competência diária. Teto, consumo real + testes e saldo projetado ficam visíveis, com aviso de metas faltantes e cores de consumo. Testes não consomem alçada real.

Fluxo normal dentro da alçada: Líder solicita com estimativa → RH completa → Financeiro libera → Caixa informa pagamento demonstrativo → Financeiro confere. Acima da alçada: Diretoria decide ANTES do RH. A emergência é exceção que permite informar pagamento, com alerta demonstrativo imediato; RH regulariza e Financeiro confere depois. Estaff segue com Financeiro.

Para testar a decisão: **Aprovações → selecionar solicitação → Simular Diretor de Operação → Aprovar solicitação**. Dados de teste persistem no próprio navegador. Testes criados na versão anterior mantêm histórico e indicação do fluxo anterior; “Reiniciar exemplos” restaura os exemplos da regra nova após confirmação.

Nenhuma operação demonstrativa grava em `op_extra`, efetua pagamento, coleta CPF, armazena recibos reais ou envia notificações. Os papéis no seletor são simulações, sem efeito sobre permissões reais.

Detalhes e limites: [EXTRAS-ALCADA-SEMANAL.md](./EXTRAS-ALCADA-SEMANAL.md). Implementação compartilhada: `src/components/extras-evaluation`; cálculo e leitura em `src/lib/extras`. A rota `/preview/extras` continua disponível somente em desenvolvimento e usa metas sintéticas, sem fallback desse tipo na rota publicada.

Testes: `node --experimental-strip-types --test scripts/extras-alcada.test.mjs scripts/extras-preview.test.mjs`.
