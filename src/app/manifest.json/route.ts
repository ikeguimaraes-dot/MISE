import { SITE_DESCRIPTION } from '@/lib/workspace'

export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    "name": "MISE · Orkestri OPX",
    "short_name": "MISE",
    "description": SITE_DESCRIPTION,
    "start_url": "/",
    "display": "standalone",
    "background_color": "#171716",
    "theme_color": "#171716",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "/icons/mise-192.png?v=4.4",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icons/mise-512.png?v=4.4",
        "sizes": "512x512",
        "type": "image/png"
      },
      {
        "src": "/icons/mise-512.png?v=4.4",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ]
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
