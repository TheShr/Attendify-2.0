/** @type {import('next').NextConfig} */
const nextConfig = {
  // The frontend uses NEXT_PUBLIC_BACKEND_URL to call the backend directly.
  // In production on Vercel, the backend host should be configured as
  // NEXT_PUBLIC_BACKEND_URL, with legacy support for NEXT_PUBLIC_API_URL.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
