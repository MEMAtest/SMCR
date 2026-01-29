/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // WORKAROUND: pptxgenjs 4.x uses node: protocol imports that fail in browser builds.
      // Strips the node: prefix, then resolve.fallback aliases the bare module names to false.
      // Tested with: Next.js 14.x, pptxgenjs 4.x. May need updating if either dependency changes.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        stream: false,
        zlib: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
