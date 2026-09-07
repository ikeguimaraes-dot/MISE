# Revisão de layout — setembro de 2026

Inicie a revisão local com `npm run dev:preview` e abra http://localhost:3001/preview.

A identidade também está aplicada às telas reais de login e PIN. Para visualizá-las sem credenciais, use `/preview?module=login` e `/preview?module=pin-login`. Essas duas prévias reutilizam os formulários reais com envio desativado; os nomes apresentados no PIN são exemplos identificados.

O componente `MiseBrand` centraliza a marca do menu e das telas de acesso. O símbolo vetorial está em `public/icons/mise-mark.svg`, com versões PNG de 192 e 512 pixels para o aplicativo instalado. O manifesto, o ícone do navegador, a identificação da página e a cor do navegador acompanham a nova identidade.

A prancha completa está em `/preview/brand`, com download das versões vetoriais em `public/brand/`. `MiseBrand` usa o arquivo-mestre `mise-logo-light.svg`. A assinatura de impressão em `src/lib/brand.ts` contém a versão monocromática em linha para não depender de imagens externas. Consulte `public/brand/LEIA-ME.md` para aplicações e orientações de uso.

A identidade 04.4 foi aprovada e aplicada: assinatura personalizada, M e ponto em brasa, I sem pingo, S e E alinhados à base e ponto mais próximo do E. O M isolado aparece no ícone e na página inicial. A navegação, login e PIN usam o arquivo-mestre; os selos e relatórios usam as versões de uma cor. Os SVGs anteriores estão preservados em `public/brand/v1/`, `v2/` e `studies/`. Não houve publicação em produção.

A prévia existe somente em desenvolvimento. A página inicial usa o mesmo componente da aplicação autenticada. O painel (`/preview?module=%2Fpainel`) usa o componente real com dados explicitamente demonstrativos e filtro por unidade. Os demais módulos mostram um aviso de dependência do banco; não há sessão simulada nem gravação de dados.

Com as credenciais atuais em formato de placeholder, o acesso a `/` em desenvolvimento redireciona para `/preview`. Para usar os registros reais, configure as variáveis de ambiente do Supabase e reinicie o servidor. Em produção a prévia retorna 404 após o middleware normal de autenticação.

## Mudanças

- Navegação lateral por função, com menu móvel, busca por módulo (Cmd/Ctrl+K), atalhos contextuais e visibilidade pelo perfil retornado pela sessão existente.
- Página inicial com ferramentas operacionais, guia da rotina e módulos futuros identificados como em desenvolvimento.
- Tokens visuais, tipografia, contraste, foco de teclado e layout responsivo compartilhados pelas páginas existentes.
- Painel com indicadores legíveis, detalhes em diálogo acessível e correção da rota usada pelo filtro de unidade.
- A prévia usa Webpack para evitar o tempo elevado observado na compilação local com Turbopack.

O escopo é visual e de navegação. Formulários internos dos módulos e regras de negócio permanecem para revisões específicas. As APIs e as permissões de banco ainda precisam da revisão de segurança identificada anteriormente.

## Verificação da identidade

Execute `node --test tests/brand.test.mjs` para conferir a correspondência entre o desenho aprovado e os logos ativos, selos, assinatura impressa, símbolo e ícones do manifesto. As URLs dos ícones usam `?v=4.4` para distinguir a identidade aprovada de versões armazenadas em cache.
