const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH = new RegExp(`^${UUID}/${UUID}/[0-9a-f-]+\\.(?:jpe?g|png|webp)$`, 'i')
export const PHOTO_ROUTE = '/api/checklists/foto'

export function checklistPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    let path = value
    if (value.startsWith(`${PHOTO_ROUTE}?`)) {
      path = new URL(value, 'https://mise.invalid').searchParams.get('path') ?? ''
    } else if (value.startsWith('https://')) {
      const url = new URL(value)
      const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
      const prefix = '/storage/v1/object/public/checklist-photos/'
      if (url.origin !== origin || !url.pathname.startsWith(prefix) || url.search || url.hash) return null
      path = decodeURIComponent(url.pathname.slice(prefix.length))
    }
    return PATH.test(path) ? path : null
  } catch { return null }
}

export function checklistPhotoUrl(value: string | null | undefined): string {
  const path = checklistPhotoPath(value)
  return path ? `${PHOTO_ROUTE}?path=${encodeURIComponent(path)}` : ''
}
