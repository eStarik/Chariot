const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Next.js 16 requires an absolute path for the Turbopack root
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
