/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['fuelify.com', 'dashboard.fuelify.com', 'localhost'],
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/dguu7htoa/**',
      },
    ],
  },
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
