/** @type {import('next').NextConfig} */
const nextConfig = {
  // The frontend uses Next.js API routes to proxy requests to the backend.
  // In production on Vercel, the backend host is supplied through
  // NEXT_PUBLIC_API_URL and the proxy routes build the full backend URL.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
