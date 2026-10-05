# Alçada semanal — avaliação de 05/10/2026

Escopo confirmado por Henrique: atualizar a avaliação primeiro. Não ativar solicitações, pagamentos ou notificações reais. A nova regra substitui a aprovação universal e a autorização prévia da emergência para solicitações NOVAS da avaliação; testes anteriores permanecem identificados como fluxo anterior, com histórico intacto.

## Regra implementada

- Segunda a domingo pela data de trabalho; sem saldo acumulado. Dinheiro em centavos.
- Cada dia busca a própria competência em `metas_dia_semana`; `metas_dia_override` tem precedência, inclusive meta zero.
- Percentual de `op_extra_alcada`: versão mais recente vigente na data do trabalho/referência. Não usa versão futura nem percentual padrão no código de produção. Configuração ausente resulta em teto zero e aviso, sem impedir a solicitação. Vigências duplicadas geram erro explícito.
- Dias sem meta entram com zero e aviso com a quantidade. Nos últimos sete dias do mês, verifica os sete dias da semana na competência seguinte. HOS não ganha isenção implícita.
- Consumo soma todos os estados, exceto recusado/cancelado, por casa e data de trabalho. Consultas paginadas para evitar truncar 1.000 registros.
- Valor estimado + comissão passam a ser informados pelo solicitante. Cabe no saldo → RH; excede → `aguardando_diretoria` antes do RH. Aprovação cobre o valor registrado; aumento no RH passa por nova avaliação. A própria solicitação é excluída do consumo anterior nesse recálculo.
- Emergência permite informar pagamento demonstrativo sem esperar aprovação da diretoria e gera sinalização imediata na avaliação. Comprovante, regularização do RH e conferência do Financeiro continuam necessários. Estaff permanece com Financeiro.
- Falha de consulta não é tratada como meta real zero: a tela mostra indisponibilidade; o registro normal continua possível e segue para análise da diretoria. Não mostra excesso calculado como fato quando não conseguiu consultar a fonte.

## Interface e isolamento

`/extras` exige gestor autenticado. Administrador consulta casas ativas; gerente apenas `employees.unit_id`. Endpoint GET `/api/extras/alcada` repete autorização por papel/unidade antes da consulta com service role. Não entrega CPFs ou detalhes individuais dos extras.

Cabeçalho fixo mostra semana, percentual, teto, gasto real + testes e saldo projetado. A composição real/simulada é explícita. Âmbar acima de 80%; vermelho acima de 100%; teto zero não exibe Infinity ou NaN. Metas reais nunca recebem os testes locais. O formulário explica o caminho antes do envio e mostra o excesso quando a consulta está disponível.

A rota local `/preview/extras` usa metas SINTÉTICAS de setembro/outubro apenas para testar sem credenciais. Não são metas oficiais e não servem como fallback no modo publicado. HOS e meses não cobertos demonstram ausência de meta.

Os dados de teste continuam na mesma chave por usuário, agora payload v3. Exemplos novos usam a regra semanal; testes antigos são preservados com indicação visível. “Reiniciar exemplos” é opcional e exige confirmação. O filtro do dia não reduz o gasto da semana.

## Alertas

- Na avaliação: alçada excedida → atenção; espera na diretoria acima de 24h → crítico, considerando todas as datas; emergência → aviso imediato na tela. Nenhum e-mail, WhatsApp ou push é enviado.
- Central de Alertas: leitura de `op_extra` real, sem misturar registros do navegador. Consumo da semana acima do teto → atenção; `aguardando_diretoria` por mais de 24h → crítico; emergenciais ativos → crítico. Configuração incompleta e erros de consulta têm avisos separados.
- Como a nova solicitação entra diretamente em `aguardando_diretoria`, a leitura do banco usa `created_at` para o prazo. Antes de ativar transições reais que reenviem ao Diretor, criar timestamp específico de entrada na etapa/histórico: `updated_at` não representa esse evento com segurança. Na avaliação, o prazo usa `stageAt`.
- Os links da Central abrem a unidade/data na avaliação. Não existe aprovação real por essa tela enquanto o módulo permanecer demonstrativo.

## Verificação

`node --experimental-strip-types --test scripts/extras-alcada.test.mjs scripts/extras-preview.test.mjs`: 21 cenários, incluindo fronteiras de semana/ano, competência diária, override zero, ausência de meta/configuração, vigência futura, centavos, limite exato/um centavo acima, percentuais de cor, mais de 24h, aprovação antes do RH, aumento de valor e exceção emergencial. Os oito cenários anteriores validam a compatibilidade com testes antigos.

O banco foi inspecionado apenas por leitura: metas de outubro já existem, e as configurações das quatro casas começam em 05/10/2026. Não foram aplicadas migrações ou alterados registros. A ativação real ainda exige contrato de permissões, preenchimento progressivo, histórico e notificações confiáveis/atômicas; esta avaliação não substitui esses controles.
