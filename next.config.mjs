/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app is previewed through a proxied host in sandboxes; allow those dev
  // origins so Next does not block its own asset requests.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app", "*.arena.ai"],
  // Audio uploads are validated server-side; the API parses multipart form data.
  experimental: {
    serverActions: { bodySizeLimit: "90mb" },
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
