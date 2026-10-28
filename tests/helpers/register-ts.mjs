import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = new URL("../../src/", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  const candidate = specifier.startsWith("@/") ? new URL(specifier.slice(2), source)
    : specifier.startsWith(".") && context.parentURL?.startsWith(source.href) ? new URL(specifier, context.parentURL) : null;
  if (candidate && existsSync(fileURLToPath(`${candidate.href}.ts`))) return nextResolve(`${candidate.href}.ts`, context);
  return nextResolve(specifier, context);
} });
