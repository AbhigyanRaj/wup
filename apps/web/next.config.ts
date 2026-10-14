import path from "node:path";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const isPreviewDeploy = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex" }];

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@wup/contracts"],
  trailingSlash: false,
  // Monorepo: native optional deps (e.g. lightningcss-win32-x64-msvc) live in root node_modules
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  images: {
    qualities: [70, 80, 90],
    formats: ["image/avif", "image/webp"],
  },
  // MDX sources and OG assets are read with fs at request time by dynamic routes.
  outputFileTracingIncludes: {
    "/**": ["./src/content/**/*.mdx", "./assets/**/*"],
  },
  async redirects() {
    return [
      { source: "/integrations/mongodb", destination: "/chat-with-mongodb", permanent: true },
      { source: "/integrations/google-sheets", destination: "/chat-with-google-sheets", permanent: true },
      { source: "/integrations/pdf-documents", destination: "/chat-with-pdf", permanent: true },
      { source: "/blog", destination: "/guides", permanent: true },
      { source: "/blog/:slug", destination: "/guides/:slug", permanent: true },
      { source: "/signup", destination: "/login?mode=signup", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/dashboard", destination: "/chat", permanent: false },
      { source: "/dashboard/:path*", destination: "/chat", permanent: false },
      { source: "/settings", destination: "/settings/profile", permanent: true },
      { source: "/alternatives", destination: "/compare", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/login", headers: NOINDEX },
      { source: "/chat/:path*", headers: NOINDEX },
      { source: "/data/:path*", headers: NOINDEX },
      { source: "/settings/:path*", headers: NOINDEX },
      // Preview and development deployments on Vercel are never indexed.
      ...(isPreviewDeploy ? [{ source: "/:path*", headers: NOINDEX }] : []),
    ];
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // Turbopack needs plugin names as strings (functions can't cross into Rust).
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
