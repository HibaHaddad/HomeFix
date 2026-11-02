import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = join(root, ".env");
const privateDir = join(root, ".stripe-local");
const command = process.argv[2];
const events = ["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled", "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
const target = "http://localhost:3000/api/stripe/webhook";
const scrub = (value) => String(value).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/(?:sk|rk|pk)_(?:live|test)_[a-zA-Z0-9]+|whsec_[a-zA-Z0-9]+/g, "[secret masqué]");

function saveSecret(secret) {
  if (!/^whsec_[a-zA-Z0-9]+$/.test(secret)) throw new Error("Secret de signature Stripe invalide.");
  const current = readFileSync(envPath, "utf8");
  if (parse(current).STRIPE_WEBHOOK_SECRET === secret) return;
  const updated = /^\s*STRIPE_WEBHOOK_SECRET\s*=/m.test(current)
    ? current.replace(/^[ \t]*STRIPE_WEBHOOK_SECRET[ \t]*=.*$/m, `STRIPE_WEBHOOK_SECRET=${secret}`)
    : `${current.trimEnd()}\nSTRIPE_WEBHOOK_SECRET=${secret}\n`;
  const temporary = join(root, ".env.stripe-tmp");
  writeFileSync(temporary, updated, { mode: 0o600 });
  renameSync(temporary, envPath);
}

async function main() {
  if (!["setup", "listen"].includes(command) || process.argv.length !== 3) throw new Error("Utilisez npm run stripe:setup ou npm run stripe:listen. Le mode réel est interdit.");
  const config = parse(readFileSync(envPath, "utf8"));
  if (!config.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Ajoutez une clé STRIPE_SECRET_KEY=sk_test_… dans .env. Aucune clé réelle n’est acceptée.");
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const require = createRequire(import.meta.url);
  const cliDir = dirname(require.resolve("@stripe/cli/package.json"));
  const platform = JSON.parse(readFileSync(join(cliDir, "platforms.json"), "utf8"))[`${process.platform}-${process.arch}`];
  if (!platform) throw new Error("Plateforme non prise en charge par Stripe CLI.");
  let executable;
  try { executable = join(dirname(require.resolve(`${platform.pkg}/package.json`)), "bin", platform.bin); }
  catch { executable = join(cliDir, "vendor", "bin", platform.bin); }
  if (!existsSync(executable)) throw new Error("Stripe CLI est absent. Exécutez npm install --legacy-peer-deps.");
  const args = ["--config", join(privateDir, "config.toml"), "--color", "off", "listen", "--skip-update", "--events-from", "@self", "--events", events.join(",")];
  if (command === "setup") args.push("--print-secret");
  else args.push("--forward-to", target);
  // The API key stays in the child environment, never in process arguments or logs.
  const child = spawn(executable, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, STRIPE_API_KEY: config.STRIPE_SECRET_KEY, STRIPE_DEVICE_NAME: "HomeFixTN-local", STRIPE_INSTALL_METHOD: "npm_run" } });
  let ready = false, captured = "";
  const buffers = new Map();
  const statePath = join(privateDir, "listener.json");
  const recordState = (active) => { if (command === "listen") writeFileSync(statePath, JSON.stringify({ active, pid: child.pid, parentPid: process.pid, target, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 }); };
  const line = (value) => {
    const secret = value.match(/whsec_[a-zA-Z0-9]+/)?.[0];
    if (secret) {
      saveSecret(secret);
      ready = true;
      clearTimeout(timeout);
      recordState(true);
      console.log(`Stripe Test : secret webhook enregistré dans .env${command === "listen" ? ` · transfert vers ${target}` : ""}.`);
    }
    if (command === "listen" && value.trim()) console.log(scrub(value));
  };
  for (const stream of [child.stdout, child.stderr]) {
    buffers.set(stream, "");
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      if (command === "setup") { captured += chunk; if (captured.length > 1048576) child.kill(); return; }
      const parts = (buffers.get(stream) + chunk).replace(/\r\n?/g, "\n").split("\n");
      buffers.set(stream, parts.pop());
      for (const value of parts) line(value);
    });
  }
  const timeout = setTimeout(() => { console.error("Stripe CLI ne répond pas. Vérifiez la connexion et la clé Test."); child.kill(); }, 45000);
  const stop = () => child.kill();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (command === "setup") line(captured);
      else { for (const remaining of buffers.values()) if (remaining) line(remaining); recordState(false); }
      if (!ready) reject(new Error(`Connexion Stripe Test impossible. ${scrub(captured).slice(0, 1000)}`));
      else if (code && !signal) reject(new Error(`Stripe CLI arrêté (code ${code}).`));
      else resolve();
    });
  });
}
main().catch((error) => { console.error(scrub(error.message)); process.exitCode = 1; });
