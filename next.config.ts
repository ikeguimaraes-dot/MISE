import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  outputFileTracingIncludes: { '/api/eventos/app': ['./eventos/index.html'] },
}

export default nextConfig
