# Prix et confirmation dans la messagerie

Dans l’agenda professionnel, la carte d’une réservation propose un champ « Prix de l’intervention (TND) » et « Confirmer et envoyer le prix ». Le formulaire transmet `booking.confirm` avec `requestId` et `amount`. La validation du créneau, la création du prix proposé et le message sont enregistrés dans la même transaction. Le professionnel peut également envoyer le prix depuis le panneau d’interventions de la conversation.

Le prix est stocké dans `Quote.amountMillimes` en millimes entiers. La réservation devient `ACCEPTED`, la demande `QUOTED` et un message lié au devis par `ChatMessage.quoteId` est envoyé au client en temps réel. Il présente le prix, la date et les heures, avec un bouton « Confirmer ». Une proposition de prix expire au début du créneau. Une révision remplace le prix précédent et désactive son ancien bouton.

Le bouton utilise `quote.accept` avec les identifiants de la demande et du devis. Le serveur relit le montant enregistré, vérifie le client, le statut, la validité et l’absence de conflit. L’accord crée l’unique facture de suivi existante et fait passer la réservation à `CONFIRMED` et la demande à `BOOKED`. Aucun paiement n’est effectué. Les propositions et leur acceptation sont persistantes et les cartes de message sont actualisées par Socket.IO dans les deux espaces.

La page Client « Interventions » charge les interventions confirmées indépendamment des demandes en attente, avec le nom du professionnel, sa photo si disponible, le prix accepté, le créneau et le suivi. Une photo du problème est également affichée si elle a été jointe à la demande. Les photos restent servies par des routes authentifiées. Le prix proposé n’est jamais présenté comme accepté avant l’accord du client.

Les anciens parcours séparant l’acceptation du créneau et celle du devis restent compatibles. Les anciennes données sont conservées ; seuls les nouveaux messages de proposition possèdent le lien structuré avec leur devis.

Validation :

```sh
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test --test-concurrency=1 tests/chat-price-confirmation.integration.test.mjs tests/availability.integration.test.mjs tests/client-workspace.integration.test.mjs tests/realtime-chat.integration.test.mjs
```

Le test dédié couvre le message reçu par Socket.IO, la persistance du prix, son remplacement, le refus d’accès des tiers, le rejet d’un prix négatif, l’accord simultané sans doublon et le contenu de la carte d’intervention confirmée.
