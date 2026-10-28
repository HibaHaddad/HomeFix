import assert from "node:assert/strict";
import { test } from "node:test";
import { reverseGeocodeGovernorate } from "../src/lib/reverse-geocode.ts";

test("uses live coordinates and maps the API's administrative code, regardless of translated names", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, "https://api.bigdatacloud.net");
    assert.equal(request.searchParams.get("latitude"), "36.8");
    assert.equal(request.searchParams.get("longitude"), "10.1");
    assert.equal(request.searchParams.get("localityLanguage"), "fr");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ countryCode: "TN", principalSubdivisionCode: "TN-14", principalSubdivision: "Manouba Governorate" });
  });
  assert.equal(await reverseGeocodeGovernorate(36.8, 10.1), "La Manouba");
});

test("rejects foreign countries instead of guessing a nearby Tunisian governorate", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ countryCode: "DZ", principalSubdivisionCode: "TN-11" }));
  await assert.rejects(reverseGeocodeGovernorate(36.8, 10.1), /hors de Tunisie/);
});

test("handles unavailable services", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  await assert.rejects(reverseGeocodeGovernorate(36.8, 10.1), /indisponible/);
});

test("does not invent a location for missing or unknown API data", async (t) => {
  for (const data of [null, {}, { countryCode: "TN" }, { countryCode: "TN", principalSubdivisionCode: "TN-99" }, { countryCode: "TN", principalSubdivisionCode: "toString" }]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json(data));
    await assert.rejects(reverseGeocodeGovernorate(36.8, 10.1), /identifi/);
    mock.mock.restore();
  }
});

test("propagates network errors for the form to display a manual-selection fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(reverseGeocodeGovernorate(36.8, 10.1), TypeError);
});
