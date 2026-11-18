import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Uploaded files are stored in the database; keep their public URLs at /uploads/<name>.
  // (afterFiles: a real file under public/uploads still wins, so old local files keep working.)
  async rewrites() {
    return [{ source: "/uploads/:name", destination: "/api/files/:name" }];
  },
};

export default nextConfig;
