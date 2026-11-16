// Direct references let Next.js inline the same public values in client and server builds.
export const WORKSPACE_NAME = process.env.NEXT_PUBLIC_MISE_WORKSPACE_NAME?.trim() || 'KPH Participações'
export const WORKSPACE_BADGE = process.env.NEXT_PUBLIC_MISE_WORKSPACE_BADGE?.trim() || 'KPH'
export const SITE_DESCRIPTION = `Operação, rotinas e qualidade em cada unidade — ${WORKSPACE_NAME}`
