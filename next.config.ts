import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader:false,
  experimental:{cpus:1},
  // The pinned Next release omits runtime modules from its default server trace.
  // Ship its JavaScript runtime explicitly; maps and type sources stay excluded.
  outputFileTracingIncludes:{"/*":["./node_modules/next/dist/**/*.js","./node_modules/next/dist/**/*.json","./node_modules/next/dist/**/*.wasm"]},
  outputFileTracingExcludes:{"*": ["./data/**/*","./.sites-runtime/**/*","./lib/source-data.json","./outputs/**/*","./work/**/*"]},
};

export default nextConfig;
