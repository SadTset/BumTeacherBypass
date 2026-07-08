const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ['better-sqlite3', '@napi-rs/canvas'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3', '@napi-rs/canvas'];
    }
    return config;
  },
};

module.exports = nextConfig;
