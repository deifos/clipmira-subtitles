/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
    '@remotion/cli',
  ],
  webpack: (config, { isServer }) => {
    // Exclude ONNX runtime and Remotion packages from client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      config.externals = [
        ...config.externals,
        '@remotion/bundler',
        '@remotion/renderer',
        '@remotion/cli',
        'onnxruntime-node',
      ];
    }
    
    // Ignore ONNX runtime binary files in webpack
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });
    
    return config;
  },
};

module.exports = nextConfig;