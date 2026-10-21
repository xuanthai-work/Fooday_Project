import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev indicator badge so it can't cover the bottom-left nav tab.
  devIndicators: false,
  // Baked into the client bundle so the app can detect a newer deployment.
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
  },
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
