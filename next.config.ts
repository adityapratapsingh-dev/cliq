import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` opens raw TCP sockets, so keep it out of the bundler and load it from
  // node_modules at runtime instead.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
