import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true);
const result = spawnSync(process.execPath, ["--import", "./tests/helpers/register-ts.mjs", "--test", "--test-concurrency=1", "tests/payment-allocation.test.mjs", "tests/payment-accounting.integration.test.mjs", "tests/professional-finance.test.mjs", "tests/card-payments.integration.test.mjs", "tests/payments.integration.test.mjs", "tests/admin-refunds.integration.test.mjs", "tests/receipt-pdf.integration.test.mjs"], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
