import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev indicator badge so it can't cover the bottom-left nav tab.
  devIndicators: false,
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
