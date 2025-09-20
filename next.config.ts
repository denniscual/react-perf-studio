import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // We temporarily set this into `true` due to issue in `react-scan-dist`.
    //
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
