import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i2c.seadn.io" },
      { protocol: "https", hostname: "raw2.seadn.io" },
      { protocol: "https", hostname: "i.seadn.io" },
    ],
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/logo.png" }];
  },
};

export default nextConfig;
