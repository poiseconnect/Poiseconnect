/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      ...["/", "/confirm-proposal", "/recover-link", "/booking/:token", "/termin-verwalten/:token", "/api/client-link-recovery/:path*", "/api/public-request"].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      })),
      { source: "/recover-link", headers: [{ key: "Content-Security-Policy", value: "form-action 'self'; frame-ancestors 'none'; base-uri 'self'" }] },
    ];
  },
};

export default nextConfig;
