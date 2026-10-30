/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Emit a self-contained server (`.next/standalone`) for the Docker image and
   * for any host that runs the build output directly. `next start` keeps working
   * for the plain `npm run start` flow, so this changes nothing locally.
   */
  output: "standalone",
  // The app is previewed through a proxied host in sandboxes; allow those dev
  // origins so Next does not block its own asset requests.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app", "*.arena.ai"],
  // Audio uploads are validated server-side; the API parses multipart form data.
  experimental: {
    serverActions: { bodySizeLimit: "90mb" },
  },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        // The service worker must never be served from a stale cache, and it
        // needs to be allowed to control the whole origin.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
