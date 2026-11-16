# Identidade da operação por projeto Vercel

O MISE usa duas variáveis públicas, centralizadas em `src/lib/workspace.ts`:

| Variável | Padrão sem configuração | Projeto Maza |
| --- | --- | --- |
| `NEXT_PUBLIC_MISE_WORKSPACE_NAME` | `KPH Participações` | `Maza` |
| `NEXT_PUBLIC_MISE_WORKSPACE_BADGE` | `KPH` | `MAZA` |

Espaços nas extremidades são removidos. Valores ausentes, vazios ou só com espaços usam o padrão de cada variável independentemente. Ambas são textos públicos, não segredos. O nome e a sigla não são inferidos a partir de domínio, banco, usuário ou unidade.

A configuração aparece na barra lateral (desktop e menu móvel), no login e no acesso por PIN (AuthShell compartilhado), nos cabeçalhos dos relatórios impressos de produção e do painel, no rodapé impresso do painel, na descrição HTML e no manifesto de instalação em `/manifest.json`. Também é usada no exemplo do campo de rede dos pontos de impressão e nas prévias locais. MISE, Orkestri OPX, logos, ícones e o título do aplicativo permanecem iguais. Nomes técnicos da integração KPH, rotas e variáveis de autenticação existentes permanecem iguais.

## Configurar o Maza na Vercel (após revisão)

1. Abra **o projeto Vercel do Maza**, em **Settings → Environment Variables**. A configuração deve ser do projeto, sem propagá-la aos outros projetos do repositório compartilhado.
2. Adicione `NEXT_PUBLIC_MISE_WORKSPACE_NAME` com o valor `Maza` e `NEXT_PUBLIC_MISE_WORKSPACE_BADGE` com o valor `MAZA`, sem aspas, como variáveis públicas de configuração (Config).
3. Selecione **Production** e **Preview** para os ambientes que devem usar a identidade Maza. Inclua **Development** apenas se também quiser esses valores no desenvolvimento local desse projeto. Verifique eventuais overrides de Preview por branch.
4. Depois da aprovação e do merge, execute um **novo build/deploy no projeto do Maza**. Variáveis `NEXT_PUBLIC_*` são incorporadas ao JavaScript no build; alterar apenas as variáveis ou promover um artefato construído com KPH não troca os textos do navegador.
5. Confira login/PIN, nome e sigla no menu lateral, descrição HTML, `/manifest.json` e a prévia de impressão de um relatório. Os textos devem mostrar Maza/MAZA e a marca MISE deve permanecer.

Nos projetos KPH, mantenha as variáveis ausentes para usar os padrões atuais. Nenhuma variável real da Vercel precisa ser alterada para revisar esta PR, e ela não requer migração de banco.

Referências: [Vercel: variáveis por ambiente e projeto](https://vercel.com/docs/environment-variables), [Next.js: variáveis públicas no build](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser).

## Verificação local

```sh
node --test tests/workspace.test.mjs tests/brand.test.mjs
npx tsc --noEmit --incremental false
```

Os testes renderizam navegação e login com os dois conjuntos de valores e verificam metadata, manifesto, cabeçalhos e rodapés impressos. Também cobrem fallback de valores vazios, configuração independente e escape do nome nos relatórios HTML.

Para inspecionar no navegador sem alterar arquivos `.env`:

```sh
NEXT_PUBLIC_MISE_WORKSPACE_NAME=Maza NEXT_PUBLIC_MISE_WORKSPACE_BADGE=MAZA npm run dev:preview
```

Abra `/preview`, `/preview?module=login`, `/preview?module=pin-login`, `/preview/brand` e `/manifest.json`. Pare o servidor antes de trocar o cenário. Para simular os padrões mesmo que existam overrides locais, use valores vazios nas duas variáveis:

```sh
NEXT_PUBLIC_MISE_WORKSPACE_NAME='' NEXT_PUBLIC_MISE_WORKSPACE_BADGE='' npm run dev:preview
```
