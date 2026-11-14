import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN / Tailscale hosts that open this `next dev` server (DHCP can change the Wi‑Fi IP).
  allowedDevOrigins: ["127.0.0.1", "192.168.1.11", "192.168.1.38", "100.94.10.68"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
