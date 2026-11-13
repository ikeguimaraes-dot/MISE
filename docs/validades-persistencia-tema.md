# Persistência de cadastros, destinos de etiquetas e temas

## Produtos e unidades

Produtos cadastrados pelo MISE são inseridos em `public.ingredients`; a edição atualiza o mesmo registro. A API confirma o ID retornado pelo banco antes de o formulário navegar para a lista. Grupo, categoria, categoria sanitária, fornecedor, unidade de medida e valores numéricos são validados no servidor. A unidade `L` é normalizada para `l`, e custo não informado é salvo como zero, conforme a coluna `custo_padrao NOT NULL DEFAULT 0`. Campos opcionais podem ser limpos na edição.

O cadastro de unidades continua gravando em `public.units`, com vínculo em `company_id` e dados próprios da unidade. O fluxo de empresas e unidades está em [empresas-unidades.md](empresas-unidades.md).

## Validades

`Usado no preparo` grava `status = 'consumida'`. `Descartar (perda)` grava `status = 'descartada'`. A API exige sessão válida, altera apenas o status e confirma o registro retornado pelo banco. A transição só parte de `ativa` ou `vencida`. Repetir a mesma ação é idempotente; uma tentativa de trocar uma ação já finalizada retorna conflito.

Etiquetas consumidas e descartadas ficam fora das pendências e dos vencidos. A interface aplica a alteração local apenas após confirmação da API, recarrega os dados persistidos e informa falhas. Os botões ficam bloqueados durante a gravação para evitar cliques repetidos. Respostas atrasadas de consultas são canceladas ou ignoradas.

Os cards **Usado no preparo** e **Perda** mostram os totais históricos registrados em cada status, respeitando o filtro de unidade. Esses totais incluem registros anteriores à atualização, não apenas cliques da sessão atual. Ao clicar nos cards, a lista mostra o histórico correspondente, sem botões para finalizar novamente.

Os contadores usam `count: 'exact', head: true` no banco. A lista carrega 20 etiquetas por página, com ordenação estável e sem depender do limite padrão de 1000 linhas. `GET /api/validades` retorna lista, contadores e paginação com `Cache-Control: private, no-store`. A tela consulta novamente a cada 30 segundos e possui botão Atualizar. Limites de dia usam America/Sao_Paulo.

## Tema claro e escuro

O botão de sol/lua está no topo do workspace e na tela de acesso. A preferência é salva em `localStorage['mise-theme']` neste navegador, aplicada no `head` antes da pintura e mantida durante a navegação e após recarregar. Abas do mesmo navegador/origem sincronizam a escolha. Quando o armazenamento estiver bloqueado, a troca ainda funciona na página atual. O padrão permanece escuro.

As cores, superfícies, textos, controles e logotipo acompanham o tema. Os estilos estão em `src/app/theme.css`, importado diretamente no layout raiz junto ao seletor e ao script de inicialização. Impressões de etiquetas continuam usando o layout próprio de papel branco.

## Verificação

- `node --test tests/*.test.mjs`.
- `npx tsc --noEmit --incremental false`.
- Transação real no banco com criação de empresa, unidade, produto e etiquetas, seguida de atualização para uso/perda, conferência dos estados e `ROLLBACK`. Uma consulta posterior confirmou zero registros de teste persistidos.
- Testes cobrem contadores com mais de 1000 etiquetas, filtros de unidade, paginação, recarregamento, idempotência, conflitos, falhas de gravação, sessão expirada e persistência de tema.
