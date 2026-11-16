import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true);
const result = spawnSync(process.execPath, ["--import", "./tests/helpers/register-ts.mjs", "--test", "tests/intervention-request.integration.test.mjs", "tests/availability.test.mjs"], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
