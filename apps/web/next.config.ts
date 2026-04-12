import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wup/supabase"],
  // Monorepo: native optional deps (e.g. lightningcss-win32-x64-msvc) live in root node_modules
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
