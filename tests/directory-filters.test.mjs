import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSearchTerm, parseDirectoryFilters } from "../src/lib/directory-filters.ts";

test("defaults to a bounded first page and recent sorting", () => {
  const filters = parseDirectoryFilters(new URLSearchParams());
  assert.equal(filters.page, 1);
  assert.equal(filters.sort, "recent");
  assert.equal(filters.minPrice, null);
});
test("combines filters and preserves explicit zero values", () => {
  const filters = parseDirectoryFilters(new URLSearchParams("q=  plombier  &minExperience=0&maxExperience=20&minRating=4.5&minPrice=0&maxPrice=200&verified=true&sort=rating&availability=AVAILABLE&page=2"));
  assert.equal(filters.q, "plombier");
  assert.equal(filters.minPrice, 0);
  assert.equal(filters.minExperience, 0);
  assert.equal(filters.minRating, 4.5);
  assert.equal(filters.verified, true);
  assert.equal(filters.page, 2);
});
test("rejects invalid bounds, malformed numbers and arbitrary sort expressions", () => {
  for (const query of ["minPrice=NaN", "page=0", "page=1.5", "page=100001", "minExperience=-1", "maxExperience=81", "minRating=6", "minPrice=100&maxPrice=1", "minExperience=20&maxExperience=10", "availability=unknown", "sort=__proto__", "sort=createdAt;DROP TABLE User"]) {
    assert.throws(() => parseDirectoryFilters(new URLSearchParams(query)), undefined, query);
  }
});
test("recognizes trades and accent-insensitive searches", () => {
  assert.equal(normalizeSearchTerm("ÉLECTRICIEN"), "electricite");
  assert.equal(normalizeSearchTerm("plombier"), "plomberie");
  assert.equal(normalizeSearchTerm("Béja"), "beja");
});
