/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  // Configure headers for Stockfish WASM
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },

  // Webpack configuration for Stockfish
  webpack: (config, { isServer }) => {
    // Handle Stockfish WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Exclude stockfish from server-side bundling
    if (isServer) {
      config.externals = [...(config.externals || []), "stockfish"];
    }

    return config;
  },
};

module.exports = nextConfig;
