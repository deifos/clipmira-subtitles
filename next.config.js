/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude ONNX runtime from client-side bundling (for transformers.js)
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