/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server Actions are enabled by default in Next.js 14
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
