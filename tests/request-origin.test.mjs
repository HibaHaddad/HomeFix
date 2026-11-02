import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAllowedRequestOrigin } from "../src/lib/request-origin.ts";

const check = (origin, host = "localhost:3000", configured = "") => hasAllowedRequestOrigin(new Request("http://0.0.0.0:3000/api/client/espace", { headers: { ...(origin === undefined ? {} : { Origin: origin }), Host: host } }), configured);
test("public localhost and LAN origins work with Next bound to 0.0.0.0", () => {
  assert.equal(check("http://localhost:3000"), true);
  assert.equal(check("http://127.0.0.1:3000", "127.0.0.1:3000"), true);
  assert.equal(check("http://192.168.1.5:3000", "192.168.1.5:3000"), true);
});
test("foreign origins, wrong ports, malformed origins and untrusted forwarded hosts are rejected", () => {
  for (const origin of ["https://foreign.example", "http://localhost:3001", "null", "not-a-url", "http://localhost:3000/", "http://localhost:3000@foreign.example"]) assert.equal(check(origin), false, origin);
  assert.equal(hasAllowedRequestOrigin(new Request("http://0.0.0.0:3000/api", { headers: { Host: "localhost:3000", Origin: "https://foreign.example", "X-Forwarded-Host": "foreign.example", "X-Forwarded-Proto": "https" } }), ""), false);
});
test("explicit public origin supports HTTPS proxies and retains origin protection", () => {
  assert.equal(check("https://homefix.example", "internal:3000", "https://homefix.example"), true);
  assert.equal(check("https://foreign.example", "internal:3000", "https://homefix.example"), false);
  assert.equal(check(undefined), true);
});
