/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Audio uploads are validated server-side; the API parses multipart form data.
  experimental: {
    serverActions: { bodySizeLimit: "90mb" },
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
