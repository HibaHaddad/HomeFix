# Agenda et disponibilités

Le calendrier professionnel charge chaque mois via `GET /api/interactions?month=YYYY-MM`. Cette réponse authentifiée est réservée au professionnel connecté et inclut tous ses horaires et rendez-vous du mois, sans la limite des 100 dernières demandes. L’identité des clients reste absente de l’API publique de disponibilités.

Un clic sur un jour sans horaires ouvre la popup ; un jour publié ouvre son détail dans le panneau de droite. « Modifier les horaires » rouvre la popup. Les jours libres sont verts, les jours complets ou entièrement bloqués par des demandes sont ambrés, les jours sans horaires sont neutres. Les réservations en attente sont ambrées ; les rendez-vous confirmés après accord sur le créneau et le devis sont bleus.

Chaque proposition client à venir possède un bouton « Confirmer le créneau » directement dans sa carte. Il appelle `booking.confirm` sans navigation, met la carte à jour et envoie automatiquement au client un message daté via la messagerie persistante et Socket.IO. Le lien vers la conversation reste facultatif. Si le devis est accepté, la réservation devient `CONFIRMED` ; sinon elle devient `ACCEPTED` avec la mention « Devis à valider ». Un second clic ou une requête répétée ne génère pas de deuxième message.

`POST /api/interactions`, action `availability.save`, reçoit `{ day: "2030-01-15", start: "09:00", end: "17:00" }`. Les valeurs sont interprétées à Tunis (UTC+1). La durée doit être un nombre entier d’heures. Une plage déjà commencée aujourd’hui peut être modifiée si elle se termine dans le futur ; seuls les créneaux dont le début est futur sont réservables.

Les heures sont enregistrées comme lignes `AvailabilitySlot` d’une heure. Modifier les horaires retire les anciennes disponibilités de la publication et crée la nouvelle série dans une transaction. Aucun rendez-vous ni ancien créneau référencé n’est supprimé. Les confirmations en cours conservent les dates enregistrées dans `Booking`, même si le créneau original a été retiré ou si les nouvelles heures ne le couvrent plus.

`PROPOSED`, `COUNTER_PROPOSED`, `ACCEPTED` et `CONFIRMED` bloquent les heures concernées. Refuser ou annuler une réservation les libère si ces heures sont toujours publiées. Les deux calendriers relisent leurs données toutes les 15 secondes et au retour sur la fenêtre ; chaque mutation revérifie la disponibilité en transaction sérialisable. Une contrainte d’exclusion PostgreSQL empêche les chevauchements des nouvelles réservations, même en cas de demandes simultanées ou d’insertion qui contourne l’API. Un conflit renvoie HTTP 409.

La migration `20261101150000_hourly_availability` découpe les anciennes plages actives en heures complètes sans modifier les réservations existantes. Un reliquat inférieur à une heure ne devient pas réservable. Les anciennes propositions concurrentes sont conservées grâce au marqueur de compatibilité `holdsSlot=false` ; elles restent prises en compte par la vérification de disponibilité. En cas de conflit hérité entre plusieurs propositions, refuser ou annuler les propositions concurrentes avant d’en accepter une. Toute nouvelle réservation et tout changement de créneau utilise la protection renforcée.

Validation avec le serveur démarré :

```sh
node --test tests/availability.test.mjs
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test --test-concurrency=1 tests/availability.integration.test.mjs tests/client-workspace.integration.test.mjs
```

Ces tests créent et nettoient des comptes temporaires dans la base configurée. Ils couvrent les heures de Tunis, les validations, les demandes simultanées, les statuts, la libération d’un créneau, la modification d’horaires et la conservation d’anciens rendez-vous de plusieurs heures.
