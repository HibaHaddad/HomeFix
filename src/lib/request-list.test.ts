import assert from "node:assert/strict";
import { test } from "node:test";
import { requestsForTracking } from "./request-list";

const completed = {
  id: 2, clientId: 1, professionalId: 3, conversationId: 4,
  status: "COMPLETED", category: "Plomberie", title: "fuit robinet", message: "fuit robinet",
  address: "42 rue abdullah ibn zoubeir Nabeul",
  createdAt: "2026-11-01T14:02:00+01:00", updatedAt: "2026-11-01T16:00:00+01:00",
  booking: { startsAt: "2026-11-01T15:00:00+01:00" },
};
const sent = {
  ...completed, id: 1, status: "SENT", title: "fuit robiné", message: "fuit robiné",
  createdAt: "2026-11-01T13:35:00+01:00", booking: { startsAt: "2026-11-01T14:00:00+01:00" },
};

test("keeps only the completed request for an older duplicate, including a typing error", () => {
  assert.deepEqual(requestsForTracking([completed, sent]), [completed]);
  assert.deepEqual(requestsForTracking([sent, completed]), [completed]);
  assert.deepEqual(requestsForTracking([completed, sent]).filter((r) => r.status === "SENT"), []);
});

test("preserves distinct problems, professionals, dates, conversations and later requests", () => {
  for (const change of [
    { title: "lavabo bouché", message: "lavabo bouché" },
    { professionalId: 5 }, { clientId: 6 }, { conversationId: 7 },
    { address: "Une autre adresse" }, { category: "Chauffage" },
    { booking: { startsAt: "2026-11-02T14:00:00+01:00" } },
    { createdAt: "2026-11-01T17:00:00+01:00" },
    { booking: null }, { status: "BOOKED" },
  ]) {
    const other = { ...sent, ...change };
    assert.deepEqual(requestsForTracking([completed, other]), [completed, other]);
  }
});

test("keeps sent requests without a matching completion and removes repeated IDs", () => {
  assert.deepEqual(requestsForTracking([sent]), [sent]);
  assert.deepEqual(requestsForTracking([completed, completed]), [completed]);
});
