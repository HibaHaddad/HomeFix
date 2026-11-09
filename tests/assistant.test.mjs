import assert from "node:assert/strict";
import { test } from "node:test";
import { AssistantError, parseSearch, safetyAdvice, rankProfessional, describeAssistantMatch, assistantMatchTier, recommendationText } from "../src/lib/assistant.ts";
import { runAssistant } from "../src/app/lib/gemini-assistant.ts";

process.env.GEMINI_API_KEY = "unit-test-key-never-sent";
const final = { name: "respond", args: { message: "Qu’avez-vous observé exactement ?", analysis: { category: "Plomberie", urgency: "NORMAL", description: "Fuite signalée sous un évier." } } };
const response = (call, finishReason = "STOP") => Response.json({ candidates: [{ finishReason, content: { role: "model", parts: [{ functionCall: call, thoughtSignature: "preserved-signature" }] } }] });
test("gas and electrical danger receive immediate safety guidance", () => {
  for (const message of ["Odeur de gaz dans la cuisine", "Fuite de butane", "Alarme monoxyde de carbone", "Des étincelles dans le tableau", "De l’eau sur la prise", "Odeur de brûlé"]) {
    assert.match(safetyAdvice(message), /Danger|Danger électrique/);
    assert.match(safetyAdvice(message), /secours/);
  }
  assert.equal(safetyAdvice("Mon climatiseur ne refroidit plus"), null);
});
test("tool inputs reject unspecified city, invented category and invalid budgets", () => {
  for (const value of [{ category: "Plomberie", city: "", budget: 50 }, { category: "Hacker", city: "Tunis", budget: 50 }, { category: "Plomberie", city: "Tunis", budget: -1 }, { category: "Plomberie", city: "Tunis" }]) assert.throws(() => parseSearch(value), AssistantError);
  assert.deepEqual(parseSearch({ category: "Plomberie", city: " Tunis ", budget: null }), { category: "Plomberie", city: "Tunis", budget: null });
});
test("matching rewards real availability, reviews, experience and budget fit", () => {
  const base = { nextSlot: null, availability: null, rating: null, reviewCount: 0, experienceYears: null, priceMin: null };
  const improved = { ...base, nextSlot: "2030-01-01", availability: "AVAILABLE", rating: 4.7, reviewCount: 7, experienceYears: 10, priceMin: 40 };
  assert.ok(rankProfessional(improved, 80) > rankProfessional(base, 80));
  assert.ok(rankProfessional({ ...base, priceMin: 40 }, 80) > rankProfessional(base, 80));
});
test("Gemini tool round-trip preserves signatures, supplies DB results, and retains history", async () => {
  let calls = 0;
  const dbResults = []; // No fake professional is inserted or recommended.
  const result = await runAssistant([{ role: "user", text: "Je suis à Tunis, budget 80 DT", createdAt: "2026-01-01" }, { role: "assistant", text: "Quel est le problème ?", createdAt: "2026-01-01" }], "Une fuite, trouvez un plombier", {
    search: async (criteria) => { assert.deepEqual(criteria, { category: "Plomberie", city: "Tunis", budget: 80 }); return dbResults; },
    fetch: async (url, init) => {
      assert.match(url, /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-/);
      assert.equal(url.includes("unit-test-key"), false);
      const body = JSON.parse(init.body);
      assert.equal(body.contents[0].parts[0].text, "Je suis à Tunis, budget 80 DT");
      if (calls++ === 0) return response({ name: "search_professionals", args: { category: "Plomberie", city: "Tunis", budget: 80 } });
      assert.equal(body.contents.at(-2).parts[0].thoughtSignature, "preserved-signature");
      assert.deepEqual(body.contents.at(-1).parts[0].functionResponse.response.result.professionals, []);
      return response(final);
    },
  });
  assert.equal(calls, 2); assert.equal(result.searched, true); assert.deepEqual(result.professionals, []);
  assert.equal(result.analysis.category, "Plomberie");
});
test("no search results can originate from a respond payload", async () => {
  const result = await runAssistant([], "Bonjour", { search: async () => { throw Error("No tool expected"); }, fetch: async () => response({ ...final, args: { ...final.args, professionals: [{ id: 999 }] } }) });
  assert.deepEqual(result.professionals, []);
});
test("quotas, blocked output, unknown tools, truncation and upstream errors are safe", async () => {
  for (const [reply, status] of [[new Response("quota", { status: 429 }), 429], [new Response("secret provider error", { status: 403 }), 503], [response(final, "MAX_TOKENS"), 502], [response({ name: "execute_sql", args: {} }), 502], [Response.json({ promptFeedback: { blockReason: "SAFETY" } }), 502]]) {
    await assert.rejects(runAssistant([], "Bonjour", { search: async () => [], fetch: async () => reply }), (e) => e instanceof AssistantError && e.status === status && !e.message.includes("secret provider"));
  }
});
test("invalid tool inputs get a recoverable tool response and never query PostgreSQL", async () => {
  let calls = 0;
  const result = await runAssistant([], "Trouver un pro", { search: async () => { throw Error("Must not search"); }, fetch: async (_url, init) => {
    if (!calls++) return response({ name: "search_professionals", args: { category: "Plomberie", city: "", budget: 80 } });
    assert.ok(JSON.parse(init.body).contents.at(-1).parts[0].functionResponse.response.result.error);
    return response(final);
  } });
  assert.equal(result.searched, false);
});
test("retired models and rejected credentials have actionable messages without provider details", async () => {
  for (const [status, expected] of [[404, /GEMINI_MODEL/], [401, /clé API/], [403, /autorisations/], [400, /compatibilité/]]) {
    await assert.rejects(runAssistant([], "Bonjour", { search: async () => [], fetch: async () => new Response("private upstream diagnostics", { status }) }), (e) => e.status === 503 && expected.test(e.message) && !e.message.includes("private upstream"));
  }
});
test("temporary Google overload is retried once using the identical request", async () => {
  const requests = [];
  const result = await runAssistant([], "Mon évier fuit", { search: async () => [], fetch: async (_url, init) => {
    requests.push(init.body);
    return requests.length === 1 ? new Response("unavailable", { status: 503 }) : response(final);
  } });
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
  assert.equal(result.analysis.category, "Plomberie");
});
test("persistent overload stops after one retry and provides a retry delay", async () => {
  let calls = 0;
  await assert.rejects(runAssistant([], "Bonjour", { search: async () => [], fetch: async () => {
    calls++; return new Response("private upstream diagnostics", { status: 503 });
  } }), (e) => e.status === 503 && e.retryAfter === 15 && /surchargé/.test(e.message) && !e.message.includes("private upstream"));
  assert.equal(calls, 2);
});
test("matching explains budget and location differences without inventing coverage", () => {
  const p = { serviceCity: "Nabeul", coveredAreas: "Hammamet", priceMin: 20, reasons: [] };
  const outside = describeAssistantMatch(p, { category: "Plomberie", city: "Tunis", budget: 10 });
  assert.equal(outside.match.locationConfirmed, false); assert.equal(outside.match.budget, "OVER");
  assert.equal(assistantMatchTier(outside), 3);
  const local = describeAssistantMatch(p, { category: "Plomberie", city: "Nabeul", budget: 50 });
  assert.equal(assistantMatchTier(local), 0);
  assert.match(recommendationText([local]), /votre zone/);
  assert.equal(describeAssistantMatch({ ...p, priceMin: null }, { category: "Plomberie", city: "Nabeul", budget: 50 }).match.budget, "UNKNOWN");
});
test("the server imposes the profile city even when Gemini requests another city", async () => {
  let calls = 0;
  const result = await runAssistant([], "Recommande un plombier, budget 50 DT", {
    search: async (criteria) => { assert.equal(criteria.city, "Nabeul"); return []; },
    fetch: async (_url, init) => {
      assert.match(JSON.parse(init.body).systemInstruction.parts[0].text, /VILLE DU PROFIL : "Nabeul"/);
      return calls++ === 0 ? response({ name: "search_professionals", args: { category: "Plomberie", city: "Tunis", budget: 50 } }) : response(final);
    },
  }, { city: "Nabeul" });
  assert.equal(result.searchCriteria.city, "Nabeul");
  assert.match(result.text, /à Nabeul/);
});
test("a missing profile city prevents searching even if the model supplies a city", async () => {
  let calls = 0;
  const result = await runAssistant([], "Recommande un plombier", {
    search: async () => { assert.fail("Must not search without the profile city"); },
    fetch: async (_url, init) => {
      if (calls++ === 0) return response({ name: "search_professionals", args: { category: "Plomberie", city: "Tunis", budget: 50 } });
      assert.match(JSON.parse(init.body).contents.at(-1).parts[0].functionResponse.response.result.error, /Mon profil/);
      return response(final);
    },
  }, { city: null });
  assert.equal(result.searched, false);
});
