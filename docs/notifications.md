# Centre de notifications

Les espaces Client et Professionnel partagent `NotificationProvider`, `NotificationBell` et `NotificationsCenter`. La cloche affiche le nombre de notifications dont `readAt` est nul, calculé sur toute la base du compte connecté. La liste paginée n’est pas utilisée pour calculer ce compteur. Le badge disparaît à zéro et affiche `99+` au-delà de 99, avec le compte exact dans son libellé accessible.

Les notifications non lues ont un fond vert sauge, les lues un fond gris clair, avec un libellé explicite et une coche. Le champ `ClientNotification.type` sélectionne une icône Lucide et une teinte : message, pièce jointe, demande, prix, rendez-vous, départ, intervention en cours, fin, validation, annulation ou refus. Une catégorie inconnue utilise l’icône d’information. La migration conserve les anciennes notifications et classe leurs catégories connues sans modifier leur statut de lecture.

API authentifiée pour les clients actifs et professionnels approuvés :

- `GET /api/notifications` : 40 notifications, compteur total et curseur suivant ; `before` pagine, `unread=1` filtre les non lues.
- `GET /api/notifications?countOnly=1` : compteur seul.
- `POST /api/notifications` avec `{ id }` : marque une notification du compte comme lue, de façon idempotente.
- Le même POST avec `{ all: true }` : marque toutes les notifications du compte comme lues, même celles des pages suivantes.

Les réponses sont `private, no-store`. Les mutations contrôlent l’origine et ne prennent jamais l’utilisateur depuis le corps de la requête. Un tiers ne peut pas lire ou marquer la notification d’un autre compte.

Le compteur est relu au retour de la connexion, au focus et à la réception des événements de notification/message. Les lectures émettent `notifications:read` dans la seule salle personnelle du compte pour synchroniser ses onglets et appareils connectés. Les mises à jour du centre passent par l’API sans rafraîchir la route Next.js. Ouvrir une notification la marque comme lue ; les commandes « Marquer comme lue » et « Tout marquer comme lu » restent disponibles. Les rappels d’entretien sont conservés dans une section séparée et ne sont pas artificiellement ajoutés au compteur des notifications persistantes.

Vérification :

```sh
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test --test-concurrency=1 tests/notifications.integration.test.mjs tests/intervention-notifications.integration.test.mjs
```

Les tests couvrent les deux rôles, le compteur au-delà de la première page, la pagination, les catégories, la lecture idempotente, le marquage global, la confidentialité et les événements de synchronisation.
