/** @type {import('next').NextConfig} */
const nextConfig = {
  // Override the default webpack configuration
  webpack: (config: any) => {
    // Handle import.meta
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    // Handle node-specific modules
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };

    return config;
  },
};

module.exports = nextConfig;
