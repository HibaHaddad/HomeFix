# Messagerie Client–Professionnel

La messagerie utilise le cookie HttpOnly `session` existant et les modèles PostgreSQL `ServiceRequest`, `ChatMessage`, `ClientAttachment` et `ClientNotification`. Aucun message de démonstration n’est injecté.

## Démarrage

```sh
npm install --legacy-peer-deps
npm run db:generate
npx prisma migrate deploy
npm run dev
```

Pour la production : `npm run build`, puis `npm start`. Les scripts démarrent `server.ts`, le serveur HTTP commun à Next.js et Socket.IO. `next dev` et `next start` seuls ne démarrent pas Socket.IO. Les modifications de `server.ts` et des services qu’il importe nécessitent un redémarrage du serveur de développement.

Les sorties de développement sont isolées dans `.next-dev` et celles de production dans `.next`. Un build peut ainsi être vérifié sans supprimer les fichiers que le serveur de développement utilise pour rendre ses pages.

Variables : `DATABASE_URL`, `JWT_SECRET`, éventuellement `PORT`, `HOSTNAME` et `APP_ORIGIN` (origine publique exacte, par exemple `https://homefix.example`). Derrière un proxy, configurer `APP_ORIGIN`, le transfert des cookies et la montée de connexion WebSocket sur `/socket.io/`. Utiliser HTTPS pour le GPS et les cookies sécurisés.

Le déploiement actuel attend **un processus Node persistant**. Une plateforme de fonctions serverless seule ne convient pas. Pour plusieurs instances, ajouter un adaptateur Socket.IO partagé, une distribution des événements des routes HTTP et l’affinité des sessions pour le transport polling. La présence actuelle est locale au processus.

## Comportement et confidentialité

- « Contacter » ouvre ou crée un fil privé unique par couple client/professionnel. La migration rattache la clé canonique au plus ancien fil MESSAGE existant ; les éventuels autres anciens fils restent consultables sans suppression ni fusion destructive.
- Les messages partent par Socket.IO avec accusé serveur et reprise automatique. Un nonce stable empêche leur duplication si l’accusé se perd. Après un échec, réessayer le même contenu conserve ce nonce jusqu’à confirmation. Les brouillons non confirmés ne survivent pas à une fermeture de l’onglet.
- L’historique paginé est relu à l’ouverture et à la reconnexion, ce qui récupère aussi les messages manqués et leurs statuts.
- ✓ signifie enregistré, ✓✓ reçu par une session du destinataire, ✓✓ bleu lu. Le navigateur émet la lecture seulement lorsque le chat est affiché, l’onglet visible et la fenêtre active. Seuls les identifiants chargés sont concernés ; un GET d’historique ne marque rien comme lu.
- Les images ont un aperçu avant envoi, une limite de 8 Mo et une vérification de signature JPEG/PNG/WebP. Les données sont stockées en base, hors du répertoire public. Chaque téléchargement authentifie de nouveau un participant ; les réponses sont privées et non mises en cache. La limite historique de 20 pièces jointes par demande est conservée.
- Le GPS nécessite une confirmation volontaire et l’autorisation native du navigateur. Les coordonnées sont validées côté serveur et réservées aux participants dans les API. La carte utilise OpenStreetMap : le fournisseur reçoit les coordonnées nécessaires à son affichage, ce qui est indiqué à la confirmation du partage.
- Les événements de conversation, de saisie, de livraison et de lecture vérifient l’accès côté serveur. La connexion vérifie le JWT, le rôle et le statut du compte ; une expiration de session ferme la connexion. Une limite de paquets réduit le spam.
- Les notifications persistantes utilisent le modèle existant ; un avis dans l’application apparaît aussi en temps réel dans les deux espaces. Aucune notification système n’est activée sans demande utilisateur.

## Validation

Avec le serveur lancé et `.env` configuré :

```sh
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/realtime-chat.integration.test.mjs
node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/client-workspace.integration.test.mjs tests/directory.integration.test.mjs
```

Les tests créent des utilisateurs temporaires dans la base configurée et les suppriment ensuite. Ils vérifient les deux sens de communication, le refus des sessions anonymes et des tiers, la déduplication, les accusés, la saisie, les photos privées, les coordonnées et la récupération après déconnexion. `DIRECTORY_TEST_URL` permet de cibler un autre port.
