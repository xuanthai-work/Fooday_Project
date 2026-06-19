import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // user-pasted dish image URLs can come from any https host
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
