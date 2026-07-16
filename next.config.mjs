/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const noStoreHeaders = [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'Pragma', value: 'no-cache' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ]
    return [
      { source: '/', headers: noStoreHeaders },
      { source: '/connect', headers: noStoreHeaders },
      { source: '/courses/:path*', headers: noStoreHeaders },
      { source: '/api/canvas/:path*', headers: noStoreHeaders },
      { source: '/api/workspace/:path*', headers: noStoreHeaders },
    ]
  },
}

export default nextConfig
