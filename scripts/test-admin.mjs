import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true);
const result = spawnSync(process.execPath, [
  "--import", "./tests/helpers/register-ts.mjs", "--test",
  "tests/admin-operations.integration.test.mjs",
  "tests/admin-messaging.integration.test.mjs",
  "tests/admin-refunds.integration.test.mjs",
  "tests/admin-decision.integration.test.mjs",
  "tests/admin-validation.test.mjs",
  "tests/admin-dashboard-preferences.test.mjs",
  "tests/admin-dashboard-preferences.integration.test.mjs",
  "tests/admin-categories.test.mjs",
  "tests/admin-categories.integration.test.mjs",
  "tests/admin-complaint-filters.test.mjs",
  "tests/admin-complaints.integration.test.mjs",
], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
