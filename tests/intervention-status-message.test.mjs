import assert from "node:assert/strict";
import { test } from "node:test";
import { formatInterventionStatusMessage, interventionStatusMessages } from "../src/lib/intervention-status-message.ts";

test("legacy automatic statuses use the same readable text as client notifications", () => {
  for (const [status, message] of Object.entries(interventionStatusMessages)) {
    assert.equal(formatInterventionStatusMessage(`Statut de l’intervention : ${status}`), message);
    assert.equal(formatInterventionStatusMessage(`Statut de l'intervention: ${status}`), message);
    assert.equal(formatInterventionStatusMessage(message), message);
  }
});

test("ordinary messages and unknown status codes are preserved", () => {
  for (const text of ["Bonjour, je suis en route", "EN_ROUTE", "Statut de l’intervention : UNKNOWN", "Merci ! Statut de l’intervention : EN_ROUTE"]) {
    assert.equal(formatInterventionStatusMessage(text), text);
  }
});
