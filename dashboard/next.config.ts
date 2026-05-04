import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node.js module (.node binary).
  // Next.js webpack must NOT try to bundle it — it must be required at runtime.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
