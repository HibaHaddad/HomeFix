import assert from "node:assert/strict";
import { test } from "node:test";
import { adjustedRating, validateSanctionRules } from "../src/lib/sanctions.ts";
import { buildProfessionalFinance } from "../src/lib/professional-finance.ts";
const rules = [{ id: "LATE", enabled: true, thresholdMinutes: 30, amountMillimes: 0, ratingHundredths: 100 }, { id: "NO_SHOW", enabled: true, thresholdMinutes: 0, amountMillimes: 20000, ratingHundredths: 0 }, { id: "UNPERFORMED", enabled: true, thresholdMinutes: 0, amountMillimes: 30000, ratingHundredths: 0 }];
test("rules strictly validate monetary and rating penalties independently", () => {
  assert.deepEqual(validateSanctionRules(rules), rules);
  for (const invalid of [[], [...rules,rules[0]], [rules[0],rules[0],rules[2]], [{...rules[0], amountMillimes:1000},...rules.slice(1)], [rules[0],{...rules[1],amountMillimes:0},rules[2]], [{...rules[0],thresholdMinutes:-1},...rules.slice(1)]]) assert.throws(()=>validateSanctionRules(invalid));
});
test("adjusted ratings retain original averages, never fall below one and do not invent reviews", () => {
  assert.equal(adjustedRating(4.8,100),3.8); assert.equal(adjustedRating(2,400),1); assert.equal(adjustedRating(null,100),null); assert.equal(adjustedRating(5,0),5);
});
test("sanctions reduce net accounting separately from commissions and can create a negative balance", () => {
  const row = {id:"fixture",amountMillimes:20000,appliedAt:new Date(),reason:"No show",decisionReason:"Validated proof",requestId:1,request:{title:"Fixture",client:{name:"Client"}}};
  const finance=buildProfessionalFinance([],null,[row]);
  assert.equal(finance.commissionsMillimes,0);assert.equal(finance.sanctionsMillimes,20000);assert.equal(finance.netMillimes,-20000);assert.equal(finance.transactions[0].kind,"sanction");
  assert.equal(buildProfessionalFinance([],null,[]).netMillimes,0);
});
