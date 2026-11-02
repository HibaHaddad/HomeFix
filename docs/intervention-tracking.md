# Parcours visuel Client

`InterventionJourney` est un composant réutilisable qui reçoit le statut, la réservation, les prix et les événements persistés d’une intervention. `InterventionTrackingCard` l’entoure des informations essentielles : professionnel et photo disponible, date, horaires de Tunis, montant accepté et lien vers la conversation.

La progression est définie dans `src/lib/intervention-progress.ts` :

| Statut enregistré | Étape affichée |
| --- | --- |
| SENT | Demande envoyée |
| QUOTED | Devis reçu |
| PRICE_ACCEPTED | Prix accepté |
| BOOKED | RDV confirmé |
| EN_ROUTE | En route |
| IN_PROGRESS | Intervention en cours |
| COMPLETED | Terminée |

Les statuts `CANCELLED` et `REJECTED` arrêtent le parcours à la dernière étape réellement attestée par l’historique, les prix ou la réservation. Un état actif utilise son statut actuel, afin qu’un ancien rendez-vous confirmé ne soit pas présenté comme toujours confirmé après un changement de créneau. Les anciennes données sans statut reconnu utilisent uniquement les éléments disponibles en base.

L’avatar illustré en SVG est placé directement à l’étape actuelle au chargement. GSAP, déjà installé, anime ensuite ses déplacements uniquement lors des changements réels d’étape. La barre suit le même état, sans minuterie de progression. Le parcours passe d’une ligne horizontale à une liste verticale lorsque son conteneur devient étroit ; `ResizeObserver` recalcule la position de l’avatar. Les préférences `prefers-reduced-motion` désactivent les déplacements animés et les micro-animations. Les étapes sont une liste ordonnée et l’étape actuelle porte `aria-current="step"`.

L’historique, les photos du problème, les pièces jointes, l’adresse et l’accès à une réclamation sont conservés dans « Voir les détails ». La validation de fin d’intervention et l’accès aux avis restent disponibles. La page conserve les interventions confirmées et affiche également les demandes annulées ou refusées. Les changements reçus via Socket.IO et les retours de connexion relisent l’état serveur via `GET /api/client/interventions`. Cette API authentifiée réutilise la requête du rendu initial et ne retourne que les interventions du client connecté, avec une réponse `private, no-store`.

La première connexion Socket.IO ne relance pas le rendu de la page. Les messages rapprochés sont regroupés et les lectures de données sont exécutées une à la fois ; les animations restent donc montées pendant les mises à jour. Les autres pages regroupent leurs rafraîchissements de route dans une transition React. La création d’une demande déclenche soit une navigation, soit une actualisation de la route courante, jamais les deux simultanément.

## Notifications des étapes d’exécution

Les transitions `EN_ROUTE`, `IN_PROGRESS` et `COMPLETED` écrivent l’événement de suivi et une notification persistante pour le client dans la même transaction. Elles ne créent pas de `ChatMessage`. Après validation de la transaction, Socket.IO émet `intervention:updated` aux deux participants pour relire les données, et `notification:new` au seul destinataire si ses notifications sont activées.

Les notifications indiquent « Votre professionnel est en route », « Votre intervention a commencé » ou « Votre intervention est terminée », avec le nom de la demande. Leur lien `/dashboard/interventions?demande=…#intervention-…` ouvre la carte concernée, la met en évidence et déplie ses détails. La sélection authentifiée retrouve aussi une intervention plus ancienne que les 100 éléments affichés par défaut, sans permettre de lire celle d’un autre client. La validation de fin par le client suit le même principe et informe le professionnel via son espace d’interventions.

Les prix proposés et leur confirmation continuent d’utiliser les messages interactifs existants. Les notifications d’étape sont consultables dans l’historique de notifications même si le client était hors ligne. Les anciens messages déjà enregistrés ne sont pas supprimés.

Test dédié :

```sh
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/intervention-notifications.integration.test.mjs
```

Vérification de la logique :

```sh
node --test tests/intervention-progress.test.mjs
```

Les tests couvrent les sept étapes, la replanification, les arrêts et les données historiques. Les tests d’intégration du prix et du parcours Client continuent de vérifier l’affichage après confirmation et les actions métier.
