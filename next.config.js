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
    // Increase memory limit
    config.performance = {
      ...config.performance,
      maxAssetSize: 1024 * 1024 * 1024,
      maxEntrypointSize: 1024 * 1024 * 1024
    }
    return config
  },
  // Add this to ignore specific warnings
  typescript: {
    ignoreBuildErrors: true,
  },
  // Add cross-origin isolation headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
          {
            key: "Cross-Origin-Isolation",
            value: "same-origin",
          }
        ],
      },
    ]
  },
  experimental: {
    largePageDataBytes: 1024 * 1024 * 1024, // 1GB
  },
}

module.exports = nextConfig 