/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'xlsx'],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
