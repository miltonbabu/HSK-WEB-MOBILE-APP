import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['sql.js'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.fallback = { ...config.resolve?.fallback, fs: false, path: false, crypto: false }
    return config
  },
}

export default nextConfig
