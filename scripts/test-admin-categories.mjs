import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true);
const result = spawnSync(process.execPath, ["--import", "./tests/helpers/register-ts.mjs", "--test", "tests/admin-categories.test.mjs", "tests/admin-categories.integration.test.mjs", "tests/assistant.test.mjs"], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
