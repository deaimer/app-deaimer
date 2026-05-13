import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  // Proxy Firebase Auth routes through this domain so authDomain can be set
  // to app.deaimer.com — eliminates the cross-origin redirect error.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://deaimer.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://deaimer.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
