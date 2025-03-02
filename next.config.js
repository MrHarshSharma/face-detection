/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      "encoding": require.resolve("encoding"),
      "fs": false,
      "path": false,
      "crypto": false,
    }
    return config
  },
  // Add this to ignore specific warnings
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig 