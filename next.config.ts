import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    reactCompiler: true,
    outputFileTracingIncludes: {
      "/api/client/factures/*/pdf": ["./assets/fonts/*.ttf"],
    },
    // A production build must never clean files used by the running dev server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
