import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCategory } from "../src/lib/admin-category-validation.ts";
import { normalizeCategoryName } from "../src/lib/service-categories.ts";

test("category inputs normalize names, validate icons and reject foreign fields", () => {
  const valid = { name: " Électricité  maison ", description: " Entretien ", icon: "zap", isActive: true };
  assert.equal(validateCategory(valid).normalizedName, "electricite maison");
  assert.equal(validateCategory(valid).name, "Électricité maison");
  assert.equal(validateCategory(valid).description, "Entretien");
  assert.equal(normalizeCategoryName("  MÉNAGE "), "menage");
  for (const input of [null, {}, { ...valid, name: " " }, { ...valid, name: "a".repeat(81) }, { ...valid, icon: "<script>" }, { ...valid, isActive: "true" }, { ...valid, description: "a".repeat(1001) }, { ...valid, adminId: 1 }]) assert.throws(() => validateCategory(input));
});
