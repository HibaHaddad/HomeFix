import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(),true);
const result=spawnSync(process.execPath,["--import","./tests/helpers/register-ts.mjs","--test","--test-concurrency=1","tests/sanctions.test.mjs","tests/sanctions.integration.test.mjs","tests/professional-finance.test.mjs"],{stdio:"inherit",env:process.env});process.exitCode=result.status??1;
