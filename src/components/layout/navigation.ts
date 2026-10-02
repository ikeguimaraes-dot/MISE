import { House, LayoutDashboard, Tag, Clock3, ClipboardCheck, BookOpen, ShieldCheck, Bell, Package, FolderTree, Users, UserCheck, Printer, KeyRound, FileChartColumn, ChefHat, PackageCheck, ClipboardList, type LucideIcon } from 'lucide-react'

export type WorkspaceRole = 'admin' | 'gerente' | 'cozinheiro'
export type NavigationItem = { href: string; label: string; description: string; icon: LucideIcon; access?: 'gestor' | 'admin'; upcoming?: boolean; parent?: string }

export const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: 'Visão geral', items: [
    { href: '/', label: 'Início', description: 'Sua central de operação', icon: House },
    { href: '/painel', label: 'Painel da operação', description: 'Indicadores e atividade do dia', icon: LayoutDashboard, access: 'gestor' },
    { href: '/alertas', label: 'Central de alertas', description: 'Pontos de atenção da operação', icon: Bell, access: 'admin' },
  ] },
  { label: 'Operação', items: [
    { href: '/etiquetas', label: 'Etiquetas', description: 'Identificação e rastreabilidade', icon: Tag },
    { href: '/validades', label: 'Validades', description: 'Controle de vencimentos', icon: Clock3 },
    { href: '/checklists', label: 'Checklists', description: 'RITMO · rotinas e conferências', icon: ClipboardCheck },
    { href: '/checklists/historico', label: 'Histórico de checklists', description: 'Execuções e resultados anteriores', icon: Clock3, parent: '/checklists', access: 'gestor' },
    { href: '/relatorio-diario', label: 'Resumo operacional', description: 'TURNO · fechamento do dia', icon: BookOpen, access: 'gestor' },
    { href: '/extras', label: 'Extras · avaliação', description: 'Teste o fluxo de solicitação, aprovação e pagamento com dados fictícios', icon: Users, access: 'gestor' },
    { href: '/relatorio-diario/painel-geral', label: 'Painel geral', description: 'Resumo executivo por unidade', icon: LayoutDashboard, parent: '/relatorio-diario', access: 'admin' },
    { href: '/crivo', label: 'Auditorias', description: 'CRIVO · padrões e conformidade', icon: ShieldCheck, access: 'admin' },
    { href: '/crivo/templates', label: 'Templates de auditoria', description: 'Modelos de avaliação CRIVO', icon: ClipboardCheck, parent: '/crivo', access: 'admin' },
    { href: '/crivo/relatorios', label: 'Relatórios de auditoria', description: 'Resultados e comparativos CRIVO', icon: FileChartColumn, parent: '/crivo', access: 'admin' },
  ] },
  { label: 'Gestão', items: [
    { href: '/relatorios', label: 'Relatório de produção', description: 'Histórico e consolidados', icon: FileChartColumn, access: 'gestor' },
    { href: '/cadastros/produtos', label: 'Produtos', description: 'Insumos e preparações', icon: Package, access: 'gestor' },
    { href: '/cadastros/produtos/importar', label: 'Importar produtos', description: 'Importação de planilhas do catálogo', icon: PackageCheck, parent: '/cadastros/produtos', access: 'gestor' },
    { href: '/cadastros/grupos', label: 'Grupos de produtos', description: 'Organização do catálogo', icon: FolderTree, access: 'gestor' },
    { href: '/cadastros/funcionarios', label: 'Funcionários', description: 'Equipe e acesso à operação', icon: Users, access: 'gestor' },
    { href: '/cadastros/responsaveis', label: 'Responsáveis', description: 'Responsáveis pelas etiquetas', icon: UserCheck, access: 'gestor' },
  ] },
  { label: 'Configurações', items: [
    { href: '/configuracoes/pontos-impressao', label: 'Pontos de impressão', description: 'Impressoras por unidade', icon: Printer, access: 'gestor' },
    { href: '/configuracoes/pins', label: 'PINs de acesso', description: 'Acesso da equipe', icon: KeyRound, access: 'gestor' },
  ] },
  { label: 'Em desenvolvimento', items: [
    { href: '/producao', label: 'Produção', description: 'Planejamento das produções', icon: ChefHat, upcoming: true },
    { href: '/recebimento', label: 'Recebimento', description: 'Conferência de mercadorias', icon: PackageCheck, upcoming: true },
    { href: '/inventario', label: 'Inventário', description: 'Contagem e controle de estoque', icon: ClipboardList, upcoming: true },
  ] },
]

export function canSeeItem(item: NavigationItem, role: WorkspaceRole) {
  return !item.access || (item.access === 'admin' ? role === 'admin' : role !== 'cozinheiro')
}

export function workspaceHref(href: string, preview = false) {
  return preview ? (href === '/' ? '/preview' : `/preview?module=${encodeURIComponent(href)}`) : href
}

export function activeNavigation(pathname: string) {
  return navigationGroups.flatMap(group => group.items)
    .filter(item => item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}
