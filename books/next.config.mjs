/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We run our own checks in CI and the money tests. Do not let a lint or type
  // warning block a production build while the app is young.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    // Baseline security headers. This is financial software, so lock down the
    // obvious footguns from the first commit. A fuller policy lands in the
    // security milestone.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
