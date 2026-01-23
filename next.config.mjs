/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable strict mode for development
  reactStrictMode: false,

  // Allow cross-origin requests from Tailscale network
  // Note: Next.js doesn't have built-in allowedDevOrigins config
  // Cross-origin access is handled by browser CORS policies
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
